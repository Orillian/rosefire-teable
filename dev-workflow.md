# Rosefire fork - dev workflow

This file documents how to work on the `rosefire` branch: the patch-series
convention, how to run tests locally, and what CI does (and deliberately does
not do).

## The patch series

The fork's changes on top of upstream `develop` are landed as a numbered
series of small, reviewable commits (`P1`, `P2`, ... ). As of this writing the
series has grown past its original P1-P5 scope to **P1-P9**, plus this test/CI
alignment pass (P10):

- **P1** - default theme to light.
- **P2** - select-choice colors become optional; an omitted color renders the
  choice as plain text ("no color") instead of being backfilled with a random
  color.
- **P3** - remove dead AI/App-Builder admin todos.
- **P4** - suppress per-field AI config UI (`FieldAiConfig` renders null).
- **P5** - hide/remove the template-center UI (`TemplateModal` and its
  13-file directory, `PublishBaseDialog`, `admin/template`,
  `TemplateCreateBaseModal`, `TemplateSelectSpaceDialog`, `useTemplateMonitor`).
- **P6** - remove the dashboard deprecation banner.
- **P7** - re-enable dashboard creation by neutralizing the upstream
  `disallowDashboard` admin setting (frontend no longer gates on it; new
  migration `20260724120000_reenable_dashboard`).
- **P8** - remove upsell/EE surfaces: `AuthorityMatrix` pages/components,
  `UpgradeWrapper`, `LicenseExpiryBanner`, `SpaceSubscriptionModal` + its
  monitor/store, the user-menu Contact Support/Help entries, related i18n keys.
- **P9** - `KanbanStackHeader` dirty-check fix (a color-only stack edit no
  longer gets silently dropped); notifications Settings tab, severity chips,
  and `ImportantNotificationPopup` removed; `notifyMeta.email` now defaults to
  `false`.
- **P10** (this pass) - brought the unit test suites back into alignment with
  P1-P9, added coverage the patches earned but hadn't shipped yet, assessed
  e2e feasibility, and gave the fork its own CI.

### Policy: ship with tests, cull with trims

Every patch in the series ships with tests for what it changed or added. When
a patch **trims** a feature (deletes a component, disables a setting, removes
a UI surface), it must also **cull** that feature's now-dead tests in the same
patch - either delete the spec file outright, or delete just the
`describe`/`it` blocks that exercised the removed behavior. A patch is not
"done" until:

1. The touched-package unit suites are green (see below).
2. Any test that only existed to cover removed behavior has been deleted.
3. Any test whose *assertion* is now wrong because behavior legitimately
   changed (not removed) has been updated to assert the new intended
   behavior.
4. Pre-existing failures unrelated to the patch are left alone, but called out
   explicitly (e.g. in the commit message or PR description) rather than
   silently ignored.

## Running the unit suites

The fork touches four packages: `packages/core`, `packages/sdk`,
`apps/nextjs-app`, and `apps/nestjs-backend`. Each has its own `test-unit`
script (vitest); none of them need a database or Redis to run:

```bash
# from repo root, or run inside each package directory
pnpm -F @teable/core test-unit
pnpm -F @teable/sdk test-unit
pnpm -F @teable/app test-unit
pnpm -F @teable/backend test-unit

# or all four in parallel:
pnpm -r -F "@teable/app" -F "@teable/core" -F "@teable/sdk" -F "@teable/backend" --parallel test-unit
```

Notes:

- **Timezone**: a couple of `packages/core` date-formatting specs assume a
  UTC test environment (matching GitHub Actions runners). If your machine's
  local timezone isn't UTC, run with `TZ=UTC` prefixed, e.g.
  `TZ=UTC pnpm -F @teable/core test-unit`. This is a pre-existing,
  environment-only quirk, not a real regression.
