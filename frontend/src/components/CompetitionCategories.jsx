import React, { useState, useEffect } from 'react';
import { Tags, Plus, Pencil, Trash2, FileText } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Spinner } from './ui/spinner';
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
} from './ui/alert-dialog';
import CompetitionRegulation from './CompetitionRegulation';
import { hasRegulation } from '../utils/competitionRegulation';

const REGULATION_MAX = 10 * 1024 * 1024;
const ACCEPTED_TYPES = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const emptyForm = () => ({
  name: '',
  regulation_url: '',
  regulationMode: 'none',
});

const CompetitionCategories = ({ competitionId, onCategoryChange, readOnly = false }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [pendingFile, setPendingFile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, categoryId: null });

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}/categories`);
      setCategories(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
      setError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  const openModal = (category = null) => {
    setEditingCategory(category);
    setFormData({
      name: category ? category.name : '',
      regulation_url: category?.regulation_url || '',
      regulationMode: category?.regulation_url
        ? 'url'
        : category?.regulation_file_path
          ? 'file'
          : 'none',
    });
    setPendingFile(null);
    setShowModal(true);
    setSaveError(null);
  };

  const uploadCategoryRegulation = async (categoryId, file) => {
    if (file.size > REGULATION_MAX) {
      throw new Error('El archivo no puede superar 10 MB');
    }
    const fd = new FormData();
    fd.append('file', file);
    await axios.post(`/competitions/${competitionId}/categories/${categoryId}/regulation`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setSaveError('El nombre de la categoría es requerido');
      return;
    }
    if (formData.regulationMode === 'file' && pendingFile && pendingFile.size > REGULATION_MAX) {
      setSaveError('El archivo no puede superar 10 MB');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);

      const payload = {
        name: formData.name.trim(),
        regulation_url:
          formData.regulationMode === 'url' ? formData.regulation_url.trim() || null : null,
      };

      let categoryId = editingCategory?.id;
      if (editingCategory) {
        if (formData.regulationMode === 'none' && editingCategory.regulation_file_path) {
          await axios.delete(
            `/competitions/${competitionId}/categories/${editingCategory.id}/regulation`
          );
        }
        await axios.put(`/competitions/${competitionId}/categories/${editingCategory.id}`, payload);
      } else {
        const { data } = await axios.post(`/competitions/${competitionId}/categories`, payload);
        categoryId = data.id;
      }

      if (formData.regulationMode === 'file' && pendingFile && categoryId) {
        await uploadCategoryRegulation(categoryId, pendingFile);
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData(emptyForm());
      setPendingFile(null);
      loadCategories();
      onCategoryChange?.();
      toast.success(editingCategory ? 'Categoría actualizada' : 'Categoría creada');
    } catch (err) {
      console.error('Error al guardar categoría:', err);
      setSaveError(err.response?.data?.error || err.message || 'Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRegulationFile = async () => {
    if (!editingCategory) return;
    try {
      setSaving(true);
      await axios.delete(
        `/competitions/${competitionId}/categories/${editingCategory.id}/regulation`
      );
      setEditingCategory((prev) =>
        prev
          ? {
              ...prev,
              regulation_file_path: null,
              regulation_file_name: null,
              regulation_file_url: null,
            }
          : prev
      );
      setFormData((prev) => ({ ...prev, regulationMode: 'none' }));
      toast.success('Fichero de reglamento eliminado');
      loadCategories();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar el fichero');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (categoryId) => {
    setDeleteConfirm({ open: true, categoryId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.categoryId) return;
    try {
      await axios.delete(`/competitions/${competitionId}/categories/${deleteConfirm.categoryId}`);
      setDeleteConfirm({ open: false, categoryId: null });
      loadCategories();
      onCategoryChange?.();
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      toast.error('Error al eliminar la categoría');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Tags className="size-4" />
            Categorías
          </h6>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Spinner className="size-6 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Cargando categorías...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {categories.length === 0 && (
        <div className="mb-4">
          <CompetitionRegulation competitionId={competitionId} readOnly={readOnly} />
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h6 className="font-semibold flex items-center gap-2">
            <Tags className="size-4" />
            Categorías ({categories.length})
          </h6>
          {!readOnly && (
            <Button size="sm" onClick={() => openModal()} className="flex items-center gap-1">
              <Plus className="size-4" />
              Añadir
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {categories.length === 0 ? (
            <div className="text-center py-8">
              <Tags className="size-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No hay categorías definidas</p>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => openModal()} className="flex items-center gap-1 mx-auto">
                  <Plus className="size-4" />
                  Crear Primera Categoría
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{category.name}</Badge>
                    {hasRegulation(category) && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="size-3.5" />
                        Reglamento
                      </span>
                    )}
                  </div>
                  {!readOnly && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openModal(category)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, categoryId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer.
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
      )}

      {!readOnly && (
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-5" />
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
            <DialogDescription>Define una categoría para agrupar participantes similares</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              {saveError && (
                <Alert variant="destructive">
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="category-name">Nombre de la categoría</Label>
                <Input
                  id="category-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: F1, GT, Rally, Clásicos..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Reglamento (opcional)</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'none', label: 'Sin reglamento' },
                    { value: 'url', label: 'URL externa' },
                    { value: 'file', label: 'Subir fichero' },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      type="button"
                      size="sm"
                      variant={formData.regulationMode === opt.value ? 'default' : 'outline'}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, regulationMode: opt.value }));
                        if (opt.value !== 'file') setPendingFile(null);
                      }}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {formData.regulationMode === 'url' && (
                <div className="space-y-2">
                  <Label htmlFor="category-regulation-url">URL del reglamento</Label>
                  <Input
                    id="category-regulation-url"
                    type="url"
                    value={formData.regulation_url}
                    onChange={(e) => setFormData({ ...formData, regulation_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              {formData.regulationMode === 'file' && (
                <div className="space-y-2">
                  {editingCategory?.regulation_file_name && !pendingFile && (
                    <div className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4" />
                        {editingCategory.regulation_file_name}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={handleRemoveRegulationFile}
                        disabled={saving}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                  <Label htmlFor="category-regulation-file">Fichero (PDF o Word, máx. 10 MB)</Label>
                  <Input
                    id="category-regulation-file"
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    Guardando...
                  </>
                ) : (
                  editingCategory ? 'Actualizar' : 'Crear'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      )}
    </>
  );
};

export default CompetitionCategories;
