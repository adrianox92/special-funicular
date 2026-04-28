import React, { useEffect, useState } from 'react';
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

/**
 * Construye el objeto plano para POST /vehicles (misma forma que AddVehicle),
 * sin imágenes ni campos de solo lectura del servidor.
 */
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
  };
}

/**
 * @param {{ vehicle: object | null, open: boolean, onOpenChange: (open: boolean) => void, onSuccess?: () => void }} props
 */
const DuplicateVehicleDialog = ({ vehicle, open, onOpenChange, onSuccess }) => {
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
      setError('Modelo, fabricante y tipo son obligatorios. Si falta el tipo, edita el vehículo original.');
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
      toast.success('Vehículo duplicado correctamente');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const apiError = err.response?.data?.error;
      const userMessage =
        apiError && typeof apiError === 'string'
          ? apiError.includes('numeric')
            ? 'El valor del precio no es válido. Deja el campo vacío o introduce un número.'
            : apiError
          : 'Error al duplicar el vehículo';
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
            <DialogTitle>Duplicar vehículo</DialogTitle>
            <DialogDescription>
              Se creará un vehículo nuevo con los mismos datos base (tipo, tracción, catálogo enlazado,
              etc.). No se copian fotos propias ni cronometrajes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dup-reference">Referencia</Label>
              <Input
                id="dup-reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-manufacturer">Fabricante</Label>
              <Input
                id="dup-manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-model">Modelo</Label>
              <Input id="dup-model" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-price">Precio de compra (€)</Label>
              <Input
                id="dup-price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-purchase-date">Fecha de compra</Label>
              <Input
                id="dup-purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dup-purchase-place">Lugar de compra</Label>
              <Input
                id="dup-purchase-place"
                value={purchasePlace}
                onChange={(e) => setPurchasePlace(e.target.value)}
                placeholder="Opcional"
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
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creando…' : 'Duplicar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateVehicleDialog;