- The `nestjs-backend` unit suite (`vitest.config.ts`, distinct from
  `vitest-e2e.config.ts`) only picks up `src/**/*.spec.ts` and does not touch
  a live database - Nest providers that would otherwise need Prisma/Redis are
  either mocked or constructed directly off the class prototype (see
  `field.service.spec.ts` and `field-supplement.service.spec.ts` for the
  pattern: `Object.create(SomeService.prototype)` + `Object.assign` with
  mocked collaborators, useful for exercising a pure/private method without
  going through Nest's DI container).

## Running the nestjs-backend e2e suite (field-convert scope, or full)

The e2e suite (`test/**/*.e2e-spec.ts`, run via `vitest-e2e.config.ts`) is a
different animal: it needs a real Postgres and Redis reachable over TCP, a
seeded "template" database that gets cloned per test worker
(`provisionWorkerDatabases` in `test/utils/e2e-shared.ts`), and a full build
of the workspace packages first. It is **not** run in CI (see below) and is
not part of the default local loop - run it deliberately when you've touched
something e2e-relevant (e.g. field conversion, which is where P2's optional
select colors interact with the rest of the field pipeline).

Verified working recipe (confirmed on 2026-07-25 against the `rosefire`
branch, scoped to the field-convert area - `test/field-converting.e2e-spec.ts`,
`test/convert-field-transaction.e2e-spec.ts`,
`test/formula-timezone-convert.e2e-spec.ts` - 113/113 passing in ~200s):

```bash
# 1. Isolated network + a throwaway Postgres on a non-default port so it
#    can't collide with any docker-compose stack you already have running.
export NETWORK_MODE=teablenet-0
export DOCKER_UID=$(id -u)
export DOCKER_GID=$(getent group docker | cut -d: -f3)
docker network create teablenet-0
docker compose --env-file dockers/.env \
  -f dockers/networks.yml -f dockers/database-postgres.yml \
  run -p 25432:5432 -d -T --no-deps --rm --name teable-postgres-0 teable-postgres

# 2. Throwaway Redis.
docker compose --env-file dockers/.env \
  -f dockers/networks.yml -f dockers/cache-redis.yml \
  run -p 6379:6379 -d -T --no-deps --rm --name teable-cache-0 teable-cache

# 3. Create the e2e database (prisma migrate deploy does not create it).
docker exec teable-postgres-0 psql -U teable -d teable -c "CREATE DATABASE e2e_test_teable;"

# 4. Migrate both Prisma schemas against it.
export PRISMA_DATABASE_URL="postgresql://teable:teable@127.0.0.1:25432/e2e_test_teable?schema=public&statement_cache_size=0&connection_limit=20"
pnpm -F @teable/db-main-prisma prisma-generate --schema ./prisma/postgres/schema.prisma
pnpm -F @teable/db-main-prisma prisma-migrate deploy --schema ./prisma/postgres/schema.prisma
pnpm -F @teable/db-data-prisma prisma-generate
pnpm -F @teable/db-data-prisma prisma-migrate deploy --schema ./prisma/schema.prisma

# 5. Seed the template database.
export BACKEND_CACHE_PROVIDER=redis
export BACKEND_CACHE_REDIS_URI="redis://:teable@127.0.0.1:6379/1"
export NODE_ENV=test
pnpm -F @teable/db-main-prisma prisma-db-seed -- --e2e

# 6. Run the scoped e2e spec(s) (or drop the file args to run everything).
cd apps/nestjs-backend
CI=1 npx vitest run --config ./vitest-e2e.config.ts \
  test/field-converting.e2e-spec.ts \
  test/convert-field-transaction.e2e-spec.ts \
  test/formula-timezone-convert.e2e-spec.ts

# 7. Tear down.
docker rm -fv teable-postgres-0 teable-cache-0
docker network rm teablenet-0
```

To run the **entire** e2e battery instead of the field-convert scope, drop
the three file arguments from step 6 (expect it to take considerably
longer - the full suite is sharded 4 ways in upstream's CI).

You may see `Async event handler failed ... TableSearchVectorSchemaMaintenanceProjection ...
Attempted to resolve unregistered dependency token: "Symbol(v2.tableOps.searchVectorSchemaMaintenanceScheduler)"`
errors logged during field-convert runs; these come from an unrelated v2
projection wiring gap, are logged as errors but don't fail any test, and were
already present before this pass.

## CI

`.github/workflows/rosefire-tests.yml` runs on every push to `rosefire`: it
installs, generates the Prisma client, builds the workspace packages, and
runs the four unit suites above (`@teable/core`, `@teable/sdk`, `@teable/app`,
`@teable/backend`). It intentionally does **not**:

- Run the nestjs-backend e2e battery (needs live Postgres/Redis + per-worker
  DB provisioning - see the recipe above for running it by hand).
- Build or push a Docker image - images for this fork are built locally by
  design (see the root `Makefile` / `docker-bake.hcl`), not in CI.

Several upstream workflows were removed because they assume upstream's own
infrastructure/secrets and don't apply to this fork:

- `docker-push.yml`, `promote-latest.yml`, `publish-release.yml` - build/push
  to upstream's registry and their release automation.
- `trigger-sync-to-ee.yml` - syncs upstream's community branch to their EE repo.
- `manual-preview.yml`, `preview-cleanup.yml` (+ `templates/preview-template.yaml`) -
  spin up/tear down PR preview environments on upstream's cloud namespace.
- `unit-tests.yml`, `integration-tests.yml` - superseded by
  `rosefire-tests.yml` (both were scoped to the `develop` branch anyway, so
  they never ran for pushes to `rosefire`).

`linting.yml`, `v2-core-tests.yml`, and `v2-benchmark-tests.yml` were left
in place: they're PR-triggered against `develop` (so they don't run against
`rosefire` pushes either) and don't reference any upstream-only secrets or
registries, so there's nothing fork-unsafe about leaving them.
