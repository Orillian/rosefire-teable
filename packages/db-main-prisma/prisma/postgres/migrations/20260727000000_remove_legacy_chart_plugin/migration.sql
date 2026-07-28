-- The legacy chart plugin ("plgchart") has been removed from the codebase; chartv2
-- ("plgchartV2") is now the sole chart path. This migration removes the plugin
-- registration and cleans up any existing installs.
--
-- `plugin_install.plugin_id` has `onDelete: Cascade` back to `plugin`, so deleting the
-- plugin row below is enough to drop its install rows. That FK cascade does NOT reach
-- into the free-form JSON `layout` blobs on `dashboard`/`plugin_panel` though (those
-- just embed `pluginInstallId` values with no DB-level referential integrity), so any
-- now-dangling layout entries are stripped explicitly first, before the installs (and
-- the ids they reference) are gone.
--
-- Safe to run on a database with zero legacy installs: every statement below is a
-- no-op in that case.

BEGIN;

-- Strip dashboard layout entries that point at a plgchart install.
UPDATE "dashboard" AS d
SET layout = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(d.layout::jsonb) AS elem
  WHERE (elem ->> 'pluginInstallId') NOT IN (
    SELECT id FROM "plugin_install" WHERE plugin_id = 'plgchart'
  )
)
WHERE d.layout IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(d.layout::jsonb) AS elem
    WHERE (elem ->> 'pluginInstallId') IN (
      SELECT id FROM "plugin_install" WHERE plugin_id = 'plgchart'
    )
  );

-- Same cleanup for plugin-panel layouts (the "Panel" position).
UPDATE "plugin_panel" AS p
SET layout = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(p.layout::jsonb) AS elem
  WHERE (elem ->> 'pluginInstallId') NOT IN (
    SELECT id FROM "plugin_install" WHERE plugin_id = 'plgchart'
  )
)
WHERE p.layout IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p.layout::jsonb) AS elem
    WHERE (elem ->> 'pluginInstallId') IN (
      SELECT id FROM "plugin_install" WHERE plugin_id = 'plgchart'
    )
  );

-- Drop any existing plgchart installs explicitly (also covered by the plugin FK
-- cascade below, kept here for clarity/safety).
DELETE FROM "plugin_install" WHERE plugin_id = 'plgchart';

-- Finally, remove the legacy chart plugin registration itself.
DELETE FROM "plugin" WHERE id = 'plgchart';

COMMIT;
