import { useMutation } from '@tanstack/react-query';
import { getUniqName } from '@teable/core';
import { Database } from '@teable/icons';
import { createBase } from '@teable/openapi';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@teable/ui-lib/shadcn';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import type { ReactNode } from 'react';
import { spaceConfig } from '@/features/i18n/space.config';
import { useBaseList } from '../../blocks/space/useBaseList';

export const CreateBaseModalTrigger = ({
  spaceId,
  children,
}: {
  spaceId: string;
  children: ReactNode;
}) => {
  const { t } = useTranslation(spaceConfig.i18nNamespaces);
  const router = useRouter();
  const allBases = useBaseList();
  const bases = allBases?.filter((base) => base.spaceId === spaceId);
  const { mutate: createBaseMutator, isPending: createBaseLoading } = useMutation({
    mutationFn: createBase,
    onSuccess: ({ data }) => {
      router.push({
        pathname: '/base/[baseId]',
        query: { baseId: data.id },
      });
    },
  });

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('space:baseModal.howToCreate')}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button
              className="flex h-auto grow flex-col items-center gap-4"
              variant="ghost"
              onClick={() => {
                const name = getUniqName(
                  t('common:noun.base'),
                  bases?.map((base) => base.name) || []
                );
                createBaseMutator({ spaceId, name });
              }}
              disabled={createBaseLoading}
            >
              <Database className="size-8" />
              {t('space:baseModal.fromScratch')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
