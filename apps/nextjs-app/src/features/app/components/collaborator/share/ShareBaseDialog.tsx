import { UserPlus } from '@teable/icons';
import { useBase } from '@teable/sdk/hooks';
import { Button, Dialog, DialogContent, DialogTrigger } from '@teable/ui-lib/shadcn';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { ShareBaseContent } from './ShareBaseContent';

interface IShareBaseDialogProps {
  children?: React.ReactNode;
}

export const ShareBaseDialog = (props: IShareBaseDialogProps) => {
  const { children } = props;
  const base = useBase();
  const [open, setOpen] = useState(false);
  const onClose = () => setOpen(false);
  const { t } = useTranslation('space');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ? (
          children
        ) : (
          <Button
            variant="ghost"
            size="xs"
            data-attr="base-sidebar-invite"
            className="w-full justify-start text-sm font-normal"
          >
            <UserPlus className="size-4 shrink-0" />
            <p className="truncate">{t('action.invite')}</p>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-full overflow-y-auto rounded-xl px-7 pb-3 md:w-[480px]">
        <ShareBaseContent
          baseId={base.id}
          baseName={base.name}
          role={base.role}
          enabledAuthority={base.enabledAuthority}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};
