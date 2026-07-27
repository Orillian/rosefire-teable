import type { IFieldVo } from '@teable/core';
import type { IChartStorage, IDashboardLayout, ISqlQuery, ITableQuery } from '@teable/openapi';
import { ChartType, DataSource } from '@teable/openapi';
import { getEchartsType, getChartConfigByType, getThemeByName } from '../../chart/utils';
import type { BaseAdapter, IChartData } from '../adapters/BaseAdapter';
import { SqlAdapter } from '../adapters/SqlAdapter';
import { TableAdapter } from '../adapters/TableAdapter';
import type { BaseChart, IChartOptions } from '../charts/BaseChart';
import { CartesianChart } from '../charts/CartesianChart';
import { PieChart, DonutChart } from '../charts/PieChart';
import { DEFAULT_EMPTY_GROUP_LABEL } from '../utils';

export class ChartFactory {
  static createAdapter(
    dataSource: DataSource,
    storage: IChartStorage,
    result: Record<string, unknown>[],
    fields?: IFieldVo[],
    emptyLabel: string = DEFAULT_EMPTY_GROUP_LABEL
  ): BaseAdapter<ITableQuery | ISqlQuery> {
    switch (dataSource) {
      case DataSource.Table:
        return new TableAdapter(storage as IChartStorage<ITableQuery>, result, fields, emptyLabel);
      case DataSource.Sql:
        return new SqlAdapter(storage as IChartStorage<ISqlQuery>, result, emptyLabel);
      default:
        throw new Error(`Unsupported data source: ${dataSource}`);
    }
  }

  static createChart(
    chartType: ChartType,
    storage: IChartStorage,
    chartData: IChartData,
    fields: IFieldVo[],
    layout?: IDashboardLayout[number],
    emptyLabel: string = DEFAULT_EMPTY_GROUP_LABEL
  ): BaseChart {
    const echartsType = getEchartsType(chartType);

    switch (chartType) {
      case ChartType.Line:
      case ChartType.Bar:
      case ChartType.Area:
        return new CartesianChart(storage, chartData, echartsType, fields, layout, emptyLabel);

      case ChartType.Pie:
        return new PieChart(storage, chartData, echartsType, fields, layout, emptyLabel);

      case ChartType.DonutChart:
        return new DonutChart(storage, chartData, echartsType, fields, layout, emptyLabel);

      default:
        throw new Error(`Unsupported chart type: ${chartType}`);
    }
  }

  static generateChartOptions(
    storage: IChartStorage,
    result: Record<string, unknown>[],
    fields?: IFieldVo[],
    layout?: IDashboardLayout[number],
    emptyLabel: string = DEFAULT_EMPTY_GROUP_LABEL
  ): IChartOptions | null {
    const { dataSource, chartType } = storage;

    if (!chartType || !result) {
      return null;
    }

    const adapter = this.createAdapter(dataSource, storage, result, fields, emptyLabel);
    const chartData = adapter.getData();

    const chart = this.createChart(
      chartType,
      storage,
      chartData,
      (fields || []) as IFieldVo[],
      layout,
      emptyLabel
    );
    const options = chart.generateOptions();

    const baseConfig = this.getBaseConfig(storage);

    return {
      ...baseConfig,
      ...options,
    };
  }

  private static getBaseConfig(storage: IChartStorage): IChartOptions {
    const { chartType, appearance } = storage;
    const theme = getThemeByName(appearance?.theme) || getThemeByName('default')!;
    return getChartConfigByType(chartType, theme) as unknown as IChartOptions;
  }
}
