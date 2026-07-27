import type { ILinkFieldOptions } from '@teable/core';
import { Relationship } from '@teable/core';
import { describe, expect, it } from 'vitest';
import { isSupportedTableJoin } from './join-support';

const baseOptions: ILinkFieldOptions = {
  relationship: Relationship.ManyOne,
  foreignTableId: 'tblProfiles',
  lookupFieldId: 'fldLookup',
  fkHostTableName: 'orders_db_table',
  selfKeyName: '__id',
  foreignKeyName: '__fk_profile',
};

describe('isSupportedTableJoin', () => {
  it('supports a ManyOne link whose foreign key lives on the charted (Orders) table', () => {
    expect(isSupportedTableJoin(baseOptions, 'orders_db_table')).toBe(true);
  });

  it('supports a OneOne link whose foreign key lives on the charted table', () => {
    expect(
      isSupportedTableJoin({ ...baseOptions, relationship: Relationship.OneOne }, 'orders_db_table')
    ).toBe(true);
  });

  it('rejects a ManyMany link (foreign key hosted on a separate junction table)', () => {
    expect(
      isSupportedTableJoin(
        {
          ...baseOptions,
          relationship: Relationship.ManyMany,
          fkHostTableName: 'junction_orders_profiles',
        },
        'orders_db_table'
      )
    ).toBe(false);
  });

  it('rejects a OneMany link whose foreign key lives on the linked table, not this one', () => {
    expect(
      isSupportedTableJoin(
        {
          ...baseOptions,
          relationship: Relationship.OneMany,
          fkHostTableName: 'profiles_db_table',
        },
        'orders_db_table'
      )
    ).toBe(false);
  });

  it('rejects a ManyOne link traversed from the symmetric (foreign-key-elsewhere) side', () => {
    // Traversing the reverse/symmetric field: relationship still reads ManyOne/OneOne from the
    // link options, but fkHostTableName points at the *other* table.
    expect(
      isSupportedTableJoin(
        { ...baseOptions, fkHostTableName: 'profiles_db_table' },
        'orders_db_table'
      )
    ).toBe(false);
  });
});
