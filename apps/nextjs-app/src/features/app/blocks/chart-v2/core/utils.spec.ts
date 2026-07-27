import type { IFieldVo } from '@teable/core';
import { CellValueType, DbFieldType, FieldType } from '@teable/core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMPTY_GROUP_LABEL,
  EMPTY_GROUP_KEY,
  formatGroupDisplayValue,
  getGroupUniqueKey,
} from './utils';

const singleSelectField: IFieldVo = {
  id: 'fldProvince00000001',
  name: 'Province',
  dbFieldName: 'province',
  type: FieldType.SingleSelect,
  options: {
    choices: [
      { id: 'choBc00000000001', name: 'BC', color: 'blueBright' },
      { id: 'choOn00000000001', name: 'ON', color: 'redBright' },
      { id: 'choNull0000000001', name: 'null', color: 'grayBright' },
    ],
  },
  unique: false,
  cellValueType: CellValueType.String,
  dbFieldType: DbFieldType.Text,
} as unknown as IFieldVo;

describe('getGroupUniqueKey', () => {
  it('buckets null and undefined into the internal empty-group marker', () => {
    expect(getGroupUniqueKey(null)).toBe(EMPTY_GROUP_KEY);
    expect(getGroupUniqueKey(undefined)).toBe(EMPTY_GROUP_KEY);
  });

  it('does not collide a real string value of "null" with the empty-group marker', () => {
    expect(getGroupUniqueKey('null')).toBe('null');
    expect(getGroupUniqueKey('null')).not.toBe(EMPTY_GROUP_KEY);
  });

  it('passes through regular string values unchanged', () => {
    expect(getGroupUniqueKey('BC')).toBe('BC');
  });
});

describe('formatGroupDisplayValue', () => {
  it('renders a genuinely empty (null) value as the supplied friendly label', () => {
    expect(formatGroupDisplayValue(singleSelectField, null, '(Unset)')).toBe('(Unset)');
  });

  it('renders a genuinely empty (undefined) value as the supplied friendly label', () => {
    expect(formatGroupDisplayValue(singleSelectField, undefined, '(Unset)')).toBe('(Unset)');
  });

  it('falls back to the default label when no label is supplied', () => {
    expect(formatGroupDisplayValue(singleSelectField, null)).toBe(DEFAULT_EMPTY_GROUP_LABEL);
  });

  it('preserves a real cell value that happens to be the string "null"', () => {
    expect(formatGroupDisplayValue(singleSelectField, 'null', '(Unset)')).toBe('null');
  });

  it('formats a real value normally via the field cellValue2String', () => {
    expect(formatGroupDisplayValue(singleSelectField, 'BC', '(Unset)')).toBe('BC');
  });

  it('stringifies raw values when no field metadata is available (e.g. SQL source)', () => {
    expect(formatGroupDisplayValue(undefined, 42, '(Unset)')).toBe('42');
    expect(formatGroupDisplayValue(undefined, null, '(Unset)')).toBe('(Unset)');
  });
});
