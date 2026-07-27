import { useQuery } from '@tanstack/react-query';
import type { ITableQuery } from '@teable/openapi';
import { getFields } from '@teable/openapi';
import { useMemo } from 'react';
import { mergeJoinedFields, resolveForeignTableId } from './join-fields';
import { useStorage } from './useStorage';

/**
 * Fields available for xAxis/groupBy/series pickers. When `query.join.linkFieldId` names a
 * (server-validated) Link field on the current table, the linked table's fields are merged in
 * transparently - since Teable field ids are globally unique, every existing picker (`FieldSelect`,
 * `AddFieldButton`, `StatisticFieldItem`, `AxisConfig`'s xAxis/groupBy `ColumnSelect`s) can already
 * resolve a joined-table field id with zero further changes, they just need it to show up here.
 * See `./join-fields` for the (separately unit-tested) pure resolve/merge logic.
 */
export const useFields = () => {
  const { storage } = useStorage();
  const { query } = storage || {};
  const { tableId, join } = (query || {}) as ITableQuery;

  const { data: fields = [] } = useQuery({
    queryKey: ['fields', tableId],
    queryFn: () => getFields(tableId).then((res) => res.data),
    enabled: !!tableId,
  });

  const foreignTableId = resolveForeignTableId(fields, join);

  const { data: joinedFields = [] } = useQuery({
    queryKey: ['fields', foreignTableId, 'joined'],
    queryFn: () => getFields(foreignTableId!).then((res) => res.data),
    enabled: !!foreignTableId,
  });

  const merged = useMemo(
    () => mergeJoinedFields(fields, joinedFields, foreignTableId),
    [fields, joinedFields, foreignTableId]
  );

  return { fields: merged };
};
