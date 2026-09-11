import React from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutPanelLeft } from 'lucide-react';
import { hasMultipleConfigs } from '../SetupPerformanceAnalysis';
import { Label } from '../ui/label';
import { TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '../ui/utils';
import { VEHICLE_TABS_TRIGGER_CLASS } from './constants';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleEditTabsNav({ activeTab, onTabChange, tabOptions }) {
  const { t } = useTranslation('vehicles');
  const { timings } = useEditVehicle();
  const vehicleTabsTriggerClass = VEHICLE_TABS_TRIGGER_CLASS;

  return (
    <>
      <div className="mb-6 sm:hidden">
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
                {t('edit.navigation')}
              </p>
              <p className="text-sm font-medium leading-tight text-foreground">{t('edit.sectionLabel')}</p>
            </div>
          </div>
          <Label htmlFor="vehicle-edit-section" className="sr-only">
            {t('edit.sectionLabel')}
          </Label>
          <Select value={activeTab} onValueChange={onTabChange}>
            <SelectTrigger
              id="vehicle-edit-section"
              className="h-11 w-full border-2 border-input bg-background text-base font-medium shadow-sm"
            >
              <SelectValue placeholder={t('edit.chooseSection')} />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-[min(24rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)]">
              {tabOptions.map((opt) => (
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
          hasMultipleConfigs(timings)
            ? 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7'
            : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
        )}
      >
        <TabsTrigger value="general" className={vehicleTabsTriggerClass}>
          {t('edit.tabs.general')}
        </TabsTrigger>
        <TabsTrigger value="technical" className={vehicleTabsTriggerClass}>
          {t('edit.tabs.technical')}
        </TabsTrigger>
        <TabsTrigger value="modifications" className={vehicleTabsTriggerClass}>
          {t('edit.tabs.modifications')}
        </TabsTrigger>
        <TabsTrigger value="timings" className={vehicleTabsTriggerClass}>
          {t('edit.tabs.timings')}
        </TabsTrigger>
        {hasMultipleConfigs(timings) && (
          <TabsTrigger value="config-analysis" className={vehicleTabsTriggerClass}>
            {t('edit.tabs.configAnalysis')}
          </TabsTrigger>
        )}
        <TabsTrigger value="maintenance" className={vehicleTabsTriggerClass}>
          {t('edit.tabs.maintenance')}
        </TabsTrigger>
        <TabsTrigger value="palmares" className={vehicleTabsTriggerClass}>
          {t('edit.tabs.palmares')}
        </TabsTrigger>
      </TabsList>
    </>
  );
}
