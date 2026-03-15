import React, { useState, useEffect } from 'react';
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';
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

const CompetitionCategories = ({ competitionId, onCategoryChange }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '' });

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
  }, [competitionId]);

  const openModal = (category = null) => {
    setEditingCategory(category);
    setFormData({ name: category ? category.name : '' });
    setShowModal(true);
    setSaveError(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setSaveError('El nombre de la categoría es requerido');
      return;
    }
    try {
      setSaving(true);
      setSaveError(null);
      if (editingCategory) {
        await axios.put(`/competitions/${competitionId}/categories/${editingCategory.id}`, formData);
      } else {
        await axios.post(`/competitions/${competitionId}/categories`, formData);
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '' });
      loadCategories();
      onCategoryChange?.();
    } catch (err) {
      console.error('Error al guardar categoría:', err);
      setSaveError(err.response?.data?.error || 'Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta categoría? Esta acción no se puede deshacer.')) return;
    try {
      await axios.delete(`/competitions/${competitionId}/categories/${categoryId}`);
      loadCategories();
      onCategoryChange?.();
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      alert('Error al eliminar la categoría');
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h6 className="font-semibold flex items-center gap-2">
            <Tags className="size-4" />
            Categorías ({categories.length})
          </h6>
          <Button size="sm" onClick={() => openModal()} className="flex items-center gap-1">
            <Plus className="size-4" />
            Añadir
          </Button>
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
              <Button variant="outline" size="sm" onClick={() => openModal()} className="flex items-center gap-1 mx-auto">
                <Plus className="size-4" />
                Crear Primera Categoría
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <Badge variant="secondary">{category.name}</Badge>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
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
    </>
  );
};

export default CompetitionCategories;
