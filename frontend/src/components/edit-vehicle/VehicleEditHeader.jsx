import React from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';
import { Button } from '../ui/button';
import { formatDistance } from '../../utils/formatUtils';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleEditHeader() {
  const { t } = useTranslation('vehicles');
  const { vehicle, openQrDialog, navigate } = useEditVehicle();

  return (
    <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
      <div className="flex items-center gap-4 min-w-0 flex-wrap">
        <h2 className="text-2xl font-bold">
          {vehicle.model ? t('edit.titleWithModel', { model: vehicle.model }) : t('edit.title')}
        </h2>
        {vehicle.collection_number != null && (
          <span className="text-sm font-mono tabular-nums text-muted-foreground bg-muted px-2 py-1 rounded">
            {t('edit.collectionNumber', { number: vehicle.collection_number })}
          </span>
        )}
        {vehicle.total_distance_meters != null && vehicle.total_distance_meters > 0 && (
          <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
            {t('edit.odometer')} {formatDistance(vehicle.total_distance_meters)}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={openQrDialog}
          title={t('modals.qrButtonTitle')}
        >
          <QrCode className="size-4 mr-2" />
          {t('modals.qrButton')}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/vehicles')}>
          {t('edit.backToList')}
        </Button>
      </div>
    </div>
  );
}
