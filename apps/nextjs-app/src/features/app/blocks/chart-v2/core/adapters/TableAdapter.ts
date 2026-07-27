import type { IFieldVo } from '@teable/core';
import type { IChartStorage, ITableQuery } from '@teable/openapi';
import { AGGREGATE_COUNT_KEY } from '@teable/openapi';
import { groupBy } from 'lodash';
import type { ISeriesConfig } from '../types';
import {
  getGroupUniqueKey,
  formatGroupDisplayValue,
  EMPTY_GROUP_KEY,
  DEFAULT_EMPTY_GROUP_LABEL,
} from '../utils';
import { BaseAdapter, type IChartData } from './BaseAdapter';

export const MAX_X_DATA_LENGTH = 50;
export class TableAdapter extends BaseAdapter<ITableQuery> {
  private fields: IFieldVo[];
  private emptyLabel: string;

  constructor(
    storage: IChartStorage<ITableQuery>,
    result: Record<string, unknown>[],
    fields: IFieldVo[] = [],
    emptyLabel: string = DEFAULT_EMPTY_GROUP_LABEL
  ) {
    super(storage, result);
    this.fields = fields;
    this.emptyLabel = emptyLabel;
  }

  private getFieldMap(): Record<string, string> {
    return this.fields.reduce(
      (acc, field) => {
        acc[field.id] = field.dbFieldName;
        acc[field.dbFieldName] = field.id;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  getData(): IChartData {
    const xData = this.getXData();
    const legendData = this.buildLegendData();
    const series = this.getSeries(xData, legendData);
    const finalXData = this.getRealXData(xData);
    const { groupBy: groupByFiledId } = this.storage.query;

    // When series/legend are split by a grouped field, `legendData`/`series[].name`
    // are the raw internal grouping keys (see `getGroupUniqueKey`), not display
    // labels. Relabel them here for display so an empty value renders as a
    // friendly label instead of a raw key, while leaving the matching logic in
    // `getSeries*` (which relies on the raw key) untouched.
    let finalLegendData = legendData;
    let finalSeries = series;

    if (groupByFiledId) {
      const labels = this.mapKeysToLabels(groupByFiledId, legendData);
      const keyToLabel = new Map(legendData.map((key, index) => [key, labels[index]]));

      finalLegendData = labels;
      finalSeries = series.map((item) => ({
        ...item,
        name: keyToLabel.get(item.name) ?? item.name,
      }));
    }

    // Keep the empty x-axis bucket in a stable, predictable position (last)
    // instead of wherever it happened to land in the underlying query result
    // order. This permutation is applied uniformly to the categories AND every
    // series' data array (by index) so it never desyncs a series from its
    // category — some `getSeries*` branches build `data` positionally against
    // `this.result` rather than by re-looking-up each x value.
    const order = this.getEmptyLastOrder(xData);
    const orderedXData = order.map((index) => finalXData[index]);
    const orderedSeries = finalSeries.map((item) => ({
      ...item,
      data: order.map((index) => item.data[index]),
    }));

    return {
      xData: orderedXData,
      legendData: finalLegendData,
      rawData: this.result,
      series: orderedSeries,
    };
  }

  private getEmptyLastOrder(keys: string[]): number[] {
    const indices = keys.map((_, index) => index);
    const emptyIndex = keys.indexOf(EMPTY_GROUP_KEY);
    if (emptyIndex === -1) {
      return indices;
    }
    return [...indices.filter((index) => index !== emptyIndex), emptyIndex];
  }

  private mapKeysToLabels(fieldId: string, keys: string[]): string[] {
    const grouped = groupBy(this.result, (item) => getGroupUniqueKey(item[fieldId]));
    const field = this.fields.find((f) => f.id === fieldId);
    return keys.map((key) =>
      formatGroupDisplayValue(field, grouped[key]?.[0]?.[fieldId], this.emptyLabel)
    );
  }

  getRealXData(xData: string[]) {
    const { query } = this.storage;
    const { xAxis } = query;
    const grouped = groupBy(this.result, (item) => getGroupUniqueKey(item[xAxis]));
    const field = this.fields.find((field) => field.id === xAxis);
    return xData.map((x) => {
      const groupedItem = grouped[x]?.[0]?.[xAxis];
      return formatGroupDisplayValue(field, groupedItem, this.emptyLabel);
    });
  }

  private getXData(): string[] {
    const { query } = this.storage;
    const { xAxis } = query;

    const grouped = groupBy(this.result, (item) => getGroupUniqueKey(item[xAxis]));

    // NOTE: intentionally left in natural (query result) order here — some
    // `getSeries*` branches build series data positionally against
    // `this.result`, so this list must stay index-aligned with that. The
    // empty-bucket-last ordering is applied afterwards in `getData()` via
    // `getEmptyLastOrder`, uniformly across xData and every series.
    return Object.keys(grouped).slice(0, MAX_X_DATA_LENGTH);
  }

  /**
   * Keep the empty-value bucket in a stable, predictable position (last)
   * instead of wherever it happened to land in the underlying query result
   * order, so the UI doesn't show it jumping around between renders/datasets.
   */
  private sortEmptyGroupLast(keys: string[]): string[] {
    if (!keys.includes(EMPTY_GROUP_KEY)) {
      return keys;
    }
    return [...keys.filter((key) => key !== EMPTY_GROUP_KEY), EMPTY_GROUP_KEY];
  }

  private buildLegendData(): string[] {
    const { query } = this.storage;
    const { seriesArray } = query;
    const countAll = seriesArray === 'COUNTA';

    // no need legend data
    if (countAll) {
      return this.getLegendDataByCountAll();
    }

    return this.getLegendDataByFieldValue();
  }

  private getLegendDataByCountAll(): string[] {
    const { groupBy: groupByFiledId } = this.storage.query;

    if (groupByFiledId) {
      const keys = Object.keys(
        groupBy(this.result, (item) => getGroupUniqueKey(item[groupByFiledId]))
      );
      return this.sortEmptyGroupLast(keys);
    }

    return ['count'];
  }

  private getLegendDataByFieldValue(): string[] {
    const { seriesArray, groupBy: groupByFiledId } = this.storage.query;
    const fieldMap = this.getFieldMap();

    if (groupByFiledId) {
      const keys = Object.keys(
        groupBy(this.result, (item) => getGroupUniqueKey(item[groupByFiledId]))
      );
      return this.sortEmptyGroupLast(keys);
    }

    return Array.isArray(seriesArray) ? seriesArray.map(({ column }) => fieldMap?.[column]) : [];
  }

  getSeries(xData: string[], legendData: string[]): ISeriesConfig[] {
    const { query } = this.storage;
    const { seriesArray } = query;
    const countAll = seriesArray === 'COUNTA';

    if (countAll) {
      return this.getSeriesByCountAll(xData, legendData);
    }

    return this.getSeriesByFieldValue(xData, legendData);
  }

  private getSeriesByCountAll(xData: string[], legendData: string[]): ISeriesConfig[] {
    const { groupBy: groupByFiledId, xAxis } = this.storage.query;

    if (!groupByFiledId) {
      const countArray = this.result.map(
        (item) => this.getValueByKey(item, AGGREGATE_COUNT_KEY) as number
      );
      return legendData.map((name) => ({
        name,
        data: countArray,
      }));
    }

    const groupByData = groupBy(this.result, (item) => getGroupUniqueKey(item[groupByFiledId]));

    return legendData.map((name) => {
      const currentGroup = groupByData[name];
      return {
        name,
        data: xData.map((xName) => {
          const item = currentGroup?.find((item) => getGroupUniqueKey(item[xAxis]) === xName);
          return item?.[AGGREGATE_COUNT_KEY] || 0;
        }),
      };
    }) as ISeriesConfig[];
  }

  private getSeriesByFieldValue(xData: string[], legendData: string[]): ISeriesConfig[] {
    const { seriesArray, xAxis, groupBy: groupByFiledId } = this.storage.query;
    if (Array.isArray(seriesArray) && seriesArray.length < 2) {
      if (!groupByFiledId) {
        const name = legendData[0];
        const rollup = seriesArray[0]?.rollup;
        const key = `${name}_${rollup}`;
        return [
          {
            name: legendData[0],
            data: this.result.map((item) => item?.[key] as number),
          },
        ] as ISeriesConfig[];
      }

      const fieldMap = this.getFieldMap();
      const groupByData = groupBy(this.result, (item) => getGroupUniqueKey(item[xAxis]));

      return legendData.map((name) => {
        const keyName = fieldMap?.[seriesArray[0]?.column];
        const key = `${keyName}_${seriesArray[0]?.rollup}`;
        return {
          name,
          data: xData.map((xName) => {
            const item = groupByData?.[xName]?.find(
              (item) => getGroupUniqueKey(item[groupByFiledId]) === name
            );
            return item?.[key] || 0;
          }),
        };
      }) as ISeriesConfig[];
    }

    return legendData.map((name, index) => {
      const rollup = Array.isArray(seriesArray) ? seriesArray[index]?.rollup : undefined;
      const key = `${name}_${rollup}`;

      return {
        name,
        data: xData.map((xName) => {
          const item = this.result?.find((item) => getGroupUniqueKey(item[xAxis]) === xName);
          return item?.[key] || 0;
        }),
      };
    }) as ISeriesConfig[];
  }
}
