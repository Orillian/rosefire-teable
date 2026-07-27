import { useQuery } from '@tanstack/react-query';
import { FieldType } from '@teable/core';
import type { ITableQuery } from '@teable/openapi';
import { getFields } from '@teable/openapi';
import { BaseSingleSelect } from '@teable/sdk/components/filter/view-filter/component';
import { useTranslation } from 'next-i18next';
import { useMemo } from 'react';
import { useStorage } from '../../hooks';

const NONE_VALUE = '__none__';

interface ILinkFieldSelectProps {
  className?: string;
}

/**
 * Picks the Link field (on the *current* table only - not any already-joined table, joins are
 * single-hop) that chart v2's join should traverse. Selecting one exposes the linked table's
 * fields to every xAxis/groupBy/series picker via `useFields` - see that hook for how the merge
 * works. Server-side (`PluginChartService.resolveJoin`) is the source of truth for which links are
 * actually supported (many-to-one/one-to-one with the foreign key hosted on this table); this
 * picker only filters by field type so an unsupported choice fails loudly with a clear 400 rather
 * than being silently hidden by an approximation of that check on the client.
 */
export const LinkFieldSelect = (props: ILinkFieldSelectProps) => {
  const { className } = props;
  const { t } = useTranslation('chart');
  const { storage, updateStorageByPath } = useStorage();
  const tableId = (storage?.query as ITableQuery)?.tableId;
  const linkFieldId = (storage?.query as ITableQuery)?.join?.linkFieldId;

  const { data: fields = [] } = useQuery({
    queryKey: ['fields', tableId],
    queryFn: () => getFields(tableId).then((res) => res.data),
    enabled: !!tableId,
  });

  const options = useMemo(() => {
    const linkFields = fields
      .filter((field) => field.type === FieldType.Link && !field.isLookup)
      .map((field) => ({ value: field.id, label: field.name }));
    return [{ value: NONE_VALUE, label: t('chartV2.form.join.none') }, ...linkFields];
  }, [fields, t]);

  return (
    <BaseSingleSelect
      options={options}
      value={linkFieldId ?? NONE_VALUE}
      onSelect={(value) => {
        updateStorageByPath('query.join', value === NONE_VALUE ? null : { linkFieldId: value });
      }}
      className={className}
    />
  );
};
