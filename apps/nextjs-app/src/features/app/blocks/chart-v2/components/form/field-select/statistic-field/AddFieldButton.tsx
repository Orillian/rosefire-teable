import { Plus } from '@teable/icons';
import type { ITableQuery } from '@teable/openapi';
import { getValidFieldRollup } from '@teable/openapi';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@teable/ui-lib/shadcn';
import { useFields, useStorage } from '../../../../hooks';

export const AddFieldButton = () => {
  const { fields } = useFields();
  const { storage, updateStorageByPath } = useStorage();
  const { query } = storage || {};
  const { seriesArray } = (query || {}) as ITableQuery;
  const fieldOptions = fields
    .filter((field) => getValidFieldRollup(field).length > 0)
    ?.filter(
      (field) =>
        Array.isArray(seriesArray) && !seriesArray?.some((item) => item.column === field.id)
    );
  return (
    fieldOptions.length > 0 && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[312px]" align="start">
          {fieldOptions?.map((field) => (
            <DropdownMenuItem
              key={field.id}
              onClick={() => {
                const defaultRollup = getValidFieldRollup(field)[0];
                const newSeriesArray = [
                  ...seriesArray,
                  {
                    column: field.id,
                    rollup: defaultRollup,
                  },
                ];

                const paths: Array<{ path: string; value: unknown }> = [
                  {
                    path: 'query.seriesArray',
                    value: newSeriesArray,
                  },
                ];

                if (newSeriesArray.length >= 2) {
                  paths.push({ path: 'query.groupBy', value: null });
                }

                updateStorageByPath(paths);
              }}
            >
              {field.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );
};
