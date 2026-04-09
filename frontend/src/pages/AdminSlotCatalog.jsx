import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Spinner } from '../components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Database, Upload, GitPullRequest, PlusCircle } from 'lucide-react';
import { VEHICLE_TYPES } from '../data/vehicleTypes';

const emptyItem = {
  reference: '',
  manufacturer: '',
  model_name: '',
  vehicle_type: '',
  commercial_release_date: '',
};

function AdminSlotCatalog() {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [tab, setTab] = useState('items');

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refFilter, setRefFilter] = useState('');
  const [mfgFilter, setMfgFilter] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [imageFile, setImageFile] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const [chgReq, setChgReq] = useState([]);
  const [insReq, setInsReq] = useState([]);
  const [queuesLoading, setQueuesLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const { data } = await api.get('/catalog/items', {
        params: { page, limit: 20, reference: refFilter || undefined, manufacturer: mfgFilter || undefined },
      });
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      setItemsError(e.response?.data?.error || e.message || 'Error');
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, [page, refFilter, mfgFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchItems();
  }, [isAdmin, fetchItems]);

  const fetchQueues = useCallback(async () => {
    setQueuesLoading(true);
    try {
      const [c, i] = await Promise.all([
        api.get('/catalog/change-requests', { params: { status: 'pending' } }),
        api.get('/catalog/insert-requests', { params: { status: 'pending' } }),
      ]);
      setChgReq(c.data.requests ?? []);
      setInsReq(i.data.requests ?? []);
    } catch {
      setChgReq([]);
      setInsReq([]);
    } finally {
      setQueuesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchQueues();
  }, [isAdmin, fetchQueues]);

  const openCreate = () => {
    setEditMode('create');
    setEditingId(null);
    setForm(emptyItem);
    setImageFile(null);
    setEditOpen(true);
  };

  const openEdit = (row) => {
    setEditMode('edit');
    setEditingId(row.id);
    setForm({
      reference: row.reference ?? '',
      manufacturer: row.manufacturer ?? '',
      model_name: row.model_name ?? '',
      vehicle_type: row.vehicle_type ?? '',
      commercial_release_date: row.commercial_release_date
        ? String(row.commercial_release_date).slice(0, 10)
        : '',
    });
    setImageFile(null);
    setEditOpen(true);
  };

  const saveItem = async () => {
    setFormSaving(true);
    try {
      const fd = new FormData();
      fd.append('reference', form.reference);
      fd.append('manufacturer', form.manufacturer);
      fd.append('model_name', form.model_name);
      if (form.vehicle_type) fd.append('vehicle_type', form.vehicle_type);
      if (form.commercial_release_date) fd.append('commercial_release_date', form.commercial_release_date);
      if (imageFile) fd.append('image', imageFile);

      if (editMode === 'create') {
        await api.post('/catalog/items', fd);
      } else {
        await api.put(`/catalog/items/${editingId}`, fd);
      }
      setEditOpen(false);
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message || 'Error al guardar');
    } finally {
      setFormSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/catalog/items/${deleteId}`);
      setDeleteId(null);
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const runImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const { data } = await api.post(`/catalog/import?duplicateMode=${duplicateMode}`, fd);
      setImportResult(data);
      fetchItems();
    } catch (e) {
      setImportResult({ error: e.response?.data?.error || e.message });
    } finally {
      setImportLoading(false);
    }
  };

  const approveChg = async (id) => {
    try {
      await api.post(`/catalog/change-requests/${id}/approve`);
      fetchQueues();
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const rejectChg = async (id) => {
    const reason = window.prompt('Motivo (opcional)') ?? '';
    try {
      await api.post(`/catalog/change-requests/${id}/reject`, { reason });
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const approveIns = async (id) => {
    try {
      await api.post(`/catalog/insert-requests/${id}/approve`);
      fetchQueues();
      fetchItems();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  const rejectIns = async (id) => {
    const reason = window.prompt('Motivo (opcional)') ?? '';
    try {
      await api.post(`/catalog/insert-requests/${id}/reject`, { reason });
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/vehicles" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="size-7" />
            Catálogo slot
          </h1>
          <p className="text-sm text-muted-foreground">Gestión del catálogo colaborativo (solo administradores).</p>
        </div>
        <Button onClick={openCreate}>
          <PlusCircle className="size-4 mr-2" />
          Nuevo ítem
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="items">Ítems</TabsTrigger>
          <TabsTrigger value="import">
            <Upload className="size-4 mr-1 inline" />
            Importar
          </TabsTrigger>
          <TabsTrigger value="queues">
            <GitPullRequest className="size-4 mr-1 inline" />
            Colas ({chgReq.length + insReq.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Listado</CardTitle>
              <CardDescription>
                CSV/Excel: reference, manufacturer, model_name, vehicle_type (opcional, mismo listado que en vehículos), commercial_release_date (opcional).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  placeholder="Filtrar referencia"
                  value={refFilter}
                  onChange={e => { setRefFilter(e.target.value); setPage(1); }}
                  className="max-w-xs"
                />
                <Input
                  placeholder="Filtrar marca"
                  value={mfgFilter}
                  onChange={e => { setMfgFilter(e.target.value); setPage(1); }}
                  className="max-w-xs"
                />
                <Button type="button" variant="secondary" onClick={() => fetchItems()}>
                  Aplicar
                </Button>
              </div>
              {itemsLoading ? (
                <Spinner className="mx-auto" />
              ) : itemsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{itemsError}</AlertDescription>
                </Alert>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Comercialización</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-sm">{row.reference}</TableCell>
                        <TableCell>{row.manufacturer}</TableCell>
                        <TableCell>{row.model_name}</TableCell>
                        <TableCell>{row.vehicle_type || '—'}</TableCell>
                        <TableCell>{row.commercial_release_date || '—'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleteId(row.id)}>
                            Eliminar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} / {totalPages || 1}
                </span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Siguiente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importar CSV o Excel</CardTitle>
              <CardDescription>La primera fila debe ser cabecera. PDF: exporta a Excel/CSV primero.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Archivo</Label>
                <Input type="file" accept=".csv,.xlsx,.xls" onChange={e => setImportFile(e.target.files?.[0] || null)} />
              </div>
              <div className="space-y-2">
                <Label>Si la referencia ya existe</Label>
                <Select value={duplicateMode} onValueChange={setDuplicateMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Omitir fila</SelectItem>
                    <SelectItem value="update">Actualizar marca/nombre/fecha</SelectItem>
                    <SelectItem value="fail">Registrar error y continuar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runImport} disabled={!importFile || importLoading}>
                {importLoading ? 'Importando…' : 'Importar'}
              </Button>
              {importResult && (
                <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
                  {JSON.stringify(importResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queues" className="space-y-4 mt-4">
          {queuesLoading ? (
            <Spinner className="mx-auto" />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Ediciones propuestas</CardTitle>
                </CardHeader>
                <CardContent>
                  {chgReq.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ítem</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chgReq.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{r.catalog_item_id}</TableCell>
                            <TableCell>{r.status}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button size="sm" onClick={() => approveChg(r.id)}>Aprobar</Button>
                              <Button size="sm" variant="outline" onClick={() => rejectChg(r.id)}>Rechazar</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Altas propuestas</CardTitle>
                </CardHeader>
                <CardContent>
                  {insReq.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Marca / Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insReq.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{r.proposed_reference}</TableCell>
                            <TableCell>{r.proposed_manufacturer} — {r.proposed_model_name}</TableCell>
                            <TableCell>{r.proposed_vehicle_type || '—'}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button size="sm" onClick={() => approveIns(r.id)}>Aprobar</Button>
                              <Button size="sm" variant="outline" onClick={() => rejectIns(r.id)}>Rechazar</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode === 'create' ? 'Nuevo ítem del catálogo' : 'Editar ítem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Referencia</Label>
              <Input name="reference" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Marca</Label>
              <Input value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nombre / modelo</Label>
              <Input value={form.model_name} onChange={e => setForm(f => ({ ...f, model_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.vehicle_type || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, vehicle_type: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tipo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin tipo —</SelectItem>
                  {VEHICLE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comercialización</Label>
              <Input
                type="date"
                value={form.commercial_release_date}
                onChange={e => setForm(f => ({ ...f, commercial_release_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Imagen (opcional)</Label>
              <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveItem} disabled={formSaving}>
              {formSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ítem del catálogo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AdminSlotCatalog;
