import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutPanelLeft } from 'lucide-react';
import { TabsList, TabsTrigger } from './tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Label } from './label';
import { cn } from './utils';

/**
 * Mobile: labeled Select dropdown. Desktop (sm+): TabsList grid.
 * @param {{ value: string, onValueChange: (v: string) => void, options: Array<{ value: string, label: string, trigger?: React.ReactNode }>, listClassName?: string, triggerClassName?: string, mobileClassName?: string, listAriaLabel?: string, mobileLabel?: string, mobileHint?: string, mobilePlaceholder?: string, selectId?: string }} props
 */
export function ResponsiveTabsNav({
  value,
  onValueChange,
  options,
  listClassName,
  triggerClassName,
  mobileClassName,
  listAriaLabel,
  mobileLabel,
  mobileHint,
  mobilePlaceholder,
  selectId,
}) {
  const { t } = useTranslation('common');
  const autoId = React.useId();
  const fieldId = selectId ?? `responsive-tabs-${autoId}`;

  const hint = mobileHint ?? t('tabsNav.navigation');
  const label = mobileLabel ?? t('tabsNav.sectionLabel');
  const placeholder = mobilePlaceholder ?? t('tabsNav.chooseSection');

  return (
    <>
      <div className={cn('mb-4 sm:hidden', mobileClassName)}>
        <div
          className={cn(
            'rounded-xl border-2 border-primary/25 bg-muted/50 p-4 shadow-sm',
            'ring-1 ring-border/60',
          )}
        >
          <div className="mb-3 flex items-center gap-2 border-b border-border/80 pb-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <LayoutPanelLeft className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {hint}
              </p>
              <p className="text-sm font-medium leading-tight text-foreground">{label}</p>
            </div>
          </div>
          <Label htmlFor={fieldId} className="sr-only">
            {label}
          </Label>
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger
              id={fieldId}
              className="h-11 w-full border-2 border-input bg-background text-base font-medium shadow-sm"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="max-h-[min(24rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)]"
            >
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <TabsList
        className={cn(
          'mb-4 hidden h-auto min-h-9 w-full gap-1 sm:grid',
          listClassName,
        )}
        aria-label={listAriaLabel ?? label}
      >
        {options.map((opt) => (
          <TabsTrigger
            key={opt.value}
            value={opt.value}
            className={triggerClassName}
          >
            {opt.trigger ?? opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  );
}
