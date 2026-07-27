import type { FieldRollup } from '@teable/openapi';
import { BaseSingleSelect } from '@teable/sdk/components/filter/view-filter/component';
import { useMemo } from 'react';

interface IStatisticFunSelectProps {
  value: FieldRollup;
  /** Valid rollup functions for the currently selected field - see `getValidFieldRollup`. */
  options: FieldRollup[];
  onChange: (value: FieldRollup) => void;
  className?: string;
}

export const StatisticFunSelect = (props: IStatisticFunSelectProps) => {
  const { value, options, onChange, className } = props;
  const selectOptions = useMemo(() => {
    return options.map((func) => ({
      value: func,
      label: func,
    }));
  }, [options]);
  return (
    <BaseSingleSelect
      options={selectOptions}
      value={value}
      onSelect={(value) => {
        onChange(value as FieldRollup);
      }}
      className={className}
    />
  );
};
