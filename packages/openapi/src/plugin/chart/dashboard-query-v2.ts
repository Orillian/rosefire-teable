import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import type { IFilter } from '@teable/core';
import { axios } from '../../axios';
import { registerRoute, urlBuilder } from '../../utils';
import { z } from '../../zod';

export const GET_DASHBOARD_INSTALL_PLUGIN_QUERY_V2 =
  '/plugin/chart/{pluginInstallId}/dashboard/{positionId}/query/v2';

export const baseQuerySchemaVoV2 = z.object({
  result: z.array(z.record(z.string(), z.unknown())),
  columns: z.array(
    z.object({
      name: z.string(),
      isNumber: z.boolean(),
    })
  ),
});

export type IBaseQueryVoV2 = z.infer<typeof baseQuerySchemaVoV2>;

export enum ChartType {
  Bar = 'bar',
  Pie = 'pie',
  Line = 'line',
  Area = 'area',
  DonutChart = 'donutChart',
}

export enum DataSource {
  Table = 'table',
  Sql = 'sql',
}

/**
 * Aggregation/statistic functions selectable for a chart v2 series column.
 *
 * Ported from legacy's `StatisticsFunc` (`packages/core/src/models/aggregation/statistics-func.enum.ts`)
 * to reach capability parity - see `getValidFieldRollup` in `./field-rollup` for which functions are
 * valid for which field type, and for the one documented gap versus legacy: `Unique`/`PercentUnique`
 * are not supported on multi-value fields (multi-select, multi-collaborator, multi-link) because
 * chartv2's query pipeline (`PluginChartService.applyGroupByAndSeries`) aggregates a field's db column
 * directly and has no equivalent of legacy's multiple-value aggregation adapter, which unnests JSON
 * arrays (`jsonb_array_elements_text`) before computing DISTINCT. Every other function - including on
 * multi-value fields - is fully ported.
 */
export enum FieldRollup {
  Sum = 'sum',
  Avg = 'avg',
  Min = 'min',
  Max = 'max',
  Count = 'count',
  Empty = 'empty',
  Filled = 'filled',
  Unique = 'unique',
  PercentEmpty = 'percentEmpty',
  PercentFilled = 'percentFilled',
  PercentUnique = 'percentUnique',
  Checked = 'checked',
  UnChecked = 'unChecked',
  PercentChecked = 'percentChecked',
  PercentUnChecked = 'percentUnChecked',
  EarliestDate = 'earliestDate',
  LatestDate = 'latestDate',
  DateRangeOfDays = 'dateRangeOfDays',
  DateRangeOfMonths = 'dateRangeOfMonths',
  TotalAttachmentSize = 'totalAttachmentSize',
}

export interface ITableQuery {
  tableId: string;
  viewId: string;
  orderBy: {
    on: string;
    order: 'asc' | 'desc';
  };
  filter: IFilter;
  groupBy: string | null;
  xAxis: string;
  seriesArray: string | { column: string; rollup: FieldRollup }[];
}

interface IBaseAppearance {
  theme: string;
}

export interface IChartAppearance extends IBaseAppearance {
  legendVisible: boolean;
  labelVisible: boolean;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export interface ISqlQuery {
  sql: string | null;
}

export interface IBaseConfig {
  [key: string]: unknown;
}
export interface ISqlConfig extends IBaseConfig {
  xAxis: string;
  yAxis: string[];
}

export interface IChartStorage<T extends ITableQuery | ISqlQuery = ITableQuery | ISqlQuery> {
  chartType: ChartType;
  dataSource: DataSource;
  query: T;
  // config not make the result change
  config: ISqlConfig;
  appearance: IChartAppearance;
}

export const GetDashboardInstallPluginQueryV2Route: RouteConfig = registerRoute({
  method: 'get',
  path: GET_DASHBOARD_INSTALL_PLUGIN_QUERY_V2,
  description: 'Get a dashboard install plugin query by id',
  request: {
    params: z.object({
      pluginInstallId: z.string(),
      positionId: z.string(),
    }),
    query: z.object({
      baseId: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Returns data about the dashboard install plugin query.',
      content: {
        'application/json': {
          schema: baseQuerySchemaVoV2,
        },
      },
    },
  },
  tags: ['plugin', 'chart', 'dashboard'],
});

export const getDashboardInstallPluginQueryV2 = async (
  pluginInstallId: string,
  positionId: string,
  baseId: string
) => {
  return axios.get<IBaseQueryVoV2>(
    urlBuilder(GET_DASHBOARD_INSTALL_PLUGIN_QUERY_V2, { pluginInstallId, positionId }),
    {
      params: {
        baseId,
      },
    }
  );
};
