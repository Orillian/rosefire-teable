import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { IFilter, ISortItem, ILinkFieldOptions, FieldType, CellValueType } from '@teable/core';
import { mergeWithDefaultFilter, mergeWithDefaultSort } from '@teable/core';
import { PrismaService } from '@teable/db-main-prisma';
import type {
  ISqlQuery,
  ITableQuery,
  ITableQueryJoin,
  IChartStorage,
  IBaseQueryVoV2,
  ITestSqlRo,
  FieldRollup,
} from '@teable/openapi';
import { DataSource, AGGREGATE_COUNT_KEY, getValidFieldRollup } from '@teable/openapi';
import { Knex } from 'knex';
import { keyBy } from 'lodash';
import { InjectModel } from 'nest-knexjs';
import { BaseSqlExecutorService } from '../../../base-sql-executor/base-sql-executor.service';
import { DashboardService } from '../../../dashboard/dashboard.service';
import { FieldService } from '../../../field/field.service';
import { PluginPanelService } from '../../../plugin-panel/plugin-panel.service';
import { RecordService } from '../../../record/record.service';
import { isSupportedTableJoin } from './join-support';
import { buildRollupExpression } from './rollup-expression';

const JOINED_TABLE_ALIAS = 'joined_table';
const MAIN_TABLE_ALIAS = 'filtered_records';
const MAIN_RAW_TABLE_ALIAS = 'main_raw';

interface IChartField {
  id: string;
  dbFieldName: string;
  name: string;
  type: string;
  cellValueType: string;
  isMultipleCellValue?: boolean | null;
}

interface IQualifiedChartField extends IChartField {
  /** dbFieldName qualified with the alias it is actually selected from - use this in SQL. */
  qualifiedDbFieldName: string;
}

