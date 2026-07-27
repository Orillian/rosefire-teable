import type { IFieldVo, ILinkFieldOptions } from '@teable/core';
import { FieldType } from '@teable/core';
import type { ITableQueryJoin } from '@teable/openapi';

/**
 * Pure helpers behind `useFields`'s join support, split out so the "which foreign table (if any)
 * should have its fields merged in" and "how to merge them" logic can be unit tested without
 * standing up react-query/storage-context providers.
 */

/**
 * Resolves the linked table id a chart's `query.join` should pull fields from, given the current
 * table's own field list (which must include the join's Link field, found by id) - or `undefined`
 * if there's no join configured, the referenced field is missing, or it isn't actually a Link
 * field (e.g. it was deleted/changed type after the join was saved).
 */
export const resolveForeignTableId = (
  fields: IFieldVo[],
  join: ITableQueryJoin | null | undefined
): string | undefined => {
  if (!join?.linkFieldId) {
    return undefined;
  }
  const linkField = fields.find((field) => field.id === join.linkFieldId);
  if (linkField?.type !== FieldType.Link) {
    return undefined;
  }
  return (linkField.options as ILinkFieldOptions | undefined)?.foreignTableId;
};

/**
 * Merges the linked table's fields onto the base table's fields. Field ids are globally unique in
 * Teable, so a flat concatenation is enough for every existing picker (FieldSelect,
 * StatisticFieldItem, AxisConfig's ColumnSelects) to resolve a joined-table field id with no
 * further changes.
 */
export const mergeJoinedFields = (
  fields: IFieldVo[],
  joinedFields: IFieldVo[],
  foreignTableId: string | undefined
): IFieldVo[] => (foreignTableId ? [...fields, ...joinedFields] : fields);
