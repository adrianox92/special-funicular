import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Spinner } from '../ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { formatInventoryCategory } from '../../utils/formatUtils';
import { useEditVehicle } from './EditVehicleContext';

export default function InventoryPickerDialog() {
  const { t } = useTranslation('vehicles');
  const {
    inventoryPickerOpen,
    setInventoryPickerOpen,
    inventoryPickerLoading,
    inventoryPickerItems,
    newSpec,
    handlePickInventoryItem,
  } = useEditVehicle();

  return (
    <Dialog open={inventoryPickerOpen} onOpenChange={(open) => setInventoryPickerOpen(open)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('modals.inventoryPickerTitle')}</DialogTitle>
          <DialogDescription>{t('modals.inventoryPickerDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto py-2">
          {inventoryPickerLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-8" />
            </div>
          ) : inventoryPickerItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('modals.noInventoryItems', {
                categorySuffix: newSpec.component_type ? t('modals.categorySuffix') : '',
              })}
            </p>
          ) : (
            inventoryPickerItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInventoryCategory(item.category)} · {t('modals.stock')}: {item.quantity}
                    {item.purchase_price != null &&
                      ` · ${Number(item.purchase_price).toFixed(2)} ${t('modals.unitPrice')}`}
                  </p>
                  {Array.isArray(item.mounted_vehicles) && item.mounted_vehicles.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-snug">
                      {t('modals.mountedOn')}{' '}
                      {item.mounted_vehicles.map((v, idx) => (
                        <span key={v.id}>
                          {idx > 0 ? (idx === item.mounted_vehicles.length - 1 ? t('edit.and') : ', ') : ''}
                          <Link to={`/vehicles/${v.id}`} className="text-primary hover:underline font-medium">
                            {v.manufacturer} {v.model}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <Button type="button" size="sm" className="shrink-0" onClick={() => handlePickInventoryItem(item)}>
                  {t('modals.useThis')}
                </Button>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setInventoryPickerOpen(false)}>
            {t('modals.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
