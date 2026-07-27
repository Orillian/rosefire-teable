import type { FieldRollup } from '@teable/openapi';

export interface IStatisticFieldItem {
  column: string;
  rollup: FieldRollup;
}
