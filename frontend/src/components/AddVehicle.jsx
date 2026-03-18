import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';

const imageFields = [
  { name: 'front', label: 'Delantera' },
  { name: 'left', label: 'Perfil Izquierdo' },
  { name: 'right', label: 'Perfil Derecho' },
  { name: 'rear', label: 'Trasera' },
  { name: 'top', label: 'Superior' },
  { name: 'chassis', label: 'Chasis' },
  { name: 'three_quarters', label: 'Vista 3/4' },
];

const AddVehicle = () => {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState({
    model: '', manufacturer: '', type: '', traction: '', price: '', total_price: '',
    purchase_date: '', purchase_place: '', modified: false, digital: false, museo: false, taller: false, anotaciones: '', reference: '', scale_factor: 32
  });
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setVehicle(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageChange = (e, field) => {
    const file = e.target.files[0];
    setImages(prev => ({ ...prev, [field]: file }));
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviews(prev => ({ ...prev, [field]: reader.result }));
      reader.readAsDataURL(file);
    } else {
      setPreviews(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(vehicle).forEach(([key, value]) => formData.append(key, value));
      imageFields.forEach(({ name }) => {
        if (images[name]) formData.append('images', images[name], name);
      });
      await api.post('/vehicles', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate('/vehicles');
    } catch (err) {
      setError('Error al crear el vehículo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Añadir Vehículo</h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Datos del vehículo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Modelo</Label><Input name="model" value={vehicle.model} onChange={handleChange} required /></div>
              <div className="space-y-2"><Label>Referencia</Label><Input name="reference" value={vehicle.reference} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Fabricante</Label><Input name="manufacturer" value={vehicle.manufacturer} onChange={handleChange} required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" name="type" value={vehicle.type} onChange={handleChange} required>
                  <option value="">Selecciona tipo</option>
                  {['Rally', 'GT', 'LMP', 'Clásico', 'DTM', 'F1', 'Camiones', 'Raid'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Tracción</Label><Input name="traction" value={vehicle.traction} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Precio original (€)</Label><Input name="price" type="number" step="0.01" value={vehicle.price} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Fecha de compra</Label><Input name="purchase_date" type="date" value={vehicle.purchase_date} onChange={handleChange} /></div>
              <div className="space-y-2"><Label>Lugar de compra</Label><Input name="purchase_place" value={vehicle.purchase_place} onChange={handleChange} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2"><Switch name="modified" checked={vehicle.modified} onCheckedChange={v => setVehicle(prev => ({ ...prev, modified: v }))} /><Label>Modificado</Label></div>
                <div className="flex items-center gap-2"><Switch name="digital" checked={vehicle.digital} onCheckedChange={v => setVehicle(prev => ({ ...prev, digital: v }))} /><Label>Digital</Label></div>
                <div className="flex items-center gap-2"><Switch name="museo" checked={vehicle.museo} onCheckedChange={v => setVehicle(prev => ({ ...prev, museo: v }))} /><Label>Museo</Label></div>
                <div className="flex items-center gap-2"><Switch name="taller" checked={vehicle.taller} onCheckedChange={v => setVehicle(prev => ({ ...prev, taller: v }))} /><Label>Taller</Label></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="anotaciones">Anotaciones</Label>
                <Textarea id="anotaciones" name="anotaciones" value={vehicle.anotaciones} onChange={e => setVehicle(prev => ({ ...prev, anotaciones: e.target.value }))} placeholder="Añade tus comentarios..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scale_factor">Escala (1:X)</Label>
                <Input id="scale_factor" name="scale_factor" type="number" min="1" max="100" value={vehicle.scale_factor ?? 32} onChange={handleChange} placeholder="32" />
                <p className="text-xs text-muted-foreground">Escala del coche para velocidad equivalente (32 = 1:32, 43 = 1:43)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Fotografías</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {imageFields.map(({ name, label }) => (
                  <div key={name} className="space-y-2">
                    <Label>{label}</Label>
                    <div className="border border-dashed rounded-md flex flex-col items-center justify-center p-2 min-h-[120px] cursor-pointer bg-muted/30 hover:bg-muted/50" onClick={() => document.getElementById(`img-${name}`).click()}>
                      {previews[name] ? <img src={previews[name]} alt={label} className="max-w-full max-h-[90px] object-contain" /> : <span className="text-muted-foreground text-sm">Imagen</span>}
                      <input id={`img-${name}`} type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e, name)} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="secondary" onClick={() => navigate('/vehicles')}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Crear Vehículo'}</Button>
        </div>
      </form>
    </div>
  );
};

export default AddVehicle;
