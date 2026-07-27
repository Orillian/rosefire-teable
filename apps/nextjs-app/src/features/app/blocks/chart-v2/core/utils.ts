import type { IFieldVo } from '@teable/core';
import { createFieldInstance } from '@teable/sdk/model';
import { get } from 'lodash';

/**
 * Internal grouping bucket key used for records that have a genuinely empty
 * (null/undefined) value for the grouped field. This is intentionally NOT the
 * literal string "null" so that a real cell value that happens to be the
 * string "null" is never merged into (or confused with) the empty bucket.
 */
export const EMPTY_GROUP_KEY = '__teable_chart_empty_group__';

/**
 * Fallback label used when no localized empty-value label is supplied by the
 * caller. Callers (React hooks/components) should prefer passing a proper
 * i18n-resolved label (see `sdk:common.empty`) into the chart-v2 adapters/charts.
 */
export const DEFAULT_EMPTY_GROUP_LABEL = 'Empty';

export const getGroupUniqueKey = (value: unknown) => {
  if (value == null) {
    return EMPTY_GROUP_KEY;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object') {
      return value.map((obj) => getObjectCellValueUniqueKey(obj)).join(',');
    }
    return value.join(',');
  }

  if (typeof value === 'object') {
    const objValue = value as Record<string, unknown>;
    return getObjectCellValueUniqueKey(objValue);
  }

  return String(value);
};

const getObjectCellValueUniqueKey = (value: Record<string, unknown>) => {
  return get(value, 'id') || get(value, 'title') || get(value, 'name');
};

export const getGroupKeyName = (field: IFieldVo, value: unknown) => {
  const fieldInstance = createFieldInstance(field);
  return fieldInstance.cellValue2String(value);
};

/**
 * Single chokepoint for turning a raw grouped cell value into a user-facing
 * display label across all chart-v2 surfaces (x-axis categories, legend
 * entries, tooltips, and pie slice labels).
 *
 * A genuinely empty value (`null`/`undefined`) always renders as the supplied
 * friendly `emptyLabel` — never a raw "null"/"undefined" string. A real value
 * that happens to be the string "null" (or any other value) is preserved and
 * formatted normally via the field's own `cellValue2String`.
 */
export const formatGroupDisplayValue = (
  field: IFieldVo | undefined,
  rawValue: unknown,
  emptyLabel: string = DEFAULT_EMPTY_GROUP_LABEL
): string => {
  if (rawValue === null || rawValue === undefined) {
    return emptyLabel;
  }

  if (!field) {
    return String(rawValue);
  }

  return getGroupKeyName(field, rawValue);
};
