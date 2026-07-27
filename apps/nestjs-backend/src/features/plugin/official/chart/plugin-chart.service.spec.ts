import { BadRequestException } from '@nestjs/common';
import { FieldRollup } from '@teable/openapi';
import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { PluginChartService } from './plugin-chart.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Exercises PluginChartService.applyGroupByAndSeries directly off the class prototype, bypassing
// Nest's DI container - see dev-workflow.md's documented pattern (`field.service.spec.ts`) for
// exercising a private method without booting the whole module.

describe('PluginChartService.applyGroupByAndSeries (aggregation query building)', () => {
  const db = knex({ client: 'pg' });

  const makeService = () => {
    const service = Object.create(PluginChartService.prototype) as PluginChartService;
    Object.assign(service, { knex: db });
    return service;
  };

  const numberField = {
    id: 'fldNumber',
    dbFieldName: 'fld_count',
    name: 'Count',
    type: 'number',
    cellValueType: 'number',
    isMultipleCellValue: false,
  };

  const multiSelectField = {
    id: 'fldTags',
    dbFieldName: 'fld_tags',
    name: 'Tags',
    type: 'multipleSelect',
    cellValueType: 'string',
    isMultipleCellValue: true,
  };

  it('keeps the pre-existing SUM series SQL unchanged (backward compatibility)', () => {
    const service = makeService();
    const qb = db.queryBuilder().from('filtered_records');
    (service as any).applyGroupByAndSeries(qb, [numberField], undefined, undefined, [
      { column: 'fldNumber', rollup: FieldRollup.Sum },
    ]);
    expect(qb.toQuery()).toContain('SUM("fld_count") as "fld_count_sum"');
  });

  it('builds a newly-ported PercentFilled series expression', () => {
    const service = makeService();
    const qb = db.queryBuilder().from('filtered_records');
    (service as any).applyGroupByAndSeries(qb, [numberField], undefined, undefined, [
      { column: 'fldNumber', rollup: FieldRollup.PercentFilled },
    ]);
    expect(qb.toQuery()).toContain('as "fld_count_percentFilled"');
  });

  it('rejects a rollup invalid for the field type (Checked on a Number field)', () => {
    const service = makeService();
    const qb = db.queryBuilder().from('filtered_records');
    expect(() =>
      (service as any).applyGroupByAndSeries(qb, [numberField], undefined, undefined, [
        { column: 'fldNumber', rollup: FieldRollup.Checked },
      ])
    ).toThrow(BadRequestException);
  });

  it('rejects Unique on a multi-value field - the one documented MCV gap versus legacy', () => {
    const service = makeService();
    const qb = db.queryBuilder().from('filtered_records');
    expect(() =>
      (service as any).applyGroupByAndSeries(qb, [multiSelectField], undefined, undefined, [
        { column: 'fldTags', rollup: FieldRollup.Unique },
      ])
    ).toThrow(BadRequestException);
  });

  it('still allows Filled on a multi-value field - the exclusion is narrow, not blanket', () => {
    const service = makeService();
    const qb = db.queryBuilder().from('filtered_records');
    expect(() =>
      (service as any).applyGroupByAndSeries(qb, [multiSelectField], undefined, undefined, [
        { column: 'fldTags', rollup: FieldRollup.Filled },
      ])
    ).not.toThrow();
    expect(qb.toQuery()).toContain('as "fld_tags_filled"');
  });

  it('selects xAxis/groupBy using the bare column but the field id as alias', () => {
    const service = makeService();
    const qb = db.queryBuilder().from('filtered_records');
    (service as any).applyGroupByAndSeries(qb, [numberField], 'fldNumber', undefined, 'COUNTA');
    const sql = qb.toQuery();
    expect(sql).toContain('"fld_count" as "fldNumber"');
    expect(sql).toContain('group by "fldNumber"');
  });
});
