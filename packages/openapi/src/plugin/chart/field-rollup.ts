import type { CellValueType, FieldType } from '@teable/core';
import { CellValueType as CellValueTypeEnum, FieldType as FieldTypeEnum } from '@teable/core';
import { FieldRollup } from './dashboard-query-v2';

export interface IRollupFieldLike {
  type: FieldType;
  cellValueType: CellValueType;
  isMultipleCellValue?: boolean | null;
}

const stripUniqueIfMultiValue = (
  funcs: FieldRollup[],
  isMultipleCellValue?: boolean | null
): FieldRollup[] =>
  isMultipleCellValue
    ? funcs.filter((func) => func !== FieldRollup.Unique && func !== FieldRollup.PercentUnique)
    : funcs;

/**
 * Chart v2's analogue of legacy's `getValidStatisticFunc`
 * (`packages/core/src/models/aggregation/statistic.ts`), used both to gate the series function
 * picker in the config UI and to validate a stored chart's `seriesArray` server-side before
 * building SQL from it.
 *
 * Mirrors legacy's per-field-type validity table function-for-function, with one documented
 * exception: on a multi-value field (multi-select, multi-collaborator, multi-link -
 * `isMultipleCellValue`), `Unique`/`PercentUnique` are excluded. Legacy computes those via a
 * dedicated multi-value aggregation adapter that unnests the field's JSON array
 * (`jsonb_array_elements_text`) before applying `COUNT(DISTINCT ...)`; chartv2's query pipeline
 * (`PluginChartService.applyGroupByAndSeries`) has no equivalent adapter yet, so it cannot compute
 * a correct distinct-count over a multi-value column. Every other function - including on
 * multi-value fields, and including `Count`/`Empty`/`Filled`/`PercentEmpty`/`PercentFilled`, which
 * only need a plain null-check and are unaffected by cardinality within the array - is fully
 * ported and behaves identically to legacy.
 */
export const getValidFieldRollup = (field?: IRollupFieldLike): FieldRollup[] => {
  if (!field) {
    return [];
  }

  const { type, cellValueType, isMultipleCellValue } = field;

  if (type === FieldTypeEnum.Link) {
    return [
      FieldRollup.Count,
      FieldRollup.Empty,
      FieldRollup.Filled,
      FieldRollup.PercentEmpty,
      FieldRollup.PercentFilled,
    ];
  }

  if ([FieldTypeEnum.User, FieldTypeEnum.CreatedBy, FieldTypeEnum.LastModifiedBy].includes(type)) {
    return stripUniqueIfMultiValue(
      [
        FieldRollup.Count,
        FieldRollup.Empty,
        FieldRollup.Filled,
        FieldRollup.Unique,
        FieldRollup.PercentEmpty,
        FieldRollup.PercentFilled,
        FieldRollup.PercentUnique,
      ],
      isMultipleCellValue
    );
  }

  switch (cellValueType) {
    case CellValueTypeEnum.String: {
      if (type === FieldTypeEnum.Attachment) {
        // Attachment cells are always stored as a JSON array, but the array holds the
        // attachments *of a single cell* (not "multiple distinct dimension values" the way a
        // multi-select does) - TotalAttachmentSize sums sizes across that array directly via a
        // single SQL expression regardless of `isMultipleCellValue`, matching legacy exactly.
        return [
          FieldRollup.Count,
          FieldRollup.Empty,
          FieldRollup.Filled,
          FieldRollup.PercentEmpty,
          FieldRollup.PercentFilled,
          FieldRollup.TotalAttachmentSize,
        ];
      }
      return stripUniqueIfMultiValue(
        [
          FieldRollup.Count,
          FieldRollup.Empty,
          FieldRollup.Filled,
          FieldRollup.Unique,
          FieldRollup.PercentEmpty,
          FieldRollup.PercentFilled,
          FieldRollup.PercentUnique,
        ],
        isMultipleCellValue
      );
    }
    case CellValueTypeEnum.Number:
      // Number fields are never multi-value in Teable's model.
      return [
        FieldRollup.Sum,
        FieldRollup.Avg,
        FieldRollup.Min,
        FieldRollup.Max,
        FieldRollup.Count,
        FieldRollup.Empty,
        FieldRollup.Filled,
        FieldRollup.Unique,
        FieldRollup.PercentEmpty,
        FieldRollup.PercentFilled,
        FieldRollup.PercentUnique,
      ];
    case CellValueTypeEnum.DateTime:
      // Date/time fields are never multi-value in Teable's model.
      return [
        FieldRollup.Count,
        FieldRollup.Empty,
        FieldRollup.Filled,
        FieldRollup.Unique,
        FieldRollup.PercentEmpty,
        FieldRollup.PercentFilled,
        FieldRollup.PercentUnique,
        FieldRollup.EarliestDate,
        FieldRollup.LatestDate,
        FieldRollup.DateRangeOfDays,
        FieldRollup.DateRangeOfMonths,
      ];
    case CellValueTypeEnum.Boolean:
      return [
        FieldRollup.Count,
        FieldRollup.Checked,
        FieldRollup.UnChecked,
        FieldRollup.PercentChecked,
        FieldRollup.PercentUnChecked,
      ];
    default:
      return [FieldRollup.Count];
  }
};
