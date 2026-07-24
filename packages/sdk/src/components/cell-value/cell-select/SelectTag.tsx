import { cn } from '@teable/ui-lib';
import React from 'react';

export interface ISelectTag {
  label: string;
  color?: string;
  backgroundColor?: string;
  className?: string;
}

export const SelectTag: React.FC<React.PropsWithChildren<ISelectTag>> = (props) => {
  const { label, color, backgroundColor, className, children } = props;
  const hasColor = backgroundColor != null;
  return (
    <div
      className={cn(
        'max-w-full text-xs h-5 flex items-center gap-1',
        hasColor
          ? 'px-2 rounded-md bg-secondary text-secondary-foreground'
          : 'px-0.5 text-foreground',
        className
      )}
      style={{ color, backgroundColor }}
      title={label}
    >
      <span className="min-w-0 truncate">{label}</span>
      {children}
    </div>
  );
};
