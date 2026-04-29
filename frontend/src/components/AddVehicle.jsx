import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { VEHICLE_TYPES } from '../data/vehicleTypes';
import { MOTOR_POSITION_OPTIONS } from '../data/motorPosition';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

const requiredFields = [
  { key: 'model', label: 'Modelo' },
  { key: 'manufacturer', label: 'Fabricante' },
  { key: 'type', label: 'Tipo' },
];

const AddVehicle = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [entryMode, setEntryMode] = useState('manual');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogItemId, setCatalogItemId] = useState(null);
  const [catalogThumb, setCatalogThumb] = useState(null);

  const [vehicle, setVehicle] = useState({
    model: '',
    manufacturer: '',
    type: '',
    traction: '',
    motor_position: '',
    price: '',
    total_price: '',
    purchase_date: '',
    purchase_place: '',
    modified: false,
    digital: false,
    museo: false,
    taller: false,
    anotaciones: '',
    reference: '',
    scale_factor: 32,
    commercial_release_year: '',
    dorsal: '',
    limited_edition: false,
    limited_edition_unit_number: '',
  });
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draggingOver, setDraggingOver] = useState(null);

  const searchCatalog = useCallback(async (q) => {
    const t = q.trim();
    if (t.length < 1) {
      setCatalogResults([]);
      return;
    }
    setCatalogLoading(true);
    try {
      const { data } = await api.get('/catalog/search', { params: { q: t } });
      setCatalogResults(data.items ?? []);
    } catch {
      setCatalogResults([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || entryMode !== 'catalog') return;
    const t = setTimeout(() => searchCatalog(catalogQuery), 350);
    return () => clearTimeout(t);
  }, [catalogQuery, entryMode, user, searchCatalog]);

  const applyCatalogItem = (item) => {
    setCatalogItemId(item.id);
    setCatalogThumb(item.image_url || null);
    setVehicle((prev) => ({
      ...prev,
      model: item.model_name || '',
      manufacturer: item.manufacturer || '',
      type: item.vehicle_type || '',
      traction: item.traction || '',
      motor_position: item.motor_position || '',
      reference: item.reference || '',
      commercial_release_year:
        item.commercial_release_year != null && item.commercial_release_year !== ''
          ? String(item.commercial_release_year)
          : '',
      dorsal: item.dorsal != null && String(item.dorsal).trim() !== '' ? String(item.dorsal).trim() : '',
      limited_edition: Boolean(item.limited_edition),
      limited_edition_unit_number: '',
    }));
    if (error) setError(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setVehicle((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (error && requiredFields.some((f) => f.key === name)) setError(null);
  };

  const handleFileForField = (file, field) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImages((prev) => ({ ...prev, [field]: file }));
    const reader = new FileReader();
    reader.onloadend = () => setPreviews((prev) => ({ ...prev, [field]: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleImageChange = (e, field) => {
    const file = e.target.files[0];
    if (file) handleFileForField(file, field);
    else {
      setImages((prev) => ({ ...prev, [field]: undefined }));
      setPreviews((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleDragEnter = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(field);
  };

  const handleDragLeave = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) setDraggingOver(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, field) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFileForField(file, field);
  };

  const validateRequired = () => {
    const missing = requiredFields.filter(({ key }) => !vehicle[key]?.toString().trim());
    return missing;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const missing = validateRequired();
    if (missing.length > 0) {
      const fieldNames = missing.map(({ label }) => label).join(', ');
      setError(`Por favor, rellena los siguientes campos obligatorios: ${fieldNames}`);
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(vehicle).forEach(([key, value]) => {
        if (key === 'dorsal' || key === 'limited_edition' || key === 'limited_edition_unit_number') return;
        if (value === undefined || value === null) return;
        if (typeof value === 'object') return;
        formData.append(key, value);
      });
      formData.append('dorsal', vehicle.dorsal ?? '');
      formData.append('limited_edition', vehicle.limited_edition ? 'true' : 'false');
      formData.append(
        'limited_edition_unit_number',
        vehicle.limited_edition && vehicle.limited_edition_unit_number !== '' && vehicle.limited_edition_unit_number != null
          ? String(vehicle.limited_edition_unit_number)
          : '',
      );
      if (catalogItemId) formData.append('catalog_item_id', catalogItemId);
      imageFields.forEach(({ name }) => {
        if (images[name]) formData.append('images', images[name], name);
      });
      await api.post('/vehicles', formData);
      navigate('/vehicles');
    } catch (err) {
      const apiError = err.response?.data?.error;
      const userMessage =
        apiError && typeof apiError === 'string'
          ? apiError.includes('numeric')
            ? 'El valor del precio no es válido. Deja el campo vacío o introduce un número.'
            : apiError
          : 'Error al crear el vehículo';
      setError(userMessage);
    } finally {
      setSaving(false);
    }
  };

  const vehicleForm = (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del vehículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input
                name="model"
                value={vehicle.model}
                onChange={handleChange}
                className={error && !vehicle.model?.trim() ? 'border-destructive' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input name="reference" value={vehicle.reference ?? ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Input
                name="manufacturer"
                value={vehicle.manufacturer}
                onChange={handleChange}
                className={error && !vehicle.manufacturer?.trim() ? 'border-destructive' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label>Año de comercialización (catálogo)</Label>
              <Input
                name="commercial_release_year"
                type="number"
                inputMode="numeric"
                min={1900}
                max={2100}
                placeholder="ej. 2020"
                value={vehicle.commercial_release_year ?? ''}
                onChange={handleChange}
              />
              <p className="text-xs text-muted-foreground">Solo el año de comercialización del modelo (opcional). Distinto de la fecha de compra.</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <select
                className={`flex h-9 w-full rounded-md border px-3 py-2 text-sm ${
                  error && !vehicle.type?.trim() ? 'border-destructive bg-background' : 'border-input bg-background'
                }`}
                name="type"
                value={vehicle.type}
                onChange={handleChange}
              >
                <option value="">Selecciona tipo</option>
                {VEHICLE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tracción</Label>
              <Input name="traction" value={vehicle.traction} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label>Posición del motor</Label>
              <Select
                value={vehicle.motor_position || '__none__'}
                onValueChange={(v) =>
                  setVehicle((prev) => ({ ...prev, motor_position: v === '__none__' ? '' : v }))
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
              <Label>Precio original (€)</Label>
              <Input name="price" type="number" step="0.01" value={vehicle.price} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de compra</Label>
              <Input name="purchase_date" type="date" value={vehicle.purchase_date} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label>Lugar de compra</Label>
              <Input name="purchase_place" value={vehicle.purchase_place ?? ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label>Dorsal</Label>
              <Input name="dorsal" value={vehicle.dorsal ?? ''} onChange={handleChange} placeholder="Opcional" />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={vehicle.limited_edition}
                onCheckedChange={(v) =>
                  setVehicle((prev) => ({
                    ...prev,
                    limited_edition: v,
                    limited_edition_unit_number: v ? prev.limited_edition_unit_number : '',
                  }))
                }
              />
              <Label>Edición limitada</Label>
            </div>
            {vehicle.limited_edition && (
              <div className="space-y-2">
                <Label>Nº de unidad (tu ejemplar)</Label>
                <Input
                  name="limited_edition_unit_number"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={vehicle.limited_edition_unit_number ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setVehicle((prev) => ({ ...prev, limited_edition_unit_number: v }));
                  }}
                  placeholder="ej. 45"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  name="modified"
                  checked={vehicle.modified}
                  onCheckedChange={v => setVehicle(prev => ({ ...prev, modified: v }))}
                />
                <Label>Modificado</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  name="digital"
                  checked={vehicle.digital}
                  onCheckedChange={v => setVehicle(prev => ({ ...prev, digital: v }))}
                />
                <Label>Digital</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  name="museo"
                  checked={vehicle.museo}
                  onCheckedChange={v => setVehicle(prev => ({ ...prev, museo: v }))}
                />
                <Label>Museo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  name="taller"
                  checked={vehicle.taller}
                  onCheckedChange={v => setVehicle(prev => ({ ...prev, taller: v }))}
                />
                <Label>Taller</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anotaciones">Anotaciones</Label>
              <Textarea
                id="anotaciones"
                name="anotaciones"
                value={vehicle.anotaciones ?? ''}
                onChange={e => setVehicle(prev => ({ ...prev, anotaciones: e.target.value }))}
                placeholder="Añade tus comentarios..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scale_factor">Escala (1:X)</Label>
              <Input
                id="scale_factor"
                name="scale_factor"
                type="number"
                min="1"
                max="100"
                value={vehicle.scale_factor ?? 32}
                onChange={handleChange}
                placeholder="32"
              />
              <p className="text-xs text-muted-foreground">Escala del coche para velocidad equivalente (32 = 1:32, 43 = 1:43)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fotografías</CardTitle>
          </CardHeader>
          <CardContent>
            {catalogThumb && (
              <div className="mb-4 rounded-md border p-2 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Imagen del catálogo (se usará como delantera si no subes una)</p>
                <img src={catalogThumb} alt="" className="max-h-24 object-contain" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {imageFields.map(({ name, label }) => (
                <div key={name} className="space-y-2">
                  <Label>{label}</Label>
                  <div
                    className={`border-2 border-dashed rounded-md flex flex-col items-center justify-center p-2 min-h-[120px] cursor-pointer transition-colors ${
                      draggingOver === name ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => document.getElementById(`img-${name}`).click()}
                    onDragEnter={e => handleDragEnter(e, name)}
                    onDragLeave={e => handleDragLeave(e, name)}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(e, name)}
                  >
                    {previews[name] ? (
                      <img src={previews[name]} alt={label} className="max-w-full max-h-[90px] object-contain pointer-events-none" />
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {draggingOver === name ? 'Suelta la imagen aquí' : 'Arrastra o haz clic'}
                      </span>
                    )}
                    <input id={`img-${name}`} type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, name)} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Añadir Vehículo</h2>

      {user && (
        <Tabs value={entryMode} onValueChange={setEntryMode}>
          <TabsList>
            <TabsTrigger value="manual">Introducir a mano</TabsTrigger>
            <TabsTrigger value="catalog">Buscar en catálogo</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="mt-0" />
          <TabsContent value="catalog" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buscar por referencia, marca o nombre</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Ej. C1234"
                  value={catalogQuery}
                  onChange={e => setCatalogQuery(e.target.value)}
                />
                {catalogLoading && <p className="text-sm text-muted-foreground">Buscando…</p>}
                <ul className="max-h-56 overflow-auto border rounded-md divide-y">
                  {catalogResults.length === 0 && catalogQuery.trim().length >= 1 && !catalogLoading && (
                    <li className="p-3 text-sm text-muted-foreground">Sin resultados</li>
                  )}
                  {catalogResults.map(item => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full text-left p-3 hover:bg-muted/50 text-sm"
                        onClick={() => applyCatalogItem(item)}
                      >
                        <span className="font-medium">{item.reference}</span>
                        {' — '}
                        {item.manufacturer} {item.model_name}
                        {item.vehicle_type ? (
                          <span className="text-muted-foreground"> · {item.vehicle_type}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                {catalogItemId && (
                  <p className="text-xs text-muted-foreground">Ítem de catálogo seleccionado. Puedes ajustar los campos abajo antes de guardar.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <form onSubmit={handleSubmit}>
        {vehicleForm}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => navigate('/vehicles')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear Vehículo'}</Button>
        </div>
      </form>
    </div>
  );
};

export default AddVehicle;
