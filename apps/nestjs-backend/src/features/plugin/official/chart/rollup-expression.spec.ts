import { FieldRollup } from '@teable/openapi';
import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { buildRollupExpression } from './rollup-expression';

describe('buildRollupExpression', () => {
  const db = knex({ client: 'pg' });

  it('preserves the pre-existing sum/avg/min/max/count SQL and alias convention', () => {
    const sum = buildRollupExpression(
      db,
      'filtered_records.fld_total',
      'fld_total',
      FieldRollup.Sum
    );
    expect(sum?.alias).toBe('fld_total_sum');
    expect(sum?.raw.toQuery()).toBe('SUM("filtered_records"."fld_total") as "fld_total_sum"');

    const count = buildRollupExpression(db, 'fld_total', 'fld_total', FieldRollup.Count);
    expect(count?.raw.toQuery()).toBe('COUNT("fld_total") as "fld_total_count"');
  });

  it('builds Empty as a null-count difference against COUNT(*)', () => {
    const expr = buildRollupExpression(db, 'fld_name', 'fld_name', FieldRollup.Empty);
    expect(expr?.alias).toBe('fld_name_empty');
    expect(expr?.raw.toQuery()).toBe('(COUNT(*) - COUNT("fld_name")) as "fld_name_empty"');
  });

  it('builds Filled identically to the legacy Filled formula (COUNT of the column)', () => {
    const expr = buildRollupExpression(db, 'fld_name', 'fld_name', FieldRollup.Filled);
    expect(expr?.raw.toQuery()).toBe('COUNT("fld_name") as "fld_name_filled"');
  });

  it('builds Unique as COUNT(DISTINCT ...)', () => {
    const expr = buildRollupExpression(db, 'fld_name', 'fld_name', FieldRollup.Unique);
    expect(expr?.raw.toQuery()).toBe('COUNT(DISTINCT "fld_name") as "fld_name_unique"');
  });

  it('builds the percent family as a 0-100 percentage guarded against divide-by-zero', () => {
    const percentEmpty = buildRollupExpression(
      db,
      'fld_name',
      'fld_name',
      FieldRollup.PercentEmpty
    );
    expect(percentEmpty?.raw.toQuery()).toBe(
      '(((COUNT(*) - COUNT("fld_name")) * 1.0 / GREATEST(COUNT(*), 1)) * 100) as "fld_name_percentEmpty"'
    );

    const percentFilled = buildRollupExpression(
      db,
      'fld_name',
      'fld_name',
      FieldRollup.PercentFilled
    );
    expect(percentFilled?.raw.toQuery()).toBe(
      '((COUNT("fld_name") * 1.0 / GREATEST(COUNT(*), 1)) * 100) as "fld_name_percentFilled"'
    );

    const percentUnique = buildRollupExpression(
      db,
      'fld_name',
      'fld_name',
      FieldRollup.PercentUnique
    );
    expect(percentUnique?.raw.toQuery()).toBe(
      '((COUNT(DISTINCT "fld_name") * 1.0 / GREATEST(COUNT(*), 1)) * 100) as "fld_name_percentUnique"'
    );
  });

  it('builds Checked/UnChecked as boolean CASE-WHEN sums', () => {
    const checked = buildRollupExpression(db, 'fld_active', 'fld_active', FieldRollup.Checked);
    expect(checked?.raw.toQuery()).toBe(
      'SUM(CASE WHEN "fld_active" = true THEN 1 ELSE 0 END) as "fld_active_checked"'
    );

    const unChecked = buildRollupExpression(db, 'fld_active', 'fld_active', FieldRollup.UnChecked);
    expect(unChecked?.raw.toQuery()).toBe(
      'SUM(CASE WHEN "fld_active" = false OR "fld_active" IS NULL THEN 1 ELSE 0 END) as "fld_active_unChecked"'
    );
  });

  it('builds EarliestDate/LatestDate as MIN/MAX', () => {
    const earliest = buildRollupExpression(db, 'fld_date', 'fld_date', FieldRollup.EarliestDate);
    expect(earliest?.raw.toQuery()).toBe('MIN("fld_date") as "fld_date_earliestDate"');

    const latest = buildRollupExpression(db, 'fld_date', 'fld_date', FieldRollup.LatestDate);
    expect(latest?.raw.toQuery()).toBe('MAX("fld_date") as "fld_date_latestDate"');
  });

  it('builds DateRangeOfDays/DateRangeOfMonths as MAX-MIN date arithmetic', () => {
    const days = buildRollupExpression(db, 'fld_date', 'fld_date', FieldRollup.DateRangeOfDays);
    expect(days?.raw.toQuery()).toBe(
      'EXTRACT(DAY FROM (MAX("fld_date") - MIN("fld_date")))::INTEGER as "fld_date_dateRangeOfDays"'
    );

    const months = buildRollupExpression(db, 'fld_date', 'fld_date', FieldRollup.DateRangeOfMonths);
    expect(months?.raw.toQuery()).toContain('AGE(');
    expect(months?.alias).toBe('fld_date_dateRangeOfMonths');
  });

  it('builds TotalAttachmentSize as a jsonb array size sum', () => {
    const expr = buildRollupExpression(
      db,
      'fld_attachments',
      'fld_attachments',
      FieldRollup.TotalAttachmentSize
    );
    expect(expr?.raw.toQuery()).toContain('jsonb_array_elements');
    expect(expr?.alias).toBe('fld_attachments_totalAttachmentSize');
  });

  it('uses the qualified column in the SQL body but the unqualified name in the alias', () => {
    const expr = buildRollupExpression(
      db,
      'joined_table.fld_province',
      'fld_province',
      FieldRollup.Filled
    );
    expect(expr?.raw.toQuery()).toBe(
      'COUNT("joined_table"."fld_province") as "fld_province_filled"'
    );
    expect(expr?.alias).toBe('fld_province_filled');
  });

  it('returns undefined for an unrecognized rollup value', () => {
    const expr = buildRollupExpression(
      db,
      'fld_name',
      'fld_name',
      'not-a-real-rollup' as FieldRollup
    );
    expect(expr).toBeUndefined();
  });
});
