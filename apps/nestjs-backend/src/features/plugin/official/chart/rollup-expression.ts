import { FieldRollup } from '@teable/openapi';
import type { Knex } from 'knex';

export interface IRollupExpression {
  alias: string;
  raw: Knex.Raw;
}

/**
 * Builds the SQL expression (and its result-column alias) for one series item's rollup function.
 *
 * `dbFieldName` is the (possibly table-qualified, e.g. `"joined_table"."fldXxx"`) column to
 * aggregate; `unqualifiedDbFieldName` is always the field's own bare db column name and is used
 * only for the alias, which follows the pre-existing `${dbFieldName}_${rollup}` convention so
 * results stay backward compatible with charts saved before this port and with `TableAdapter`'s
 * row-key lookups on the frontend.
 *
 * SQL bodies are ported 1:1 from legacy's per-function formulas
 * (`apps/nestjs-backend/src/db-provider/aggregation-query/aggregation-function.abstract.ts` and
 * `postgres/aggregation-function.postgres.ts`), translated from Knex's per-function builder sugar
 * (`.sum()`/`.avg()`/...) to raw SQL so the whole function set can share one code path.
 *
 * Note on `Count`: chartv2's pre-existing `Count` compiles to `COUNT(column)` (non-null cells of
 * that column), not legacy's `COUNT(*)` row-count semantics for `StatisticsFunc.Count` - that
 * behavior predates this port and is preserved here for backward compatibility with already-saved
 * charts rather than "corrected" to match legacy's naming. The newly-added `Filled` function uses
 * the identical `COUNT(column)` formula (matching legacy's own `Filled`), so the row-count concept
 * legacy calls `Count` is best reached today via `Filled` on a column known to never be null, or
 * via the existing `seriesArray: 'COUNTA'` total-records mode.
 */
export const buildRollupExpression = (
  knex: Knex,
  dbFieldName: string,
  unqualifiedDbFieldName: string,
  rollup: FieldRollup
): IRollupExpression | undefined => {
  const alias = `${unqualifiedDbFieldName}_${rollup}`;
  const col = dbFieldName;

  switch (rollup) {
    case FieldRollup.Sum:
      return { alias, raw: knex.raw('SUM(??) as ??', [col, alias]) };
    case FieldRollup.Avg:
      return { alias, raw: knex.raw('AVG(??) as ??', [col, alias]) };
    case FieldRollup.Min:
      return { alias, raw: knex.raw('MIN(??) as ??', [col, alias]) };
    case FieldRollup.Max:
      return { alias, raw: knex.raw('MAX(??) as ??', [col, alias]) };
    case FieldRollup.Count:
    case FieldRollup.Filled:
      return { alias, raw: knex.raw('COUNT(??) as ??', [col, alias]) };
    case FieldRollup.Empty:
      return { alias, raw: knex.raw('(COUNT(*) - COUNT(??)) as ??', [col, alias]) };
    case FieldRollup.Unique:
      return { alias, raw: knex.raw('COUNT(DISTINCT ??) as ??', [col, alias]) };
    case FieldRollup.PercentEmpty:
      return {
        alias,
        raw: knex.raw('(((COUNT(*) - COUNT(??)) * 1.0 / GREATEST(COUNT(*), 1)) * 100) as ??', [
          col,
          alias,
        ]),
      };
    case FieldRollup.PercentFilled:
      return {
        alias,
        raw: knex.raw('((COUNT(??) * 1.0 / GREATEST(COUNT(*), 1)) * 100) as ??', [col, alias]),
      };
    case FieldRollup.PercentUnique:
      return {
        alias,
        raw: knex.raw('((COUNT(DISTINCT ??) * 1.0 / GREATEST(COUNT(*), 1)) * 100) as ??', [
          col,
          alias,
        ]),
      };
    case FieldRollup.Checked:
      return {
        alias,
        raw: knex.raw('SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END) as ??', [col, alias]),
      };
    case FieldRollup.UnChecked:
      return {
        alias,
        raw: knex.raw('SUM(CASE WHEN ?? = false OR ?? IS NULL THEN 1 ELSE 0 END) as ??', [
          col,
          col,
          alias,
        ]),
      };
    case FieldRollup.PercentChecked:
      return {
        alias,
        raw: knex.raw(
          '((SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END) * 1.0 / GREATEST(COUNT(*), 1)) * 100) as ??',
          [col, alias]
        ),
      };
    case FieldRollup.PercentUnChecked:
      return {
        alias,
        raw: knex.raw(
          '((SUM(CASE WHEN ?? = false OR ?? IS NULL THEN 1 ELSE 0 END) * 1.0 / GREATEST(COUNT(*), 1)) * 100) as ??',
          [col, col, alias]
        ),
      };
    case FieldRollup.EarliestDate:
      return { alias, raw: knex.raw('MIN(??) as ??', [col, alias]) };
    case FieldRollup.LatestDate:
      return { alias, raw: knex.raw('MAX(??) as ??', [col, alias]) };
    case FieldRollup.DateRangeOfDays:
      return {
        alias,
        raw: knex.raw('EXTRACT(DAY FROM (MAX(??) - MIN(??)))::INTEGER as ??', [col, col, alias]),
      };
    case FieldRollup.DateRangeOfMonths:
      return {
        alias,
        raw: knex.raw(
          `(EXTRACT(YEAR FROM AGE(date_trunc('month', MAX(??)), date_trunc('month', MIN(??)))) * 12 + EXTRACT(MONTH FROM AGE(date_trunc('month', MAX(??)), date_trunc('month', MIN(??)))))::INTEGER as ??`,
          [col, col, col, col, alias]
        ),
      };
    case FieldRollup.TotalAttachmentSize:
      return {
        alias,
        raw: knex.raw(
          `SUM(COALESCE((SELECT SUM((e.value->>'size')::INTEGER) FROM jsonb_array_elements(COALESCE(??, '[]'::jsonb)) AS e), 0)) as ??`,
          [col, alias]
        ),
      };
    default:
      return undefined;
  }
};
