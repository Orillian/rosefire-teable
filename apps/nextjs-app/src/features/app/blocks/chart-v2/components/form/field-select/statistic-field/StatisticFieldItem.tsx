import { Trash2 } from '@teable/icons';
import type { FieldRollup } from '@teable/openapi';
import { getValidFieldRollup } from '@teable/openapi';
import { Button } from '@teable/ui-lib/shadcn';
import { useMemo } from 'react';
import { useFields } from '../../../../hooks';
import { FieldSelect } from '../FieldSelect';
import { StatisticFunSelect } from './StatisticFunSelect';
import type { IStatisticFieldItem } from './types';

interface IStaticFieldItemProps {
  allStaticFields: IStatisticFieldItem[];
  value: IStatisticFieldItem;
  onChange: (value: IStatisticFieldItem) => void;
  onDelete: () => void;
}
export const StatisticFieldItem = (props: IStaticFieldItemProps) => {
  const { allStaticFields, value, onChange, onDelete } = props;
  const { fields } = useFields();

  const selectedField = useMemo(
    () => fields.find((field) => field.id === value?.column),
    [fields, value?.column]
  );

  // Which rollup functions are valid depends on the selected field's type - e.g. Sum/Avg only
  // make sense for a Number field, while Checked/UnChecked only make sense for a Boolean field.
  // See getValidFieldRollup for the full per-type table (ported from legacy's
  // getValidStatisticFunc).
  const rollupOptions = useMemo(() => getValidFieldRollup(selectedField), [selectedField]);

  return (
    <div className="flex w-full gap-2">
      <FieldSelect
        selectedFields={allStaticFields.map((field) => field.column)}
        value={value?.column}
        onChange={(property: string) => {
          const nextField = fields.find((field) => field.id === property);
          const validRollups = getValidFieldRollup(nextField);
          onChange({
            column: property,
            // Keep the current rollup if it's still valid for the newly picked field, otherwise
            // fall back to the first valid one instead of silently keeping an invalid selection.
            rollup: validRollups.includes(value?.rollup) ? value.rollup : validRollups[0],
          } as IStatisticFieldItem);
        }}
        className="w-full"
      />

      <StatisticFunSelect
        value={value.rollup}
        options={rollupOptions}
        onChange={(property: FieldRollup) => {
          onChange({
            ...value,
            rollup: property,
          });
        }}
        className="w-full"
      />

      <Button
        variant="outline"
        onClick={onDelete}
        disabled={allStaticFields.length === 1}
        className="size-9 shrink-0 p-0"
      >
        <Trash2 className="size-4 shrink-0 text-destructive" />
      </Button>
    </div>
  );
};
