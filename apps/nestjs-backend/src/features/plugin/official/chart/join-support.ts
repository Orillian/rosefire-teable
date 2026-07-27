import type { ILinkFieldOptions } from '@teable/core';
import { Relationship } from '@teable/core';

/**
 * Chart v2's join support is deliberately scoped to a single hop: a `Link` field on the charted
 * table whose foreign key column is hosted on that same table (`fkHostTableName === dbTableName`)
 * - the shape of "many Orders each link to one Profile". This covers the relationship direction
 * `ManyOne`/`OneOne` when the FK lives on this side.
 *
 * Explicitly NOT supported (mirrors the exclusions documented on `ITableQueryJoin`):
 * - `ManyMany` (foreign key hosted on a separate junction table)
 * - `OneMany` (foreign key hosted on the *linked* table, not this one) - e.g. traversing a Profile's
 *   own "Orders" reverse-link field
 * - a `ManyOne`/`OneOne` link whose symmetric field is being traversed instead of the FK-owning side
 *
 * Ported reference: `apps/nestjs-backend/src/features/record/query-builder/field-cte-visitor.ts`
 * builds the general case (all four relationship shapes, including the junction-table join) for
 * the record CTE pipeline; this is the minimal slice of that logic needed for the chart join.
 */
export const isSupportedTableJoin = (options: ILinkFieldOptions, dbTableName: string): boolean => {
  const { relationship, fkHostTableName } = options;
  const isDirectRelationship =
    relationship === Relationship.ManyOne || relationship === Relationship.OneOne;
  return isDirectRelationship && fkHostTableName === dbTableName;
};
