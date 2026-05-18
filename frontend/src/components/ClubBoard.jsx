import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Trash2,
  Link as LinkIcon,
  Globe,
} from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { toast } from 'sonner';

const PDF_MAX = 6 * 1024 * 1024;

const emptyForm = () => ({
  title: '',
  body: '',
  link_url: '',
  link_label: '',
  document_url: '',
  document_label: '',
  documentMode: 'url',
  pinned: false,
  sort_order: 0,
  is_public: false,
});

const ClubBoard = ({ clubId, canManage }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const load = useCallback(async () => {
    if (!clubId) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/clubs/${clubId}/board`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'No se pudo cargar el tablón');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setPendingFile(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title || '',
      body: row.body || '',
      link_url: row.link_url || '',
      link_label: row.link_label || '',
      document_url: row.document_url || '',
      document_label: row.document_label || '',
      documentMode: row.document_url ? 'url' : 'url',
      pinned: Boolean(row.pinned),
      sort_order: row.sort_order ?? 0,
      is_public: Boolean(row.is_public),
    });
    setPendingFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!clubId || !form.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }

    if (form.documentMode === 'file' && !editing && !pendingFile) {
      toast.error('Selecciona un PDF o usa enlace externo');
      return;
    }

    setSaving(true);
    try {
      let uploaded = null;
      if (form.documentMode === 'file' && pendingFile) {
        if (pendingFile.size > PDF_MAX) {
          toast.error('El PDF no puede superar 6 MB');
          return;
        }
        const fd = new FormData();
        fd.append('file', pendingFile);
        const { data: up } = await axios.post(`/clubs/${clubId}/board/upload`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded = { url: up.url, storage_path: up.storage_path };
      }

      const sort_order = parseInt(String(form.sort_order || 0), 10) || 0;
      const base = {
        title: form.title.trim(),
        body: form.body.trim() || null,
        link_url: form.link_url.trim() || null,
        link_label: form.link_label.trim() || null,
        pinned: form.pinned,
        sort_order,
        is_public: form.is_public,
      };

      if (editing) {
        const patch = { ...base };

        if (form.documentMode === 'url') {
          patch.document_url = form.document_url.trim() || null;
          patch.document_label = form.document_label.trim() || null;
        } else if (uploaded) {
          patch.document_url = uploaded.url;
          patch.document_storage_path = uploaded.storage_path;
          const lbl = form.document_label.trim();
          patch.document_label =
            lbl || pendingFile?.name?.replace(/\.pdf$/i, '') || 'Documento';
        } else {
          const lbl = form.document_label.trim();
          if (lbl !== (editing.document_label || '')) {
            patch.document_label = lbl || null;
          }
        }

        await axios.put(`/clubs/${clubId}/board/${editing.id}`, patch);
        toast.success('Entrada actualizada');
      } else {
        const payload = { ...base };
        if (form.documentMode === 'url') {
          payload.document_url = form.document_url.trim() || null;
          payload.document_label = form.document_label.trim() || null;
        } else {
          payload.document_url = uploaded.url;
          payload.document_storage_path = uploaded.storage_path;
          const lbl = form.document_label.trim();
          payload.document_label = lbl || pendingFile.name.replace(/\.pdf$/i, '') || 'Documento';
        }
        await axios.post(`/clubs/${clubId}/board`, payload);
        toast.success('Entrada creada');
      }

      setDialogOpen(false);
      setEditing(null);
      setPendingFile(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !clubId) return;
    try {
      await axios.delete(`/clubs/${clubId}/board/${deleteTarget.id}`);
      toast.success('Entrada eliminada');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo eliminar');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Megaphone className="size-5" />
            Tablón del club
          </h2>
          <p className="text-sm text-muted-foreground">Avisos, enlaces y documentos para los miembros.</p>
        </div>
        {canManage ? (
          <Button type="button" size="sm" className="gap-1" onClick={openCreate}>
            <Plus className="size-4" />
            Nueva entrada
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <Card className="border-dashed bg-muted/15">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay entradas en el tablón.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => (
            <li key={row.id}>
              <Card className={row.pinned ? 'border-primary/40 bg-primary/5' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base leading-snug flex flex-wrap items-center gap-2">
                        {row.title}
                        {row.pinned ? (
                          <Badge variant="secondary" className="gap-1">
                            <Pin className="size-3" />
                            Fijado
                          </Badge>
                        ) : null}
                        {row.is_public ? (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Globe className="size-3" />
                            Ficha pública
                          </Badge>
                        ) : null}
                      </CardTitle>
                      {row.body ? <CardDescription className="whitespace-pre-wrap text-foreground">{row.body}</CardDescription> : null}
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(row)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label="Eliminar"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-0 text-sm">
                  {row.link_url ? (
                    <a
                      href={row.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                    >
                      <LinkIcon className="size-4 shrink-0" />
                      {row.link_label || row.link_url}
                    </a>
                  ) : null}
                  {row.document_url ? (
                    <a
                      href={row.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                    >
                      <FileText className="size-4 shrink-0" />
                      {row.document_label || 'Abrir PDF'}
                    </a>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!saving) {
            setDialogOpen(o);
            if (!o) setPendingFile(null);
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar entrada' : 'Nueva entrada'}</DialogTitle>
            <DialogDescription>
              Las entradas son visibles para los miembros del club. Marca &quot;Visible en ficha pública&quot; para
              mostrarlas también en la página pública del club.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cb-title">Título</Label>
              <Input
                id="cb-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-body">Texto (opcional)</Label>
              <Textarea
                id="cb-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={3}
                maxLength={8000}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cb-link-url">Enlace (URL)</Label>
                <Input
                  id="cb-link-url"
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="https://..."
                  maxLength={2000}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cb-link-label">Etiqueta del enlace</Label>
                <Input
                  id="cb-link-label"
                  value={form.link_label}
                  onChange={(e) => setForm((f) => ({ ...f, link_label: e.target.value }))}
                  placeholder="p. ej. Más info"
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Documento PDF (opcional)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cb-doc-mode"
                    className="accent-primary"
                    checked={form.documentMode === 'url'}
                    onChange={() => {
                      setForm((f) => ({ ...f, documentMode: 'url' }));
                      setPendingFile(null);
                    }}
                  />
                  Enlace externo
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="cb-doc-mode"
                    className="accent-primary"
                    checked={form.documentMode === 'file'}
                    onChange={() => setForm((f) => ({ ...f, documentMode: 'file' }))}
                  />
                  Subir PDF (máx. 6 MB)
                </label>
              </div>
              {form.documentMode === 'url' ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={form.document_url}
                    onChange={(e) => setForm((f) => ({ ...f, document_url: e.target.value }))}
                    placeholder="URL del PDF"
                    maxLength={2000}
                  />
                  <Input
                    value={form.document_label}
                    onChange={(e) => setForm((f) => ({ ...f, document_label: e.target.value }))}
                    placeholder="Texto del enlace"
                    maxLength={200}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && f.size > PDF_MAX) {
                        toast.error('El archivo supera 6 MB');
                        e.target.value = '';
                        setPendingFile(null);
                        return;
                      }
                      setPendingFile(f || null);
                    }}
                  />
                  <Input
                    value={form.document_label}
                    onChange={(e) => setForm((f) => ({ ...f, document_label: e.target.value }))}
                    placeholder="Etiqueta del documento (opcional)"
                    maxLength={200}
                  />
                  {editing && form.documentMode === 'file' && !pendingFile ? (
                    <p className="text-xs text-muted-foreground">
                      Deja vacío para mantener el PDF actual, o elige un fichero para reemplazarlo.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="cb-pin"
                  checked={form.pinned}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, pinned: v }))}
                />
                <Label htmlFor="cb-pin" className="font-normal">
                  Fijar arriba
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="cb-public"
                  checked={form.is_public}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_public: v }))}
                />
                <Label htmlFor="cb-public" className="font-normal">
                  Visible en ficha pública
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="cb-sort" className="text-muted-foreground whitespace-nowrap">
                  Orden
                </Label>
                <Input
                  id="cb-sort"
                  type="number"
                  className="w-24"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta entrada?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClubBoard;
