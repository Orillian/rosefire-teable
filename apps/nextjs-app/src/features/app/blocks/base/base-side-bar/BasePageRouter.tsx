import { MoreHorizontal, Settings, Trash2 } from '@teable/icons';
import { useBasePermission, useIsReadOnlyPreview } from '@teable/sdk/hooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@teable/ui-lib/shadcn';
import { Button } from '@teable/ui-lib/shadcn/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { ShareBaseDialog } from '@/features/app/components/collaborator/share/ShareBaseDialog';
import { tableConfig } from '@/features/i18n/table.config';

const MoreMenu = () => {
  const router = useRouter();
  const { baseId } = router.query;
  const { t } = useTranslation(tableConfig.i18nNamespaces);
  const basePermission = useBasePermission();

  const canUpdateBase = Boolean(basePermission?.['base|update']);
  if (!canUpdateBase) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="my-[2px] w-full justify-start text-sm font-normal"
        >
          <MoreHorizontal className="size-4 shrink-0" />
          <p className="truncate">{t('common:actions.more')}</p>
          <div className="grow basis-0"></div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[200px]">
        {basePermission?.['base|delete'] && (
          <DropdownMenuItem asChild>
            <Button
              variant="ghost"
              size="xs"
              asChild
              className="my-[2px] w-full justify-start text-sm"
            >
              <Link href={`/base/${baseId}/trash`} className="font-normal">
                <Trash2 className="size-4 shrink-0" />
                <p className="truncate">{t('common:noun.trash')}</p>
                <div className="grow basis-0"></div>
              </Link>
            </Button>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Button
            variant="ghost"
            size="xs"
            asChild
            className="my-[2px] w-full justify-start text-sm"
          >
            <Link href={`/base/${baseId}/design`} className="font-normal">
              <Settings className="size-4 shrink-0" />
              <p className="truncate">{t('common:noun.design')}</p>
              <div className="grow basis-0"></div>
            </Link>
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const BasePageRouter = () => {
  const isReadOnlyPreview = useIsReadOnlyPreview();

  if (isReadOnlyPreview) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-3">
        <ul>
          <ShareBaseDialog />
          <MoreMenu />
        </ul>
      </div>
    </>
  );
};
