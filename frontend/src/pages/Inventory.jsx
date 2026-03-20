import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, Trash2, Pen, ExternalLink, Wrench } from 'lucide-react';
import api from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  INVENTORY_CATEGORIES,
  INVENTORY_UNITS,
  formatInventoryCategory,
  formatHistoryDate,
} from '../utils/formatUtils';

const emptyForm = () => ({
  name: '',
  reference: '',
  url: '',
  category: 'otro',
  quantity: '1',
  unit: 'uds',
  min_stock: '',
  purchase_price: '',
  purchase_date: '',
  notes: '',
  vehicle_id: 'none',
});

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, item: null });
  const [mountTarget, setMountTarget] = useState(null);
  const [mountForm, setMountForm] = useState(null);
  const [mountError, setMountError] = useState(null);
  const [mountSaving, setMountSaving] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadVehicles = useCallback(async () => {
    try {
      const { data } = await api.get('/vehicles', { params: { page: 1, limit: 500 } });
      const list = data?.vehicles ?? (Array.isArray(data) ? data : []);
      setVehicles(list);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (categoryFilter && categoryFilter !== 'all') params.category = categoryFilter;
      if (lowStockOnly) params.low_stock = 'true';
      if (debouncedQ) params.q = debouncedQ;
      const { data } = await api.get('/inventory', { params });
      setItems(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar el inventario');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, lowStockOnly, debouncedQ]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const initForm = (item = null) => {
    if (item) {
      setFormData({
        name: item.name || '',
        reference: item.reference ?? '',
        url: item.url ?? '',
        category: item.category || 'otro',
        quantity: String(item.quantity ?? 0),
        unit: item.unit || 'uds',
        min_stock: item.min_stock != null ? String(item.min_stock) : '',
        purchase_price: item.purchase_price != null ? String(item.purchase_price) : '',
        purchase_date: item.purchase_date ? String(item.purchase_date).slice(0, 10) : '',
        notes: item.notes ?? '',
        vehicle_id: item.vehicle_id || 'none',
      });
      setEditingItem(item);
    } else {
      setFormData(emptyForm());
      setEditingItem(null);
    }
    setFormError(null);
  };

  const handleOpenCreate = () => {
    initForm(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    initForm(item);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    const qty = parseInt(formData.quantity, 10);
    if (Number.isNaN(qty) || qty < 0) {
      setFormError('La cantidad debe ser un número entero mayor o igual a 0');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        name: formData.name.trim(),
        reference: formData.reference.trim() || null,
        url: formData.url.trim() || null,
        category: formData.category,
        quantity: qty,
        unit: formData.unit,
        min_stock: formData.min_stock.trim() === '' ? null : parseInt(formData.min_stock, 10),
        purchase_price: formData.purchase_price.trim() === '' ? null : Number(formData.purchase_price),
        purchase_date: formData.purchase_date.trim() === '' ? null : formData.purchase_date,
        notes: formData.notes.trim() || null,
        vehicle_id: formData.vehicle_id === 'none' ? null : formData.vehicle_id,
      };

      if (payload.min_stock != null && (Number.isNaN(payload.min_stock) || payload.min_stock < 0)) {
        setFormError('Stock mínimo no válido');
        setSaving(false);
        return;
      }
      if (payload.purchase_price != null && (Number.isNaN(payload.purchase_price) || payload.purchase_price < 0)) {
        setFormError('Precio no válido');
        setSaving(false);
        return;
      }

      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        toast.success('Ítem actualizado');
      } else {
        await api.post('/inventory', payload);
        toast.success('Ítem creado');
      }

      setShowModal(false);
      setEditingItem(null);
      loadItems();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setDeleteConfirm({ open: true, item });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.item) return;
    try {
      await api.delete(`/inventory/${deleteConfirm.item.id}`);
      setDeleteConfirm({ open: false, item: null });
      toast.success('Ítem eliminado');
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const openMount = (item) => {
    setMountTarget(item);
    setMountForm({
      vehicle_id: item.vehicle_id || 'none',
      is_modification: true,
      manufacturer: '',
      material: '',
      size: '',
      color: '',
      teeth: '',
      rpm: '',
      gaus: '',
      description: '',
    });
    setMountError(null);
  };

  const closeMount = () => {
    setMountTarget(null);
    setMountForm(null);
    setMountError(null);
  };

  const mountCat = (c) => String(c || '');
  const mountCategoryIs = (cat, ...values) => values.includes(mountCat(cat));

  const handleMountSubmit = async (e) => {
    e.preventDefault();
    if (!mountTarget || !mountForm) return;
    if (!mountForm.manufacturer?.trim()) {
      setMountError('La marca del fabricante es obligatoria');
      return;
    }
    if (mountForm.vehicle_id === 'none' || !mountForm.vehicle_id) {
      setMountError('Selecciona un vehículo');
      return;
    }
    const cat = mountTarget.category;
    if (mountCategoryIs(cat, 'pinion', 'crown')) {
      if (mountForm.teeth === '' || Number.isNaN(Number(mountForm.teeth))) {
        setMountError('Los dientes son obligatorios para piñón/corona');
        return;
      }
    }
    if (mountCategoryIs(cat, 'motor')) {
      if (mountForm.rpm === '' || Number.isNaN(Number(mountForm.rpm))) {
        setMountError('Las RPM son obligatorias para motor');
        return;
      }
    }
    try {
      setMountSaving(true);
      setMountError(null);
      await api.post(`/inventory/${mountTarget.id}/mount`, {
        vehicle_id: mountForm.vehicle_id,
        is_modification: mountForm.is_modification,
        manufacturer: mountForm.manufacturer.trim(),
        material: mountForm.material.trim() || undefined,
        size: mountForm.size.trim() || undefined,
        color: mountForm.color.trim() || undefined,
        description: mountForm.description.trim() || undefined,
        teeth: mountForm.teeth !== '' ? Number(mountForm.teeth) : undefined,
        rpm: mountForm.rpm !== '' ? Number(mountForm.rpm) : undefined,
        gaus: mountForm.gaus !== '' ? Number(mountForm.gaus) : undefined,
      });
      toast.success('Pieza montada y stock actualizado');
      closeMount();
      loadItems();
    } catch (err) {
      setMountError(err.response?.data?.error || 'Error al montar');
    } finally {
      setMountSaving(false);
    }
  };

  const isLowStock = (item) =>
    item.min_stock != null && Number(item.quantity) <= Number(item.min_stock);

  const unitLabel = (u) => INVENTORY_UNITS.find((x) => x.value === u)?.label || u;

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-muted-foreground">
            Repuestos y consumibles. Cada fila es una compra concreta; para otra tienda o época, crea otro ítem.
          </p>
        </div>
        <Button className="flex items-center gap-2" onClick={handleOpenCreate}>
          <Plus className="size-4" />
          Nuevo ítem
        </Button>
      </div>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, item: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ítem?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm.item
                ? `Se eliminará «${deleteConfirm.item.name}». Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!mountTarget} onOpenChange={(open) => { if (!open) closeMount(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Montar en vehículo</DialogTitle>
            <DialogDescription>
              {mountTarget
                ? `Se creará un componente a partir de «${mountTarget.name}» y se descontará 1 unidad (quedarán ${Math.max(0, Number(mountTarget.quantity) - 1)}).`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {mountTarget && mountForm && (
            <form onSubmit={handleMountSubmit}>
              <div className="space-y-4 py-2">
                {mountError && (
                  <Alert variant="destructive">
                    <AlertDescription>{mountError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label>Vehículo</Label>
                  <Select
                    value={mountForm.vehicle_id}
                    onValueChange={(v) => setMountForm({ ...mountForm, vehicle_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar vehículo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar…</SelectItem>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.manufacturer} {v.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="mount-is-mod"
                    checked={mountForm.is_modification}
                    onCheckedChange={(checked) => setMountForm({ ...mountForm, is_modification: checked })}
                  />
                  <Label htmlFor="mount-is-mod" className="cursor-pointer">
                    Registrar como modificación
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mount-mfg">Marca (fabricante)</Label>
                  <Input
                    id="mount-mfg"
                    value={mountForm.manufacturer}
                    onChange={(e) => setMountForm({ ...mountForm, manufacturer: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mount-mat">Material</Label>
                    <Input
                      id="mount-mat"
                      value={mountForm.material}
                      onChange={(e) => setMountForm({ ...mountForm, material: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mount-size">Tamaño</Label>
                    <Input
                      id="mount-size"
                      value={mountForm.size}
                      onChange={(e) => setMountForm({ ...mountForm, size: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mount-color">Color</Label>
                  <Input
                    id="mount-color"
                    value={mountForm.color}
                    onChange={(e) => setMountForm({ ...mountForm, color: e.target.value })}
                  />
                </div>
                {mountCategoryIs(mountTarget.category, 'pinion', 'crown') && (
                  <div className="space-y-2">
                    <Label htmlFor="mount-teeth">Dientes</Label>
                    <Input
                      id="mount-teeth"
                      type="number"
                      value={mountForm.teeth}
                      onChange={(e) => setMountForm({ ...mountForm, teeth: e.target.value })}
                      required
                    />
                  </div>
                )}
                {mountCategoryIs(mountTarget.category, 'motor') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mount-rpm">RPM</Label>
                      <Input
                        id="mount-rpm"
                        type="number"
                        value={mountForm.rpm}
                        onChange={(e) => setMountForm({ ...mountForm, rpm: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mount-gaus">Gaus</Label>
                      <Input
                        id="mount-gaus"
                        type="number"
                        value={mountForm.gaus}
                        onChange={(e) => setMountForm({ ...mountForm, gaus: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="mount-desc">Descripción</Label>
                  <Textarea
                    id="mount-desc"
                    rows={2}
                    value={mountForm.description}
                    onChange={(e) => setMountForm({ ...mountForm, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeMount}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={mountSaving}>
                  {mountSaving ? (
                    <>
                      <Spinner className="size-4 mr-2" />
                      Montando…
                    </>
                  ) : (
                    'Montar y descontar'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar ítem' : 'Nuevo ítem'}</DialogTitle>
            <DialogDescription>
              Referencia y enlace ayudan a localizar el producto. Misma pieza en otra compra: nuevo registro.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="inv-name">Nombre</Label>
                <Input
                  id="inv-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ej: Corona 26d Anglewinder"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-ref">Referencia (opcional)</Label>
                <Input
                  id="inv-ref"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="SKU / ref. fabricante"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-url">Enlace (opcional)</Label>
                <Input
                  id="inv-url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidad</Label>
                  <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVENTORY_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-qty">Cantidad</Label>
                  <Input
                    id="inv-qty"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-min">Stock mínimo (opcional)</Label>
                  <Input
                    id="inv-min"
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    placeholder="Alerta si cantidad ≤ mínimo"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inv-price">Precio compra (€, opcional)</Label>
                  <Input
                    id="inv-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-pdate">Fecha compra (opcional)</Label>
                  <Input
                    id="inv-pdate"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vehículo montado (opcional)</Label>
                <Select value={formData.vehicle_id} onValueChange={(v) => setFormData({ ...formData, vehicle_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.manufacturer} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-notes">Notas</Label>
                <Textarea
                  id="inv-notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Guardando…
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row gap-4 flex-wrap items-start lg:items-end">
        <div className="space-y-2 min-w-[180px]">
          <Label htmlFor="inv-filter-cat">Categoría</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="inv-filter-cat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {INVENTORY_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1 min-w-[200px] max-w-md">
          <Label htmlFor="inv-search">Buscar (nombre o referencia)</Label>
          <Input
            id="inv-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar…"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="inv-low" checked={lowStockOnly} onCheckedChange={setLowStockOnly} />
          <Label htmlFor="inv-low" className="cursor-pointer">
            Solo stock bajo
          </Label>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && items.length > 0 && (
        <div className="flex justify-center py-2">
          <Spinner className="size-6" />
        </div>
      )}

      {!loading && items.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="size-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="mb-2">No hay ítems</h4>
            <p className="text-muted-foreground mb-6">
              Añade repuestos o ajusta los filtros de búsqueda.
            </p>
            <Button onClick={handleOpenCreate} className="flex items-center gap-2 mx-auto">
              <Plus className="size-4" />
              Añadir primer ítem
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div className="min-w-0">
                    <h5 className="font-semibold text-lg leading-tight">{item.name}</h5>
                    {item.reference && (
                      <p className="text-sm text-muted-foreground mt-1">Ref: {item.reference}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {Number(item.quantity) > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        title="Montar en vehículo"
                        onClick={() => openMount(item)}
                      >
                        <Wrench className="size-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" type="button" onClick={() => handleOpenEdit(item)}>
                      <Pen className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" type="button" className="text-destructive" onClick={() => handleDelete(item)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary">{formatInventoryCategory(item.category)}</Badge>
                  {isLowStock(item) && (
                    <Badge variant="destructive">Stock bajo</Badge>
                  )}
                </div>

                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Cantidad:</span>{' '}
                    <span className="font-medium">
                      {item.quantity} {unitLabel(item.unit)}
                    </span>
                  </p>
                  {item.purchase_price != null && (
                    <p>
                      <span className="text-muted-foreground">Precio:</span>{' '}
                      {Number(item.purchase_price).toFixed(2)} €
                    </p>
                  )}
                  {item.purchase_date && (
                    <p>
                      <span className="text-muted-foreground">Compra:</span>{' '}
                      {formatHistoryDate(item.purchase_date)}
                    </p>
                  )}
                  {item.url && (
                    <p>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="size-3.5" />
                        Abrir enlace
                      </a>
                    </p>
                  )}
                  {item.vehicle && (
                    <p>
                      <span className="text-muted-foreground">Montado en:</span>{' '}
                      <Link to={`/vehicles/${item.vehicle.id}`} className="text-primary hover:underline font-medium">
                        {item.vehicle.manufacturer} {item.vehicle.model}
                      </Link>
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-muted-foreground text-xs pt-1 border-t">{item.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Inventory;
