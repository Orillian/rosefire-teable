import type { IChartStorage, ISqlQuery } from '@teable/openapi';
import { groupBy } from 'lodash';
import type { ISeriesConfig } from '../types';
import {
  DEFAULT_EMPTY_GROUP_LABEL,
  EMPTY_GROUP_KEY,
  formatGroupDisplayValue,
  getGroupUniqueKey,
} from '../utils';
import { BaseAdapter, type IChartData } from './BaseAdapter';

export class SqlAdapter extends BaseAdapter<ISqlQuery> {
  private emptyLabel: string;

  constructor(
    storage: IChartStorage<ISqlQuery>,
    result: Record<string, unknown>[],
    emptyLabel: string = DEFAULT_EMPTY_GROUP_LABEL
  ) {
    super(storage, result);
    this.emptyLabel = emptyLabel;
  }

  getData(): IChartData {
    const { config } = this.storage;
    const { yAxis = [] } = config || {};

    const xKeys = this.getXKeys();
    const legendData = yAxis;

    const series = this.getSeries(xKeys, legendData);
    const xData = this.getRealXData(xKeys);

    return {
      xData,
      legendData,
      rawData: this.result,
      series,
    };
  }

  private getXKeys(): string[] {
    const { xAxis } = this.storage.config || {};
    if (!xAxis) {
      return [];
    }
    const keys = Object.keys(groupBy(this.result, (item) => getGroupUniqueKey(item[xAxis])));
    return this.sortEmptyGroupLast(keys);
  }

  /**
   * Keep the empty-value bucket in a stable, predictable position (last)
   * instead of wherever it happened to land in the underlying query result.
   */
  private sortEmptyGroupLast(keys: string[]): string[] {
    if (!keys.includes(EMPTY_GROUP_KEY)) {
      return keys;
    }
    return [...keys.filter((key) => key !== EMPTY_GROUP_KEY), EMPTY_GROUP_KEY];
  }

  private getRealXData(xKeys: string[]): string[] {
    const { xAxis } = this.storage.config || {};
    if (!xAxis) {
      return [];
    }
    const grouped = groupBy(this.result, (item) => getGroupUniqueKey(item[xAxis]));
    // SQL data source has no field metadata, so a raw value is stringified as-is;
    // a genuinely empty (null/undefined) value still renders as the friendly label.
    return xKeys.map((key) =>
      formatGroupDisplayValue(undefined, grouped[key]?.[0]?.[xAxis], this.emptyLabel)
    );
  }

  getSeries(xKeys: string[], legendData: string[]): ISeriesConfig[] {
    const { xAxis } = this.storage.config;
    const groupByData = groupBy(this.result, (item) => getGroupUniqueKey(item[xAxis]));
    return legendData.map((name) => {
      return {
        name,
        data: xKeys.map((xKey) => {
          const item = groupByData?.[xKey]?.find((item) => getGroupUniqueKey(item[xAxis]) === xKey);
          return item?.[name] ?? 0;
        }),
      };
    }) as ISeriesConfig[];
  }
}
