-- Rosefire fork: dashboards/charts are first-class features and must be
-- re-enabled after the 20251210134101_disallow_dashboard migration set the
-- admin setting to 'true' by default. This flips it back to 'false' for any
-- instance that already ran that migration.
UPDATE "setting" SET "content" = 'false' WHERE "name" = 'disallowDashboard';
