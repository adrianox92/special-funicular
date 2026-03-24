import React, { useState, useEffect } from 'react';
import { Plus, Flag, Trash2, Pen } from 'lucide-react';
import axios from '../lib/axios';
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
  DialogTrigger,
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

const Circuits = () => {
  const [circuits, setCircuits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCircuit, setEditingCircuit] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    num_lanes: '2',
    lane_lengths: []
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, circuit: null });

  const loadCircuits = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/circuits');
      setCircuits(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar circuitos:', err);
      setError('Error al cargar los circuitos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCircuits();
  }, []);

  const initForm = (circuit = null) => {
    if (circuit) {
      const lengths = Array.isArray(circuit.lane_lengths) ? circuit.lane_lengths : [];
      const numLanes = circuit.num_lanes || lengths.length || 2;
      const paddedLengths = Array(numLanes).fill(null).map((_, i) => lengths[i] ?? 0);
      setFormData({
        name: circuit.name || '',
        description: circuit.description || '',
        num_lanes: String(numLanes),
        lane_lengths: paddedLengths
      });
      setEditingCircuit(circuit);
    } else {
      setFormData({
        name: '',
        description: '',
        num_lanes: '2',
        lane_lengths: [0, 0]
      });
      setEditingCircuit(null);
    }
    setFormError(null);
  };

  const handleNumLanesChange = (num) => {
    const n = Math.max(1, parseInt(num, 10) || 1);
    const current = formData.lane_lengths;
    const newLengths = Array(n).fill(null).map((_, i) => current[i] ?? 0);
    setFormData({
      ...formData,
      num_lanes: String(n),
      lane_lengths: newLengths
    });
  };

  const handleLaneLengthChange = (index, value) => {
    const v = parseFloat(value) || 0;
    const newLengths = [...formData.lane_lengths];
    newLengths[index] = v;
    setFormData({ ...formData, lane_lengths: newLengths });
  };

  const handleOpenCreate = () => {
    initForm(null);
    setShowModal(true);
  };

  const handleOpenEdit = (circuit) => {
    initForm(circuit);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }
    const numLanes = parseInt(formData.num_lanes, 10);
    if (isNaN(numLanes) || numLanes < 1) {
      setFormError('El número de carriles debe ser al menos 1');
      return;
    }

    try {
      setSaving(true);
      setFormError(null);

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        num_lanes: numLanes,
        lane_lengths: formData.lane_lengths.slice(0, numLanes).map((v) => Number(v) || 0)
      };

      if (editingCircuit) {
        await axios.put(`/circuits/${editingCircuit.id}`, payload);
      } else {
        await axios.post('/circuits', payload);
      }

      setShowModal(false);
      loadCircuits();
    } catch (err) {
      console.error('Error al guardar circuito:', err);
      setFormError(err.response?.data?.error || 'Error al guardar el circuito');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (circuit) => {
    setDeleteConfirm({ open: true, circuit });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.circuit) return;
    try {
      await axios.delete(`/circuits/${deleteConfirm.circuit.id}`);
      setDeleteConfirm({ open: false, circuit: null });
      loadCircuits();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.usedBy;
      toast.error(msg || 'Error al eliminar el circuito');
    }
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold">Circuitos</h1>
          <p className="text-muted-foreground">Gestiona tus circuitos con número de carriles y longitudes</p>
        </div>
        <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, circuit: null })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar circuito?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteConfirm.circuit
                  ? `¿Eliminar el circuito "${deleteConfirm.circuit.name}"? Esta acción no se puede deshacer.`
                  : 'Esta acción no se puede deshacer.'}
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

        <Dialog open={showModal} onOpenChange={(open) => { setShowModal(open); if (!open) setEditingCircuit(null); }}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2" onClick={handleOpenCreate}>
              <Plus className="size-4" />
              Nuevo Circuito
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCircuit ? 'Editar Circuito' : 'Nuevo Circuito'}</DialogTitle>
              <DialogDescription>
                Define el nombre, descripción, número de carriles y longitud de cada uno (en metros)
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Circuito de Barcelona"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    placeholder="Opcional"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="num_lanes">Número de carriles</Label>
                  <Input
                    id="num_lanes"
                    type="number"
                    min="1"
                    max="8"
                    value={formData.num_lanes}
                    onChange={(e) => handleNumLanesChange(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Longitud por carril (metros)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {formData.lane_lengths.map((len, i) => (
                      <div key={i} className="space-y-1">
                        <Label htmlFor={`lane-${i}`} className="text-xs">Carril {i + 1}</Label>
                        <Input
                          id={`lane-${i}`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={len}
                          onChange={(e) => handleLaneLengthChange(i, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <><Spinner className="size-4 mr-2" /> Guardando...</> : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {circuits.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Flag className="size-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="mb-2">No tienes circuitos</h4>
            <p className="text-muted-foreground mb-6">
              Crea tu primer circuito para usarlo en competiciones y tiempos
            </p>
            <Button onClick={handleOpenCreate} className="flex items-center gap-2 mx-auto">
              <Plus className="size-4" />
              Crear Primer Circuito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {circuits.map((circuit) => (
            <Card key={circuit.id} className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <h5 className="font-semibold text-lg">{circuit.name}</h5>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(circuit)}>
                      <Pen className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(circuit)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                {circuit.description && (
                  <p className="text-sm text-muted-foreground mb-3">{circuit.description}</p>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Flag className="size-4" />
                    {circuit.num_lanes} carril{circuit.num_lanes !== 1 ? 'es' : ''}
                  </div>
                  {Array.isArray(circuit.lane_lengths) && circuit.lane_lengths.length > 0 && (
                    <div className="text-muted-foreground min-w-0 break-words">
                      Longitudes: {circuit.lane_lengths.map((l, i) => `${i + 1}: ${l}m`).join(', ')}
                    </div>
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

export default Circuits;
