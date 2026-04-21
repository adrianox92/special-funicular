import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { ChangelogMarkdown } from '../components/ChangelogMarkdown';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Switch } from '../components/ui/switch';
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
import { Megaphone, Pencil, Plus, RefreshCw, Trash2, Eye, ExternalLink } from 'lucide-react';

const CATEGORIES = [
  { value: 'feature', label: 'Novedad' },
  { value: 'fix', label: 'Corrección' },
  { value: 'improvement', label: 'Mejora' },
  { value: 'breaking', label: 'Cambio importante' },
];

const emptyForm = {
  version: '',
  title: '',
  body_md: '',
  category: 'feature',
  is_featured: false,
};

const AdminChangelog = () => {
  const { user } = useAuth();
  const isAdmin = isLicenseAdminUser(user);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/changelog/admin');
      setEntries(Array.isArray(data?.entries) ? data.entries : []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al cargar';
      setError(msg);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void fetchEntries();
  }, [isAdmin, fetchEntries]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      version: row.version || '',
      title: row.title || '',
      body_md: row.body_md || '',
      category: row.category || 'feature',
      is_featured: !!row.is_featured,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) {
      toast.error('El título es obligatorio');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { data } = await api.put(`/changelog/admin/${editingId}`, {
          title,
          body_md: form.body_md,
          version: form.version.trim() || null,
          category: form.category,
          is_featured: form.is_featured,
        });
        const updated = data?.entry;
        if (updated) {
          setEntries((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        }
        toast.success('Entrada actualizada');
      } else {
        const { data } = await api.post('/changelog/admin', {
          title,
          body_md: form.body_md,
          version: form.version.trim() || null,
          category: form.category,
          is_featured: form.is_featured,
        });
        const created = data?.entry;
        if (created) setEntries((rows) => [created, ...rows]);
        toast.success('Borrador creado');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id) => {
    setBusyId(id);
    try {
      const { data } = await api.post(`/changelog/admin/${id}/publish`);
      const updated = data?.entry;
      if (updated) setEntries((rows) => rows.map((r) => (r.id === id ? updated : r)));
      toast.success('Publicado');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnpublish = async (id) => {
    setBusyId(id);
    try {
      const { data } = await api.post(`/changelog/admin/${id}/unpublish`);
      const updated = data?.entry;
      if (updated) setEntries((rows) => rows.map((r) => (r.id === id ? updated : r)));
      toast.success('Despublicado');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setBusyId(deleteId);
    try {
      await api.delete(`/changelog/admin/${deleteId}`);
      setEntries((rows) => rows.filter((r) => r.id !== deleteId));
      toast.success('Eliminado');
      setDeleteId(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Error');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="size-7" />
            Changelog (admin)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea borradores y publícalos cuando quieras. Los usuarios las ven en la campana y en{' '}
            <Link to="/changelog" className="text-primary underline inline-flex items-center gap-0.5">
              Novedades
              <ExternalLink className="size-3" />
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchEntries()} disabled={loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            Actualizar
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Nueva entrada
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Entradas</CardTitle>
          <CardDescription>Borradores y publicadas. Requiere SUPABASE_SERVICE_ROLE_KEY en el servidor.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-8" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Versión</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay entradas. Crea la primera.
                      </TableCell>
                    </TableRow>
                  )}
                  {entries.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">{row.title}</TableCell>
                      <TableCell className="text-muted-foreground">{row.version || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {CATEGORIES.find((c) => c.value === row.category)?.label || row.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.published_at ? (
                          <Badge variant="default">Publicado</Badge>
                        ) : (
                          <Badge variant="outline">Borrador</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEdit(row)}
                            aria-label="Editar"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {row.published_at ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={busyId === row.id}
                              onClick={() => void handleUnpublish(row.id)}
                            >
                              Despublicar
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={busyId === row.id}
                              onClick={() => void handlePublish(row.id)}
                            >
                              Publicar
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            onClick={() => setDeleteId(row.id)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar entrada' : 'Nueva entrada'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cl-title">Título</Label>
                <Input
                  id="cl-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ej. Inscripciones con vehículo vinculado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cl-version">Versión (opcional)</Label>
                <Input
                  id="cl-version"
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="v1.8.0"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  id="cl-featured"
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_featured: v }))}
                />
                <Label htmlFor="cl-featured" className="cursor-pointer">
                  Destacado
                </Label>
              </div>
            </div>
            <Tabs defaultValue="edit">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Editar</TabsTrigger>
                <TabsTrigger value="preview" className="gap-1">
                  <Eye className="size-3.5" />
                  Vista previa
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-3">
                <Label htmlFor="cl-body">Contenido (Markdown)</Label>
                <textarea
                  id="cl-body"
                  className="mt-2 flex min-h-[280px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.body_md}
                  onChange={(e) => setForm((f) => ({ ...f, body_md: e.target.value }))}
                  placeholder={'## Qué hay de nuevo\n\n- Punto uno\n- Punto dos'}
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-3 rounded-md border p-4 bg-muted/30">
                <ChangelogMarkdown>{form.body_md}</ChangelogMarkdown>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si estaba publicada, dejará de mostrarse a los usuarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminChangelog;
