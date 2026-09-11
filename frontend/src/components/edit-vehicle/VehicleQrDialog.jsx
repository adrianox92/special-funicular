import React from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../ui/spinner';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { safeVehicleFileBasename } from '../../utils/formatUtils';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleQrDialog() {
  const { t } = useTranslation('vehicles');
  const {
    vehicle,
    showQrDialog,
    setShowQrDialog,
    setQrDataUrl,
    qrError,
    setQrError,
    qrLoading,
    qrDataUrl,
    closeQrDialog,
  } = useEditVehicle();

  return (
    <Dialog
      open={showQrDialog}
      onOpenChange={(open) => {
        setShowQrDialog(open);
        if (!open) {
          setQrDataUrl(null);
          setQrError(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('modals.qrTitle')}</DialogTitle>
          <DialogDescription>{t('modals.qrDesc')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          {qrLoading && <Spinner className="size-8" />}
          {qrError && <p className="text-sm text-destructive">{qrError}</p>}
          {qrDataUrl && (
            <>
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qrDataUrl}
                  alt={t('modals.qrAlt')}
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded border bg-white p-1"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={!qrDataUrl}
            onClick={() => {
              if (!qrDataUrl || !vehicle) return;
              const a = document.createElement('a');
              a.href = qrDataUrl;
              a.download = `${safeVehicleFileBasename(vehicle.model)}.png`;
              document.body.appendChild(a);
              a.click();
              a.remove();
            }}
          >
            {t('modals.downloadPng')}
          </Button>
          <Button type="button" variant="default" onClick={closeQrDialog}>
            {t('modals.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
