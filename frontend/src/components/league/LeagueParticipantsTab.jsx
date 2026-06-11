import React, { useState } from 'react';
import { Users, Plus, Trash2, Pencil, Import } from 'lucide-react';
import axios from '../../lib/axios';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { Spinner } from '../ui/spinner';

const emptyForm = { name: '', email: '', vehicle_model: '', status: 'confirmed' };

const LeagueParticipantsTab = ({ league, canManage, onRefresh }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, participantId: null });
  const [importing, setImporting] = useState(false);

  const participants = league?.participants || [];
  const hasCompetitions = (league?.competitions || []).length > 0;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setAdding(true);
      await axios.post(`/leagues/${league.id}/participants`, {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        vehicle_model: form.vehicle_model.trim() || undefined,
      });
      toast.success('Participante añadido');
      setShowAdd(false);
      setForm(emptyForm);
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al añadir participante');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      email: p.email || '',
      vehicle_model: p.vehicle_model || '',
      status: p.status || 'confirmed',
    });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing || !form.name.trim()) return;
    try {
      setSaving(true);
      await axios.patch(`/leagues/${league.id}/participants/${editing.id}`, {
        name: form.name.trim(),
        email: form.email.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        status: form.status,
      });
      toast.success('Participante actualizado');
      setEditing(null);
      setForm(emptyForm);
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleImportFromCompetitions = async () => {
    try {
      setImporting(true);
      const res = await axios.post(`/leagues/${league.id}/import-from-competitions`);
      const created = res.data.created || 0;
      const updated = res.data.updated || 0;
      if (created === 0 && updated === 0) {
        toast.info(res.data.message || 'No hay participantes nuevos para importar');
      } else {
        const parts = [];
        if (created > 0) parts.push(`${created} nuevos`);
        if (updated > 0) parts.push(`${updated} actualizados`);
        toast.success(`Importados desde competiciones: ${parts.join(', ')}`);
        onRefresh?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al importar participantes');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.participantId) return;
    try {
      await axios.delete(`/leagues/${league.id}/participants/${deleteConfirm.participantId}`);
      toast.success('Participante eliminado');
      setDeleteConfirm({ open: false, participantId: null });
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar participante');
    }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex flex-wrap justify-end gap-2">
          {hasCompetitions && (
            <Button
              variant="outline"
              onClick={handleImportFromCompetitions}
              disabled={importing}
            >
              <Import className={`size-4 mr-2 ${importing ? 'animate-pulse' : ''}`} />
              Importar desde competiciones
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="size-4 mr-2" />
            Añadir participante
          </Button>
        </div>
      )}

      {participants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="size-8 mx-auto mb-3 opacity-50" />
            <p>No hay participantes inscritos en la liga.</p>
            {canManage && hasCompetitions && (
              <p className="text-sm mt-2">
                Si tus pruebas ya tienen pilotos, usa «Importar desde competiciones».
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.email || '—'}</TableCell>
                    <TableCell>
                      {p.vehicles
                        ? `${p.vehicles.manufacturer} ${p.vehicles.model}`
                        : p.vehicle_model || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === 'waitlist' ? 'outline' : 'secondary'}>
                        {p.status === 'waitlist' ? 'Lista espera' : 'Confirmado'}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm({ open: true, participantId: p.id })}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir participante a la liga</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lp-name">Nombre *</Label>
              <Input
                id="lp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-email">Email</Label>
              <Input
                id="lp-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lp-vehicle">Vehículo</Label>
              <Input
                id="lp-vehicle"
                value={form.vehicle_model}
                onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? <Spinner className="size-4" /> : 'Añadir'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar participante</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vehículo</Label>
              <Input
                value={form.vehicle_model}
                onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="waitlist">Lista de espera</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner className="size-4" /> : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, participantId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar participante?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará de la liga. No afecta a inscripciones ya sincronizadas en pruebas individuales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeagueParticipantsTab;
