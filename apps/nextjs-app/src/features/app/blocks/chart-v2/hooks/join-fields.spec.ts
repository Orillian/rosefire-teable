import type { IFieldVo } from '@teable/core';
import { FieldType } from '@teable/core';
import { describe, expect, it } from 'vitest';
import { mergeJoinedFields, resolveForeignTableId } from './join-fields';

const linkField = {
  id: 'fldLink',
  type: FieldType.Link,
  options: { foreignTableId: 'tblProfiles' },
} as unknown as IFieldVo;

const numberField = {
  id: 'fldAmount',
  type: FieldType.Number,
} as unknown as IFieldVo;

describe('resolveForeignTableId', () => {
  it('returns undefined when there is no join configured', () => {
    expect(resolveForeignTableId([linkField, numberField], undefined)).toBeUndefined();
    expect(resolveForeignTableId([linkField, numberField], null)).toBeUndefined();
  });

  it("resolves the foreign table id from the join's link field", () => {
    expect(resolveForeignTableId([linkField, numberField], { linkFieldId: 'fldLink' })).toBe(
      'tblProfiles'
    );
  });

  it('returns undefined when the referenced field id does not exist', () => {
    expect(
      resolveForeignTableId([linkField, numberField], { linkFieldId: 'fldMissing' })
    ).toBeUndefined();
  });

  it('returns undefined when the referenced field is not (or no longer) a Link field', () => {
    expect(
      resolveForeignTableId([linkField, numberField], { linkFieldId: 'fldAmount' })
    ).toBeUndefined();
  });
});

describe('mergeJoinedFields', () => {
  it('returns the base fields unchanged when there is no foreign table', () => {
    expect(mergeJoinedFields([numberField], [linkField], undefined)).toEqual([numberField]);
  });

  it('appends the joined fields when a foreign table is resolved', () => {
    const joinedField = { id: 'fldProvince', type: FieldType.SingleSelect } as unknown as IFieldVo;
    expect(mergeJoinedFields([numberField], [joinedField], 'tblProfiles')).toEqual([
      numberField,
      joinedField,
    ]);
  });
});
