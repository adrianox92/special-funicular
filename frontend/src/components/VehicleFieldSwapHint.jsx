import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { detectSwappedVehicleFields } from '../utils/vehicleFieldSwap';

export default function VehicleFieldSwapHint({ model, reference, onSwap }) {
  const { t } = useTranslation('vehicles');
  if (!detectSwappedVehicleFields({ model, reference })) return null;

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTitle className="text-sm">{t('fieldSwap.title')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {t('fieldSwap.body', {
            model: String(model || '').trim(),
            reference: String(reference || '').trim(),
          })}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onSwap} className="shrink-0">
          {t('fieldSwap.action')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
