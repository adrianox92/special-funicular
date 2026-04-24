import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Star,
  CheckCircle2,
  AlertTriangle,
  Link2,
  Loader2,
} from 'lucide-react';
import axios from '../lib/axios';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
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

const EMPTY_FORM = {
  display_name: '',
  linked_slug: '',
  vehicle_source: 'none',
  default_vehicle_id: '',
  default_vehicle_model: '',
  notes: '',
};

const FavoritePilots = () => {
  const [favorites, setFavorites] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [slugCheck, setSlugCheck] = useState({ state: 'idle', info: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null, name: '' });

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/favorite-pilots');
      setFavorites(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
      setError('Error al cargar los pilotos favoritos');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const response = await axios.get('/competitions/vehicles');
      setVehicles(response.data || []);
    } catch (err) {
      console.error('Error al cargar vehículos:', err);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    loadVehicles();
  }, [loadFavorites, loadVehicles]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setSlugCheck({ state: 'idle', info: null });
  };

  const openCreate = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEdit = (favorite) => {
    setEditingId(favorite.id);
    setForm({
      display_name: favorite.display_name || '',
      linked_slug: favorite.linked_slug || '',
      vehicle_source: favorite.default_vehicle_id
        ? 'own'
        : favorite.default_vehicle_model
          ? 'text'
          : 'none',
      default_vehicle_id: favorite.default_vehicle_id || '',
      default_vehicle_model: favorite.default_vehicle_model || '',
      notes: favorite.notes || '',
    });
    setFormError(null);
    setSlugCheck(favorite.linked_slug
      ? { state: 'ok', info: { slug: favorite.linked_slug, display_name: null } }
      : { state: 'idle', info: null });
    setShowFormModal(true);
  };

  const handleSlugChange = (value) => {
    setForm((f) => ({ ...f, linked_slug: value }));
    setSlugCheck({ state: 'idle', info: null });
  };

  const checkSlug = async () => {
    const slug = (form.linked_slug || '').trim().toLowerCase();
    if (!slug) {
      setSlugCheck({ state: 'idle', info: null });
      return;
    }
    try {
      setSlugCheck({ state: 'checking', info: null });
      const response = await axios.get(`/public/pilot/${encodeURIComponent(slug)}`);
      setSlugCheck({
        state: 'ok',
        info: { slug: response.data?.slug || slug, display_name: response.data?.display_name || null },
      });
    } catch (err) {
      setSlugCheck({
        state: 'error',
        info: err.response?.data?.error || 'No se encontró ningún piloto con ese slug',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.display_name.trim()) {
      setFormError('El nombre del piloto es requerido');
      return;
    }
    if (form.vehicle_source === 'own' && !form.default_vehicle_id) {
      setFormError('Selecciona un vehículo de tu colección');
      return;
    }
    if (form.vehicle_source === 'text' && !form.default_vehicle_model.trim()) {
      setFormError('Indica un modelo de vehículo');
      return;
    }

    const payload = {
      display_name: form.display_name.trim(),
      notes: form.notes.trim() || null,
      linked_slug: form.linked_slug.trim() || null,
      default_vehicle_id: form.vehicle_source === 'own' ? form.default_vehicle_id : null,
      default_vehicle_model:
        form.vehicle_source === 'text' ? form.default_vehicle_model.trim() : null,
    };

    try {
      setSaving(true);
      setFormError(null);
      if (editingId) {
        await axios.patch(`/favorite-pilots/${editingId}`, payload);
        toast.success('Favorito actualizado');
      } else {
        await axios.post('/favorite-pilots', payload);
        toast.success('Favorito añadido');
      }
      setShowFormModal(false);
      resetForm();
      loadFavorites();
    } catch (err) {
      console.error('Error guardando favorito:', err);
      setFormError(err.response?.data?.error || 'No se pudo guardar el favorito');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (favorite) => {
    setDeleteConfirm({ open: true, id: favorite.id, name: favorite.display_name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await axios.delete(`/favorite-pilots/${deleteConfirm.id}`);
      toast.success('Favorito eliminado');
      setDeleteConfirm({ open: false, id: null, name: '' });
      loadFavorites();
    } catch (err) {
      console.error('Error eliminando favorito:', err);
      toast.error(err.response?.data?.error || 'No se pudo eliminar');
    }
  };

  const vehiclesById = useMemo(() => {
    const map = new Map();
    vehicles.forEach((v) => map.set(v.id, v));
    return map;
  }, [vehicles]);

  const formVehicle = form.default_vehicle_id ? vehiclesById.get(form.default_vehicle_id) : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Star className="size-6 text-primary" />
            Pilotos favoritos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guarda tus pilotos habituales y añádelos al tirón a cualquier competición sin tener que mandar invitaciones.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4 mr-2" />
          Añadir favorito
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {favorites.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="size-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="mb-2">Aún no tienes favoritos</h4>
            <p className="text-muted-foreground mb-6">
              Añade a los pilotos con los que compites a menudo para crear competiciones más rápido.
            </p>
            <Button onClick={openCreate}>
              <Plus className="size-4 mr-2" />
              Añadir primer favorito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Piloto vinculado</TableHead>
                <TableHead>Vehículo por defecto</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {favorites.map((fav) => {
                const vehicleLabel = fav.default_vehicle
                  ? `${fav.default_vehicle.manufacturer} ${fav.default_vehicle.model}`
                  : fav.default_vehicle_model || '-';
                return (
                  <TableRow key={fav.id}>
                    <TableCell className="font-medium">{fav.display_name}</TableCell>
                    <TableCell>
                      {fav.linked_slug ? (
                        <Badge
                          variant={fav.linked_active ? 'secondary' : 'outline'}
                          className="flex items-center gap-1 w-fit"
                        >
                          <Link2 className="size-3" />
                          {fav.linked_slug}
                          {!fav.linked_active && (
                            <span className="text-xs text-muted-foreground ml-1">(inactivo)</span>
                          )}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{vehicleLabel}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {fav.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(fav)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(fav)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          setShowFormModal(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar favorito' : 'Nuevo favorito'}</DialogTitle>
            <DialogDescription>
              Los favoritos son privados: solo tú los verás al crear tus competiciones.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fav-name">Nombre *</Label>
              <Input
                id="fav-name"
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fav-slug">Url de piloto público (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  id="fav-slug"
                  value={form.linked_slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="ej: juanito"
                />
                <Button type="button" variant="outline" onClick={checkSlug} disabled={slugCheck.state === 'checking'}>
                  {slugCheck.state === 'checking' ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Validar'
                  )}
                </Button>
              </div>
              {slugCheck.state === 'ok' && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="size-4" />
                  Piloto encontrado{slugCheck.info?.display_name ? `: ${slugCheck.info.display_name}` : ''}
                </p>
              )}
              {slugCheck.state === 'error' && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="size-4" />
                  {slugCheck.info}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Si el piloto tiene perfil público en la app, pega su slug para enlazarlo. Opcional.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Vehículo por defecto (opcional)</Label>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="favVehicleSource"
                    checked={form.vehicle_source === 'none'}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        vehicle_source: 'none',
                        default_vehicle_id: '',
                        default_vehicle_model: '',
                      }))
                    }
                  />
                  Sin vehículo
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="favVehicleSource"
                    checked={form.vehicle_source === 'own'}
                    onChange={() =>
                      setForm((f) => ({ ...f, vehicle_source: 'own', default_vehicle_model: '' }))
                    }
                  />
                  De mi colección
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="favVehicleSource"
                    checked={form.vehicle_source === 'text'}
                    onChange={() =>
                      setForm((f) => ({ ...f, vehicle_source: 'text', default_vehicle_id: '' }))
                    }
                  />
                  Otro (texto)
                </label>
              </div>

              {form.vehicle_source === 'own' && (
                vehicles.length > 0 ? (
                  <Select
                    value={form.default_vehicle_id}
                    onValueChange={(v) => setForm((f) => ({ ...f, default_vehicle_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un vehículo" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.manufacturer} {v.model} ({v.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tienes vehículos en tu colección. Usa "Otro (texto)" para escribir un modelo.
                  </p>
                )
              )}

              {form.vehicle_source === 'text' && (
                <Input
                  value={form.default_vehicle_model}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, default_vehicle_model: e.target.value }))
                  }
                  placeholder="Ej: McLaren F1 nº 1"
                />
              )}

              {form.vehicle_source === 'own' && formVehicle && (
                <p className="text-xs text-muted-foreground">
                  {formVehicle.manufacturer} {formVehicle.model}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fav-notes">Notas (opcional)</Label>
              <Textarea
                id="fav-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Categoría habitual, preferencias, etc."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFormModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Añadir favorito'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, id: null, name: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar favorito</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que quieres eliminar a <strong>{deleteConfirm.name}</strong>? Los participantes que ya
              añadiste desde este favorito a otras competiciones se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FavoritePilots;
