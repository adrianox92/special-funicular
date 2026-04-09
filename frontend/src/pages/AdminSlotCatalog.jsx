import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { supabase } from '../lib/supabase';
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
import { MOTOR_POSITION_OPTIONS, labelMotorPosition } from '../data/motorPosition';

const emptyItem = {
  reference: '',
  manufacturer: '',
  model_name: '',
  vehicle_type: '',
  traction: '',
  motor_position: '',
  commercial_release_year: '',
};

const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

/**
 * POST /catalog/import (NDJSON). onProgress(current, total) tras cada fila procesada.
 */
async function runCatalogImportStream(file, duplicateMode, onProgress) {
  const url = `${apiBase}/catalog/import?duplicateMode=${encodeURIComponent(duplicateMode)}`;

  const fetchOnce = (token) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
  };

  let { data: { session } } = await supabase.auth.getSession();
  let response = await fetchOnce(session?.access_token);
  if (response.status === 401) {
    await supabase.auth.refreshSession();
    ({ data: { session } } = await supabase.auth.getSession());
    response = await fetchOnce(session?.access_token);
  }

  if (!response.ok) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await response.json().catch(() => ({}));
      throw new Error(j.error || `Error ${response.status}`);
    }
    const text = await response.text();
    throw new Error(text || `Error ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('El navegador no permite leer el progreso de la importación.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let completePayload = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      let msg;
      try {
        msg = JSON.parse(t);
      } catch {
        continue;
      }
      if (msg.type === 'progress' && onProgress) {
        onProgress(msg.current ?? 0, msg.total ?? 0);
      }
      if (msg.type === 'complete') {
        const { type, ...rest } = msg;
        void type;
        completePayload = rest;
      }
      if (msg.type === 'error') {
        throw new Error(msg.message || 'Error en la importación');
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      const msg = JSON.parse(tail);
      if (msg.type === 'complete') {
        const { type, ...rest } = msg;
        void type;
        completePayload = rest;
      }
      if (msg.type === 'error') throw new Error(msg.message || 'Error en la importación');
    } catch (e) {
      if (e instanceof SyntaxError) {
        /* línea incompleta al cortar el stream */
      } else {
        throw e;
      }
    }
  }

  if (!completePayload) {
    throw new Error('Respuesta de importación incompleta.');
  }
  return completePayload;
}

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
  /** URL guardada en servidor al editar (solo lectura en el formulario). */
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  /** Vista previa de archivo nuevo elegido (object URL). */
  const [newImageObjectUrl, setNewImageObjectUrl] = useState(null);
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => {
    if (!imageFile) {
      setNewImageObjectUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setNewImageObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  const [deleteId, setDeleteId] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

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
    setExistingImageUrl(null);
    setNewImageObjectUrl(null);
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
      traction: row.traction ?? '',
      motor_position: row.motor_position ?? '',
      commercial_release_year:
        row.commercial_release_year != null && row.commercial_release_year !== ''
          ? String(row.commercial_release_year)
          : '',
    });
    setImageFile(null);
    const url = row.image_url != null && String(row.image_url).trim() ? String(row.image_url) : null;
    setExistingImageUrl(url);
    setNewImageObjectUrl(null);
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
      fd.append('traction', form.traction ?? '');
      fd.append('motor_position', form.motor_position ?? '');
      if (form.commercial_release_year) fd.append('commercial_release_year', form.commercial_release_year);
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
    setImportProgress({ current: 0, total: 0 });
    try {
      const data = await runCatalogImportStream(importFile, duplicateMode, (current, total) => {
        setImportProgress({ current, total });
      });
      setImportResult(data);
      fetchItems();
    } catch (e) {
      setImportResult({ error: e.message || 'Error al importar' });
    } finally {
      setImportLoading(false);
      setImportProgress(null);
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
                CSV/Excel: reference, manufacturer, model_name, vehicle_type (opcional), traction (opcional), motor_position (opcional: inline, angular, transverse, transversal, en línea, en angular…), commercial_release_year (opcional, solo año).
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
                      <TableHead>Tracción</TableHead>
                      <TableHead>Motor</TableHead>
                      <TableHead>Año</TableHead>
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
                        <TableCell>{row.traction || '—'}</TableCell>
                        <TableCell>{labelMotorPosition(row.motor_position)}</TableCell>
                        <TableCell>{row.commercial_release_year ?? '—'}</TableCell>
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
                <Label>Si la referencia y la marca ya existen</Label>
                <Select value={duplicateMode} onValueChange={setDuplicateMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Omitir fila</SelectItem>
                    <SelectItem value="update">Actualizar marca/nombre/año</SelectItem>
                    <SelectItem value="fail">Registrar error y continuar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={runImport} disabled={!importFile || importLoading}>
                {importLoading ? 'Importando…' : 'Importar'}
              </Button>
              {importLoading && importProgress && (
                <div className="space-y-2 max-w-md">
                  <p className="text-sm text-muted-foreground">
                    {importProgress.total > 0
                      ? `Procesando filas: ${importProgress.current} / ${importProgress.total}`
                      : 'Leyendo archivo…'}
                  </p>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-[width] duration-150 ease-out rounded-full"
                      style={{
                        width:
                          importProgress.total > 0
                            ? `${Math.min(100, (importProgress.current / importProgress.total) * 100)}%`
                            : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
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
                          <TableHead>Tracción / motor</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insReq.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{r.proposed_reference}</TableCell>
                            <TableCell>{r.proposed_manufacturer} — {r.proposed_model_name}</TableCell>
                            <TableCell>{r.proposed_vehicle_type || '—'}</TableCell>
                            <TableCell className="text-sm">
                              {[r.proposed_traction, r.proposed_motor_position ? labelMotorPosition(r.proposed_motor_position) : null]
                                .filter(Boolean)
                                .join(' · ') || '—'}
                            </TableCell>
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
              <Label>Tracción</Label>
              <Input
                value={form.traction}
                onChange={e => setForm(f => ({ ...f, traction: e.target.value }))}
                placeholder="Opcional (ej. trasera, AWD)"
              />
            </div>
            <div className="space-y-2">
              <Label>Posición del motor</Label>
              <Select
                value={form.motor_position || '__none__'}
                onValueChange={v => setForm(f => ({ ...f, motor_position: v === '__none__' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin especificar —</SelectItem>
                  {MOTOR_POSITION_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
                value={form.commercial_release_year}
                onChange={e => setForm(f => ({ ...f, commercial_release_year: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Solo el año (opcional).</p>
            </div>
            <div className="space-y-2">
              <Label>Imagen (opcional)</Label>
              {(newImageObjectUrl || existingImageUrl) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {newImageObjectUrl ? 'Vista previa (sustituirá la actual al guardar)' : 'Imagen actual'}
                  </p>
                  <img
                    src={newImageObjectUrl || existingImageUrl}
                    alt=""
                    className="max-h-48 w-auto max-w-full rounded-md border object-contain bg-muted/30"
                  />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
              />
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
