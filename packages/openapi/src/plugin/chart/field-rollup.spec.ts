import { CellValueType, FieldType } from '@teable/core';
import { describe, expect, it } from 'vitest';
import { FieldRollup } from './dashboard-query-v2';
import { getValidFieldRollup } from './field-rollup';

describe('getValidFieldRollup', () => {
  it('returns an empty list when no field is given', () => {
    expect(getValidFieldRollup(undefined)).toEqual([]);
  });

  it('ports every legacy numeric statistic for a Number field', () => {
    const result = getValidFieldRollup({
      type: FieldType.Number,
      cellValueType: CellValueType.Number,
    });
    expect(result).toEqual(
      expect.arrayContaining([
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
      ])
    );
  });

  it('exposes the date-range family for a DateTime field', () => {
    const result = getValidFieldRollup({
      type: FieldType.Date,
      cellValueType: CellValueType.DateTime,
    });
    expect(result).toEqual(
      expect.arrayContaining([
        FieldRollup.EarliestDate,
        FieldRollup.LatestDate,
        FieldRollup.DateRangeOfDays,
        FieldRollup.DateRangeOfMonths,
      ])
    );
    // Booleans/percent-checked variants make no sense for a date column.
    expect(result).not.toContain(FieldRollup.Checked);
    expect(result).not.toContain(FieldRollup.Sum);
  });

  it('exposes the checked/unchecked family for a Boolean field, and nothing else', () => {
    const result = getValidFieldRollup({
      type: FieldType.Checkbox,
      cellValueType: CellValueType.Boolean,
    });
    expect(result).toEqual([
      FieldRollup.Count,
      FieldRollup.Checked,
      FieldRollup.UnChecked,
      FieldRollup.PercentChecked,
      FieldRollup.PercentUnChecked,
    ]);
  });

  it('exposes TotalAttachmentSize (but not Unique) for an Attachment field', () => {
    const result = getValidFieldRollup({
      type: FieldType.Attachment,
      cellValueType: CellValueType.String,
      isMultipleCellValue: true,
    });
    expect(result).toContain(FieldRollup.TotalAttachmentSize);
    expect(result).not.toContain(FieldRollup.Unique);
    expect(result).not.toContain(FieldRollup.PercentUnique);
  });

  it('excludes Unique/PercentUnique for a multi-value String field (e.g. multi-select)', () => {
    const singleValue = getValidFieldRollup({
      type: FieldType.SingleSelect,
      cellValueType: CellValueType.String,
      isMultipleCellValue: false,
    });
    expect(singleValue).toContain(FieldRollup.Unique);
    expect(singleValue).toContain(FieldRollup.PercentUnique);

    const multiValue = getValidFieldRollup({
      type: FieldType.MultipleSelect,
      cellValueType: CellValueType.String,
      isMultipleCellValue: true,
    });
    expect(multiValue).not.toContain(FieldRollup.Unique);
    expect(multiValue).not.toContain(FieldRollup.PercentUnique);
    // Everything else survives - the exclusion is narrow, not blanket.
    expect(multiValue).toEqual(
      expect.arrayContaining([
        FieldRollup.Count,
        FieldRollup.Empty,
        FieldRollup.Filled,
        FieldRollup.PercentEmpty,
        FieldRollup.PercentFilled,
      ])
    );
  });

  it('excludes Unique/PercentUnique for a multi-collaborator User field', () => {
    const result = getValidFieldRollup({
      type: FieldType.User,
      cellValueType: CellValueType.String,
      isMultipleCellValue: true,
    });
    expect(result).not.toContain(FieldRollup.Unique);
    expect(result).not.toContain(FieldRollup.PercentUnique);
    expect(result).toContain(FieldRollup.Count);
  });

  it('restricts a Link field to the count/empty/filled family, matching legacy', () => {
    const result = getValidFieldRollup({
      type: FieldType.Link,
      cellValueType: CellValueType.String,
      isMultipleCellValue: true,
    });
    expect(result).toEqual([
      FieldRollup.Count,
      FieldRollup.Empty,
      FieldRollup.Filled,
      FieldRollup.PercentEmpty,
      FieldRollup.PercentFilled,
    ]);
  });
});
