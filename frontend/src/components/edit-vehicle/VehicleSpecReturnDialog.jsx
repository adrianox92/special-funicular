import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleSpecReturnDialog() {
  const { t } = useTranslation('vehicles');
  const {
    specReturnDialogOpen,
    cancelModificationReturnDialog,
    pendingSpecSave,
    resolveModificationReturnChoice,
  } = useEditVehicle();

  return (
    <AlertDialog
      open={specReturnDialogOpen}
      onOpenChange={(open) => {
        if (!open) cancelModificationReturnDialog();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('modals.returnToInventoryTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('modals.returnToInventoryBody1')}
            {pendingSpecSave != null && (
              <>
                {' '}
                {t('modals.returnToInventoryBody2', {
                  count: pendingSpecSave.removedQty,
                  unit:
                    pendingSpecSave.removedQty === 1 ? t('modals.removedUnit') : t('modals.removedUnits'),
                })}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button">{t('modals.cancelEdit')}</AlertDialogCancel>
          <Button type="button" variant="secondary" onClick={() => resolveModificationReturnChoice(false)}>
            {t('modals.saveOnly')}
          </Button>
          <Button type="button" onClick={() => resolveModificationReturnChoice(true)}>
            {t('modals.yesToInventory')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