@Injectable()
export class PluginChartService {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly pluginPanelService: PluginPanelService,
    private readonly recordService: RecordService,
    private readonly fieldService: FieldService,
    private readonly prismaService: PrismaService,
    private readonly baseSqlExecutorService: BaseSqlExecutorService,
    @InjectModel('CUSTOM_KNEX') private readonly knex: Knex
  ) {}

  async getDashboardSqlResult(baseId: string, storage: { query: ISqlQuery }) {
    const sql = storage?.query?.sql;

    if (!sql) {
      return {
        result: [],
        columns: [],
      };
    }

    const result = await this.baseSqlExecutorService.executeQuerySql<{ [key: string]: unknown }[]>(
      baseId,
      sql
    );

    if (result.length === 0) {
      return {
        result: [],
        columns: [],
      };
    }

    // Convert BigInt to Number for JSON serialization
    const convertedResult = result.map((row) => {
      const converted: { [key: string]: unknown } = {};
      for (const [key, value] of Object.entries(row)) {
        converted[key] = typeof value === 'bigint' ? Number(value) : value;
      }
      return converted;
    });

    const columnKeys = convertedResult[0] ? Object.keys(convertedResult[0]) : [];

    const columns = columnKeys.map((key) => {
      return {
        name: key,
        isNumber: typeof convertedResult[0][key] === 'number',
      };
    });

    return {
      result: convertedResult,
      columns: columns,
    };
  }

  private async buildViewQuery(
    viewId: string | undefined,
    filter: IFilter | undefined
  ): Promise<{ filter?: IFilter | null; sort?: ISortItem[] | null }> {
    const viewQuery = {} as { filter?: IFilter | null; sort?: ISortItem[] | null };

    if (viewId) {
      const { filter: viewFilter, sort: viewSort } =
        (await this.prismaService.txClient().view.findFirst({
          where: {
            id: viewId,
          },
          select: {
            filter: true,
            sort: true,
          },
        })) || {};
      viewQuery.filter = mergeWithDefaultFilter(viewFilter, filter);
      viewQuery.sort = mergeWithDefaultSort(viewSort, []);
    }

    return viewQuery;
  }

  private applyGroupByAndSeries(
    queryBuilder: Knex.QueryBuilder,
    fields: Array<IQualifiedChartField>,
    xAxis: string | string[] | undefined,
    groupBy: string | undefined,
    seriesArray: string | Array<{ column: string; rollup: FieldRollup }> | undefined
  ): void {
    if (xAxis && typeof xAxis === 'string') {
      const dbFieldName = fields.find((field) => field.id === xAxis)?.qualifiedDbFieldName;
      queryBuilder.select({ [xAxis]: dbFieldName });
      queryBuilder.groupBy(xAxis);
    }
    if (groupBy) {
      const dbFieldName = fields.find((field) => field.id === groupBy)?.qualifiedDbFieldName;
      queryBuilder.select({ [groupBy]: dbFieldName });
      queryBuilder.groupBy(groupBy);
    }
    if (Array.isArray(seriesArray) && seriesArray.length) {
      seriesArray.forEach((item) => {
        const field = fields.find((field) => field.id === item.column);
        if (!field || !item?.rollup) {
          return;
        }
        const validRollups = getValidFieldRollup({
          type: field.type as FieldType,
          cellValueType: field.cellValueType as CellValueType,
          isMultipleCellValue: field.isMultipleCellValue,
        });
        if (!validRollups.includes(item.rollup)) {
          throw new BadRequestException(
            `Rollup "${item.rollup}" is not supported for field "${field.name}" (type: ${field.type})`
          );
        }
        const expression = buildRollupExpression(
          this.knex,
          field.qualifiedDbFieldName,
          field.dbFieldName,
          item.rollup
        );
        if (!expression) {
          throw new NotFoundException('Unsupported rollup method');
        }
        queryBuilder.select(expression.raw);
      });
    } else {
      queryBuilder.select(this.knex.raw(`COUNT(*) as ${AGGREGATE_COUNT_KEY}`));
    }
  }

  private getYColumnForOrderBy(
    groupBy: string | undefined,
    seriesArray: string | Array<{ column: string; rollup: FieldRollup }> | undefined,
    fields: Array<IQualifiedChartField>,
    fieldsMap: Record<string, IQualifiedChartField>
  ): string {
    if (groupBy) {
      const groupByField = fields.find((field) => field.id === groupBy);
      if (!groupByField?.dbFieldName) {
        throw new NotFoundException('Group by field not found');
      }
      return groupByField.dbFieldName;
    }
    if (Array.isArray(seriesArray)) {
      const seriesNames = seriesArray
        .map((item) => {
          const field = fieldsMap[item.column];
          return field ? `${field.name}_${item.rollup}` : null;
        })
        .filter((name): name is string => name !== null);
      if (seriesNames.length === 0) {
        throw new NotFoundException('Series fields not found');
      }
      return seriesNames[0];
    }
    return AGGREGATE_COUNT_KEY;
  }

  private applyOrderBy(
    queryBuilder: Knex.QueryBuilder,
    orderBy: { on: string; order: string } | undefined,
    xAxis: string | string[] | undefined,
    groupBy: string | undefined,
    seriesArray: string | Array<{ column: string; rollup: FieldRollup }> | undefined,
    fields: Array<IQualifiedChartField>,
    fieldsMap: Record<string, IQualifiedChartField>
  ): void {
    if (!orderBy) {
      return;
    }

    const { on, order } = orderBy;
    const xAxisField =
      xAxis && typeof xAxis === 'string' ? fields.find((field) => field.id === xAxis) : undefined;
    const dbFieldName = xAxisField?.qualifiedDbFieldName;

    if (!dbFieldName) {
      throw new NotFoundException('X-axis field not found');
    }

    const yColumn = this.getYColumnForOrderBy(groupBy, seriesArray, fields, fieldsMap);
    queryBuilder.orderBy(on === 'xAxis' ? dbFieldName : yColumn, order);
  }

  /**
   * Resolves `query.join` into the info needed to add a single `LEFT JOIN` onto the linked
   * table, plus its field list. Only the single-hop, FK-on-this-table case is supported - see
   * `isSupportedTableJoin` and the docs on `ITableQueryJoin`.
   */
  private async resolveJoin(
    tableId: string,
    dbTableName: string,
    join: ITableQueryJoin | null | undefined
  ): Promise<{
    foreignDbTableName: string;
    foreignKeyName: string;
    foreignFields: IChartField[];
  } | null> {
    if (!join?.linkFieldId) {
      return null;
    }

    const linkField = await this.prismaService.txClient().field.findFirst({
      where: { id: join.linkFieldId, tableId, type: 'link', deletedTime: null },
      select: { id: true, options: true },
    });

    if (!linkField?.options) {
      throw new NotFoundException('Join link field not found');
    }

    const options = JSON.parse(linkField.options) as ILinkFieldOptions;

    if (!isSupportedTableJoin(options, dbTableName)) {
      throw new BadRequestException(
        'Chart v2 joins currently support only many-to-one / one-to-one links whose foreign key ' +
          'is stored on the charted table (e.g. "many Orders link to one Profile"). Many-to-many ' +
          'links and links whose key is hosted on the linked table are not supported yet.'
      );
    }

    const foreignTableMeta = await this.prismaService.txClient().tableMeta.findUnique({
      where: { id: options.foreignTableId },
      select: { dbTableName: true },
    });

    if (!foreignTableMeta) {
      throw new NotFoundException('Linked table not found');
    }

    const foreignFields = await this.prismaService.txClient().field.findMany({
      where: { tableId: options.foreignTableId, deletedTime: null },
      select: {
        id: true,
        dbFieldName: true,
        name: true,
        type: true,
        cellValueType: true,
        isMultipleCellValue: true,
      },
    });

    return {
      foreignDbTableName: foreignTableMeta.dbTableName,
      foreignKeyName: options.foreignKeyName,
      foreignFields,
    };
  }

  private convertQueryResult(
    result: { [key: string]: number }[],
    fields: Array<{ id: string; dbFieldName: string; name: string }>
  ): { result: { [key: string]: number }[]; columns: Array<{ name: string; isNumber: boolean }> } {
    const fieldNameMap = new Map<string, string>();
    fields.forEach((field) => {
      fieldNameMap.set(field.dbFieldName, field.name);
    });

    const convertedResult = result.map((row) => {
      const converted: { [key: string]: number } = {};
      for (const [key, value] of Object.entries(row)) {
        const name = fieldNameMap.get(key) || key;
        converted[name] = typeof value === 'bigint' ? Number(value) : value;
      }
      return converted;
    });

    const columnKeys = convertedResult[0] ? Object.keys(convertedResult[0]) : [];
    const columns = columnKeys.map((key) => {
      return {
        name: key,
        isNumber: typeof convertedResult[0]?.[key] === 'number',
      };
    });

    return {
      result: convertedResult,
      columns,
    };
  }

  async getTableResult(storage: IChartStorage) {
    const { query } = storage;
    const { tableId, groupBy, seriesArray, xAxis, viewId, filter, orderBy, join } =
      query as ITableQuery;

    if (Array.isArray(xAxis) && xAxis.length === 0) {
      return {
        result: [],
        columns: [],
      };
    }

    const ownFields: IChartField[] = await this.prismaService.txClient().field.findMany({
      where: {
        tableId,
        deletedTime: null,
      },
      select: {
        id: true,
        dbFieldName: true,
        name: true,
        type: true,
        cellValueType: true,
        isMultipleCellValue: true,
      },
    });

    const viewQuery = await this.buildViewQuery(viewId, filter);

    const { queryBuilder: mainQueryBuilder } = await this.recordService.buildFilterSortQuery(
      tableId,
      {
        ...viewQuery,
      }
    );

    const dbTableName = await this.prismaService
      .txClient()
      .tableMeta.findUnique({
        where: { id: tableId },
        select: { dbTableName: true },
      })
      .then((meta) => meta?.dbTableName);

    if (!dbTableName) {
      throw new NotFoundException('Table not found');
    }

    const joinInfo = await this.resolveJoin(tableId, dbTableName, join);

    const fields: IQualifiedChartField[] = [
      ...ownFields.map((field) => ({
        ...field,
        qualifiedDbFieldName: `${MAIN_TABLE_ALIAS}.${field.dbFieldName}`,
      })),
      ...(joinInfo?.foreignFields ?? []).map((field) => ({
        ...field,
        qualifiedDbFieldName: `${JOINED_TABLE_ALIAS}.${field.dbFieldName}`,
      })),
    ];

    const fieldsMap = keyBy(fields, 'id');

    let queryBuilder = this.knex.from(mainQueryBuilder.as(MAIN_TABLE_ALIAS));

    if (joinInfo) {
      // `filtered_records` is the *field-visitor-projected* view of the table (it represents Link
      // fields via their computed/CTE-joined shape, not necessarily the bare FK column), so the
      // join can't safely assume `joinInfo.foreignKeyName` is one of its selected columns. Hop
      // through the table's own raw physical row (keyed by the always-selected `__id`) instead,
      // where the FK column is guaranteed to exist as an ordinary column.
      queryBuilder = queryBuilder
        .leftJoin(`${dbTableName} as ${MAIN_RAW_TABLE_ALIAS}`, function () {
          this.on(`${MAIN_TABLE_ALIAS}.__id`, '=', `${MAIN_RAW_TABLE_ALIAS}.__id`);
        })
        .leftJoin(`${joinInfo.foreignDbTableName} as ${JOINED_TABLE_ALIAS}`, function () {
          this.on(
            `${MAIN_RAW_TABLE_ALIAS}.${joinInfo.foreignKeyName}`,
            '=',
            `${JOINED_TABLE_ALIAS}.__id`
          );
        });
    }

    this.applyGroupByAndSeries(
      queryBuilder,
      fields,
      xAxis ?? undefined,
      groupBy ?? undefined,
      seriesArray
    );

    this.applyOrderBy(
      queryBuilder,
      orderBy,
      xAxis ?? undefined,
      groupBy ?? undefined,
      seriesArray,
      fields,
      fieldsMap
    );

    queryBuilder.limit(1000);

    const sql = queryBuilder.toQuery();
    console.log('dashboardPluginQueryV3:sql: ', sql);

    const result = await this.prismaService
      .txClient()
      .$queryRawUnsafe<{ [key: string]: number }[]>(sql);

    return this.convertQueryResult(result, fields);
  }

  async testSql(testSqlRo: ITestSqlRo) {
    const { baseId, sql } = testSqlRo;

    if (!sql) {
      return {
        result: [],
        columns: [],
      };
    }

    const result = await this.baseSqlExecutorService.executeQuerySql<{ [key: string]: unknown }[]>(
      baseId,
      sql
    );

    if (result.length === 0) {
      return {
        result: [],
        columns: [],
      };
    }

    // Convert BigInt to Number for JSON serialization
    const convertedResult = result.map((row) => {
      const converted: { [key: string]: unknown } = {};
      for (const [key, value] of Object.entries(row)) {
        converted[key] = typeof value === 'bigint' ? Number(value) : value;
      }
      return converted;
    });

    const columnKeys = convertedResult[0] ? Object.keys(convertedResult[0]) : [];

    const columns = columnKeys.map((key) => {
      return {
        name: key,
        isNumber: typeof convertedResult[0][key] === 'number',
      };
    });

    return {
      result: convertedResult,
      columns: columns,
    };
  }

  async getDashboardPluginQueryV2(
    baseId: string,
    pluginInstallId: string,
    positionId: string
  ): Promise<IBaseQueryVoV2> {
    const { storage } = await this.dashboardService.getPluginInstall(
      baseId,
      positionId,
      pluginInstallId
    );
    const { dataSource } = storage as unknown as IChartStorage;

    if (dataSource === DataSource.Sql) {
      return await this.getDashboardSqlResult(
        baseId,
        storage as unknown as IChartStorage<ISqlQuery>
      );
    }

    return await this.getTableResult(storage as unknown as IChartStorage<ITableQuery>);
  }

  async getPluginPanelPluginQueryV2(
    tableId: string,
    pluginInstallId: string,
    positionId: string
  ): Promise<IBaseQueryVoV2> {
    const baseId = await this.pluginPanelService.getBaseId(tableId);

    const { storage } = await this.pluginPanelService.getPluginPanelPlugin(
      tableId,
      positionId,
      pluginInstallId
    );

    const { dataSource } = storage as unknown as IChartStorage;

    if (dataSource === DataSource.Sql) {
      return await this.getDashboardSqlResult(
        baseId,
        storage as unknown as IChartStorage<ISqlQuery>
      );
    }

    return await this.getTableResult(storage as unknown as IChartStorage<ITableQuery>);
  }

  async getSchemaByBaseId(baseId: string) {
    const tableRecords = await this.prismaService.txClient().tableMeta.findMany({
      where: {
        baseId,
        deletedTime: null,
      },
      select: {
        dbTableName: true,
      },
    });

    if (!tableRecords.length) {
      return {};
    }

    const tableNames = tableRecords.map((t) => t.dbTableName.split('.').pop());

    const columnSqlQuery = this.knex
      .select({
        tableName: 'table_name',
        columnName: 'column_name',
      })
      .from('information_schema.columns')
      .whereIn('table_name', tableNames as string[])
      .where('table_schema', baseId)
      .toQuery();

    const columns = await this.prismaService
      .txClient()
      .$queryRawUnsafe<{ tableName: string; columnName: string }[]>(columnSqlQuery);

    const schema: Record<string, string[]> = {};

    for (const table of tableRecords) {
      const key = `${table.dbTableName}`;

      const tableColumns = columns
        .filter((col) => col.tableName === table.dbTableName.split('.').pop())
        .map((col) => col.columnName);

      schema[key] = tableColumns;
    }

    return schema;
  }
}
