import type { IFieldVo } from '@teable/core';
import { CellValueType, DbFieldType, FieldType } from '@teable/core';
import type { IChartStorage, ITableQuery } from '@teable/openapi';
import { AGGREGATE_COUNT_KEY, ChartType, DataSource } from '@teable/openapi';
import { describe, expect, it } from 'vitest';
import { TableAdapter } from './TableAdapter';

const provinceField: IFieldVo = {
  id: 'fldProvince00000001',
  name: 'Province',
  dbFieldName: 'province',
  type: FieldType.SingleSelect,
  options: {
    choices: [
      { id: 'choBc00000000001', name: 'BC', color: 'blueBright' },
      { id: 'choOn00000000001', name: 'ON', color: 'redBright' },
      { id: 'choNull0000000001', name: 'null', color: 'grayBright' },
    ],
  },
  unique: false,
  cellValueType: CellValueType.String,
  dbFieldType: DbFieldType.Text,
} as unknown as IFieldVo;

const regionField: IFieldVo = {
  id: 'fldRegion000000001',
  name: 'Region',
  dbFieldName: 'region',
  type: FieldType.SingleSelect,
  options: {
    choices: [
      { id: 'choWest000000001', name: 'West', color: 'blueBright' },
      { id: 'choEast000000001', name: 'East', color: 'redBright' },
    ],
  },
  unique: false,
  cellValueType: CellValueType.String,
  dbFieldType: DbFieldType.Text,
} as unknown as IFieldVo;

const baseStorage = (query: Partial<ITableQuery>): IChartStorage<ITableQuery> =>
  ({
    chartType: ChartType.Bar,
    dataSource: DataSource.Table,
    query: {
      tableId: 'tblOrders00000001',
      viewId: 'viwDefault0000001',
      orderBy: { on: 'xAxis', order: 'asc' },
      filter: {},
      groupBy: null,
      xAxis: 'fldProvince00000001',
      seriesArray: 'COUNTA',
      ...query,
    },
    config: {},
    appearance: { theme: 'blue', legendVisible: true, labelVisible: true },
  }) as unknown as IChartStorage<ITableQuery>;

describe('TableAdapter — empty/null dimension label handling', () => {
  it('renders a null grouped value as the friendly empty label on the x-axis, and preserves a real "null" string value', () => {
    const result = [
      { [provinceField.id]: 'BC', [AGGREGATE_COUNT_KEY]: 5 },
      { [provinceField.id]: null, [AGGREGATE_COUNT_KEY]: 2 },
      { [provinceField.id]: 'null', [AGGREGATE_COUNT_KEY]: 1 },
    ];
    const storage = baseStorage({});
    const adapter = new TableAdapter(storage, result, [provinceField], '(Unset)');

    const { xData, series } = adapter.getData();

    expect(xData).toEqual(['BC', 'null', '(Unset)']);
    // literal string "null" cell value must be preserved verbatim, not mangled
    expect(xData[1]).toBe('null');
    // the friendly label must be last
    expect(xData.at(-1)).toBe('(Unset)');

    // series data stays index-aligned with the (reordered) categories
    expect(series).toHaveLength(1);
    expect(series[0].data).toEqual([5, 1, 2]);
  });

  it('falls back to the default label when no emptyLabel is supplied', () => {
    const result = [{ [provinceField.id]: null, [AGGREGATE_COUNT_KEY]: 1 }];
    const storage = baseStorage({});
    const adapter = new TableAdapter(storage, result, [provinceField]);

    const { xData } = adapter.getData();
    expect(xData).toEqual(['Empty']);
  });

  it('keeps a non-empty ordering untouched when there is no empty group', () => {
    const result = [
      { [provinceField.id]: 'ON', [AGGREGATE_COUNT_KEY]: 3 },
      { [provinceField.id]: 'BC', [AGGREGATE_COUNT_KEY]: 4 },
    ];
    const storage = baseStorage({});
    const adapter = new TableAdapter(storage, result, [provinceField], '(Unset)');

    const { xData, series } = adapter.getData();
    expect(xData).toEqual(['ON', 'BC']);
    expect(series[0].data).toEqual([3, 4]);
  });

  it('relabels legend/series names to the friendly label when grouped by a field with a null value', () => {
    const result = [
      {
        [provinceField.id]: 'BC',
        [regionField.id]: 'West',
        aggregate_count: 3,
      },
      {
        [provinceField.id]: 'BC',
        [regionField.id]: null,
        aggregate_count: 1,
      },
      {
        [provinceField.id]: 'ON',
        [regionField.id]: 'West',
        aggregate_count: 2,
      },
    ];
    const storage = baseStorage({ groupBy: regionField.id });
    const adapter = new TableAdapter(storage, result, [provinceField, regionField], '(Unset)');

    const { legendData, series } = adapter.getData();

    expect(legendData).not.toContain('null');
    expect(legendData).toEqual(['West', '(Unset)']);
    expect(series.map((s) => s.name)).toEqual(['West', '(Unset)']);
  });
});
