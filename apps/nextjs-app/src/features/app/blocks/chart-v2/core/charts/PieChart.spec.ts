import type { IFieldVo } from '@teable/core';
import { CellValueType, DbFieldType, FieldType } from '@teable/core';
import type { IChartStorage, ITableQuery } from '@teable/openapi';
import { AGGREGATE_COUNT_KEY, ChartType, DataSource } from '@teable/openapi';
import { describe, expect, it } from 'vitest';
import type { IChartData } from '../adapters/BaseAdapter';
import { PieChart } from './PieChart';

const provinceField: IFieldVo = {
  id: 'fldProvince00000001',
  name: 'Province',
  dbFieldName: 'province',
  type: FieldType.SingleSelect,
  options: {
    choices: [
      { id: 'choBc00000000001', name: 'BC', color: 'blueBright' },
      { id: 'choNull0000000001', name: 'null', color: 'grayBright' },
    ],
  },
  unique: false,
  cellValueType: CellValueType.String,
  dbFieldType: DbFieldType.Text,
} as unknown as IFieldVo;

const storage = {
  chartType: ChartType.Pie,
  dataSource: DataSource.Table,
  query: {
    tableId: 'tblOrders00000001',
    viewId: 'viwDefault0000001',
    orderBy: { on: 'xAxis', order: 'asc' },
    filter: {},
    groupBy: null,
    xAxis: provinceField.id,
    seriesArray: 'COUNTA',
  },
  config: {},
  appearance: { theme: 'blue', legendVisible: true, labelVisible: true },
} as unknown as IChartStorage<ITableQuery>;

describe('PieChart — empty/null slice label handling', () => {
  it('renders a null dimension value as the friendly empty label, preserving a real "null" string value', () => {
    const rawData = [
      { [provinceField.id]: 'BC', [AGGREGATE_COUNT_KEY]: 5 },
      { [provinceField.id]: null, [AGGREGATE_COUNT_KEY]: 2 },
      { [provinceField.id]: 'null', [AGGREGATE_COUNT_KEY]: 1 },
    ];
    const chartData: IChartData = {
      xData: [],
      legendData: [],
      rawData,
      series: [],
    };

    const chart = new PieChart(storage, chartData, 'pie', [provinceField], undefined, '(Unset)');

    const options = chart.generateOptions();
    const data = options.series[0].data as { value: number; name: string }[];

    expect(data).toEqual([
      { value: 5, name: 'BC' },
      { value: 2, name: '(Unset)' },
      { value: 1, name: 'null' },
    ]);
  });
});
