import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';

function normalizeReference(ref) {
  if (ref == null || ref === '' || String(ref) === 'null') return '';
  return String(ref);
}

function buildDuplicateVehicleRecord(source, overrides) {
  const commercialYear =
    source.commercial_release_year != null && source.commercial_release_year !== ''
      ? String(source.commercial_release_year)
      : '';

  return {
    model: overrides.model,
    manufacturer: overrides.manufacturer,
    reference: overrides.reference ?? '',
    type: source.type ?? '',
    traction: source.traction ?? '',
    motor_position: source.motor_position ?? '',
    price: overrides.price ?? '',
    total_price: '',
    purchase_date: overrides.purchase_date ?? '',
    purchase_place: overrides.purchase_place ?? '',
    modified: Boolean(source.modified),
    digital: Boolean(source.digital),
    museo: Boolean(source.museo),
    taller: Boolean(source.taller),
    anotaciones: source.anotaciones ?? '',
    scale_factor:
      source.scale_factor != null && source.scale_factor !== '' ? source.scale_factor : 32,
    commercial_release_year: commercialYear,
    dorsal: source.dorsal != null && String(source.dorsal).trim() !== '' ? String(source.dorsal).trim() : '',
    limited_edition: Boolean(source.limited_edition),
    limited_edition_unit_number:
      source.limited_edition_unit_number != null && source.limited_edition_unit_number !== ''
        ? String(source.limited_edition_unit_number)
        : '',
  };
}

const DuplicateVehicleDialog = ({ vehicle, open, onOpenChange, onSuccess }) => {
  const { t } = useTranslation('vehicles');
  const { t: tc } = useTranslation('common');
  const [model, setModel] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [reference, setReference] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchasePlace, setPurchasePlace] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !vehicle) return;
    setModel(vehicle.model ?? '');
    setManufacturer(vehicle.manufacturer ?? '');
    setReference(normalizeReference(vehicle.reference));
    setPurchaseDate('');
    setPurchasePlace('');
    setPrice('');
    setError(null);
  }, [open, vehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicle) return;

    const modelTrim = model?.toString().trim() ?? '';
    const manufacturerTrim = manufacturer?.toString().trim() ?? '';
    const typeTrim = vehicle.type?.toString().trim() ?? '';

    if (!modelTrim || !manufacturerTrim || !typeTrim) {
      setError(t('duplicateModal.requiredError'));
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const overrides = {
        model: modelTrim,
        manufacturer: manufacturerTrim,
        reference,
        purchase_date: purchaseDate,
        purchase_place: purchasePlace,
        price,
      };
      const record = buildDuplicateVehicleRecord(vehicle, overrides);

      const formData = new FormData();
      Object.entries(record).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        formData.append(key, value);
      });

      const cid = vehicle.catalog_item_id;
      if (cid != null && cid !== '' && String(cid) !== 'null') {
        formData.append('catalog_item_id', String(cid).trim());
      }

      await api.post('/vehicles', formData);
      toast.success(t('duplicateModal.success'));
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const apiError = err.response?.data?.error;
      const userMessage =
        apiError && typeof apiError === 'string'
          ? apiError.includes('numeric')
            ? t('duplicateModal.invalidPriceError')
            : apiError
          : t('duplicateModal.error');
      setError(userMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('duplicateModal.title')}</DialogTitle>
            <DialogDescription>{t('duplicateModal.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dup-reference">{t('edit.fields.reference')}</Label>
              <Input
                id="dup-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-manufacturer">{t('edit.fields.manufacturer')}</Label>
              <Input
                id="dup-manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-model">{t('edit.fields.model')}</Label>
              <Input id="dup-model" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-price">{t('duplicateModal.purchasePrice')}</Label>
              <Input
                id="dup-price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('edit.optional')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-purchase-date">{t('edit.fields.purchaseDate')}</Label>
              <Input
                id="dup-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-purchase-place">{t('edit.fields.purchasePlace')}</Label>
              <Input
                id="dup-purchase-place"
                value={purchasePlace}
                onChange={(e) => setPurchasePlace(e.target.value)}
                placeholder={t('edit.optional')}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t('duplicateModal.creating') : t('duplicateModal.duplicate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateVehicleDialog;
