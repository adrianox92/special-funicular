import React, { useState } from 'react';
import { Users, Plus, Trash2 } from 'lucide-react';
import axios from '../../lib/axios';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
import { toast } from 'sonner';
import { Spinner } from '../ui/spinner';

const LeagueParticipantsTab = ({ league, canManage, onRefresh }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', vehicle_model: '' });
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, participantId: null });

  const participants = league?.participants || [];

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
      setForm({ name: '', email: '', vehicle_model: '' });
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al añadir participante');
    } finally {
      setAdding(false);
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
        <div className="flex justify-end">
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
                  {canManage && <TableHead className="w-16" />}
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
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirm({ open: true, participantId: p.id })}
                        >
                          <Trash2 className="size-4" />
                        </Button>
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
