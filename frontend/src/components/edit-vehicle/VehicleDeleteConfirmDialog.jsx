import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useEditVehicle } from './EditVehicleContext';

export default function VehicleDeleteConfirmDialog() {
  const { t } = useTranslation('vehicles');
  const { t: tTimings } = useTranslation('timings');
  const {
    deleteConfirm,
    setDeleteConfirm,
    specDeleteReturnToInventory,
    setSpecDeleteReturnToInventory,
    confirmDeleteImage,
    confirmDeleteSpec,
    confirmDeleteTiming,
  } = useEditVehicle();

  const getConfirmDialogContent = () => {
    if (!deleteConfirm) return null;
    if (deleteConfirm.type === 'image') {
      return {
        title: t('modals.deleteImageTitle'),
        description: t('modals.deleteImageBody'),
        extra: null,
        onConfirm: confirmDeleteImage,
      };
    }
    if (deleteConfirm.type === 'spec') {
      return {
        title: deleteConfirm.isModification ? t('modals.deleteModificationTitle') : t('modals.deleteSpecTitle'),
        description: deleteConfirm.isModification
          ? t('modals.deleteModificationBody', {
              label: deleteConfirm.elementLabel || t('modals.thisPiece'),
            })
          : t('modals.deleteSpecBody'),
        extra: deleteConfirm.isModification ? (
          <div className="flex items-start gap-2 pt-4">
            <Switch
              id="spec-del-inv"
              checked={specDeleteReturnToInventory}
              onCheckedChange={setSpecDeleteReturnToInventory}
            />
            <Label htmlFor="spec-del-inv" className="text-sm font-normal leading-snug cursor-pointer">
              {t('modals.returnToInventoryOnDelete', {
                count: deleteConfirm.mountedQty,
                unit: deleteConfirm.mountedQty === 1 ? t('modals.unit') : t('modals.units'),
              })}
            </Label>
          </div>
        ) : null,
        onConfirm: confirmDeleteSpec,
      };
    }
    if (deleteConfirm.type === 'timing') {
      return {
        title: tTimings('deleteConfirmTitle'),
        description: tTimings('deleteConfirmBody'),
        extra: null,
        onConfirm: confirmDeleteTiming,
      };
    }
    return null;
  };

  const confirmContent = getConfirmDialogContent();
  if (!confirmContent) return null;

  return (
    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmContent.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmContent.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {confirmContent.extra}
        <AlertDialogFooter>
          <AlertDialogCancel type="button">{t('modals.cancel')}</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={confirmContent.onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t('modals.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
