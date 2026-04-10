import React, { useState } from 'react';
import CatalogBrandSelect from '../components/CatalogBrandSelect';
import CatalogTractionSelect from '../components/CatalogTractionSelect';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { VEHICLE_TYPES } from '../data/vehicleTypes';
import { MOTOR_POSITION_OPTIONS } from '../data/motorPosition';
import { Switch } from '../components/ui/switch';

const emptyForm = {
  proposed_reference: '',
  proposed_manufacturer_id: '',
  proposed_model_name: '',
  proposed_vehicle_type: '',
  proposed_traction: '',
  proposed_motor_position: '',
  proposed_commercial_release_year: '',
  proposed_discontinued: false,
  proposed_upcoming_release: false,
};

export default function ProposeCatalogInsert() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.proposed_manufacturer_id?.trim()) {
      setError('Selecciona una marca registrada.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('proposed_reference', form.proposed_reference);
      fd.append('proposed_manufacturer_id', form.proposed_manufacturer_id);
      fd.append('proposed_model_name', form.proposed_model_name);
      if (form.proposed_vehicle_type) fd.append('proposed_vehicle_type', form.proposed_vehicle_type);
      fd.append('proposed_traction', form.proposed_traction ?? '');
      fd.append('proposed_motor_position', form.proposed_motor_position ?? '');
      if (form.proposed_commercial_release_year) {
        fd.append('proposed_commercial_release_year', form.proposed_commercial_release_year);
      }
      fd.append('proposed_discontinued', form.proposed_discontinued ? 'true' : 'false');
      fd.append('proposed_upcoming_release', form.proposed_upcoming_release ? 'true' : 'false');
      if (imageFile) fd.append('image', imageFile);

      await api.post('/catalog/insert-requests', fd);
      navigate('/mis-sugerencias-catalogo');
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(typeof msg === 'string' ? msg : err.message || 'Error al enviar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Proponer un nuevo modelo en el catálogo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tu propuesta será revisada por el equipo antes de publicarse.
        </p>
        <p className="text-sm mt-2">
          <Link to="/catalogo" className="text-primary underline">
            Volver al catálogo
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos del modelo</CardTitle>
          <CardDescription>
            Referencia, marca (registrada en el catálogo) y nombre son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input
                required
                value={form.proposed_reference}
                onChange={(e) => setForm((f) => ({ ...f, proposed_reference: e.target.value }))}
              />
            </div>
            <CatalogBrandSelect
              label="Marca"
              required
              value={form.proposed_manufacturer_id}
              onChange={(proposed_manufacturer_id) =>
                setForm((f) => ({ ...f, proposed_manufacturer_id }))
              }
            />
            <div className="space-y-2">
              <Label>Nombre / modelo</Label>
              <Input
                required
                value={form.proposed_model_name}
                onChange={(e) => setForm((f) => ({ ...f, proposed_model_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.proposed_vehicle_type || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, proposed_vehicle_type: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin tipo —</SelectItem>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CatalogTractionSelect
              value={form.proposed_traction}
              onChange={(proposed_traction) => setForm((f) => ({ ...f, proposed_traction }))}
              id="propose-catalog-traction"
            />
            <div className="space-y-2">
              <Label>Posición del motor</Label>
              <Select
                value={form.proposed_motor_position || '__none__'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, proposed_motor_position: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {MOTOR_POSITION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Año de comercialización</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                placeholder="ej. 2020"
                value={form.proposed_commercial_release_year}
                onChange={(e) =>
                  setForm((f) => ({ ...f, proposed_commercial_release_year: e.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="propose-discontinued" className="cursor-pointer">
                  Descatalogado
                </Label>
                <Switch
                  id="propose-discontinued"
                  checked={form.proposed_discontinued}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, proposed_discontinued: v }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="propose-upcoming" className="cursor-pointer">
                  Próximo lanzamiento
                </Label>
                <Switch
                  id="propose-upcoming"
                  checked={form.proposed_upcoming_release}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, proposed_upcoming_release: v }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Imagen (opcional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Enviando…' : 'Enviar propuesta'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/catalogo">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
