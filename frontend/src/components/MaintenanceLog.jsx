import React, { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
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
import { MAINTENANCE_KINDS, formatMaintenanceKind, formatHistoryDate } from '../utils/formatUtils';

const emptyForm = () => ({
  performed_at: new Date().toISOString().slice(0, 10),
  kind: 'limpieza_general',
  notes: '',
  next_due_at: '',
});

const MaintenanceLog = ({ vehicleId, onLogsChange }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const pushLogs = useCallback(
    (next) => {
      setLogs(next);
      onLogsChange?.(next);
    },
    [onLogsChange],
  );

  const load = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/maintenance', { params: { vehicle_id: vehicleId } });
      const list = Array.isArray(data) ? data : [];
      pushLogs(list);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'No se pudo cargar el historial de mantenimiento');
      pushLogs([]);
    } finally {
      setLoading(false);
    }
  }, [vehicleId, pushLogs]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vehicleId) return;
    setSaving(true);
    try {
      const baseFields = {
        performed_at: form.performed_at,
        kind: form.kind,
        notes: form.notes.trim() || null,
        next_due_at: form.next_due_at ? form.next_due_at : null,
      };
      if (editingId) {
        const { data } = await api.put(`/maintenance/${editingId}`, baseFields);
        const next = logs
          .map((row) => (row.id === editingId ? data : row))
          .sort((a, b) => String(b.performed_at).localeCompare(String(a.performed_at)));
        pushLogs(next);
        toast.success('Mantenimiento actualizado');
      } else {
        const { data } = await api.post('/maintenance', { vehicle_id: vehicleId, ...baseFields });
        pushLogs([data, ...logs].sort((a, b) => String(b.performed_at).localeCompare(String(a.performed_at))));
        toast.success('Mantenimiento registrado');
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      performed_at: String(row.performed_at).slice(0, 10),
      kind: row.kind,
      notes: row.notes ?? '',
      next_due_at: row.next_due_at ? String(row.next_due_at).slice(0, 10) : '',
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/maintenance/${deleteId}`);
      pushLogs(logs.filter((l) => l.id !== deleteId));
      toast.success('Registro eliminado');
      if (editingId === deleteId) resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo eliminar');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <h4 className="text-lg font-semibold">Historial de mantenimiento</h4>
      <p className="text-sm text-muted-foreground">
        Registra limpieza, escobillas, engrase u otras intervenciones. Se pueden visualizar junto a la evolución de
        tiempos en el gráfico superior cuando hay sesiones el mismo día.
      </p>

      <form onSubmit={handleSubmit} className="rounded-md border p-4 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maint-date">Fecha del mantenimiento</Label>
            <Input
              id="maint-date"
              type="date"
              value={form.performed_at}
              onChange={(e) => setForm((f) => ({ ...f, performed_at: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maint-kind">Tipo</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
              <SelectTrigger id="maint-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maint-notes">Notas (opcional)</Label>
          <Textarea
            id="maint-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Detalle de la intervención…"
          />
        </div>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="maint-next">Próxima revisión (opcional)</Label>
          <Input
            id="maint-next"
            type="date"
            value={form.next_due_at}
            onChange={(e) => setForm((f) => ({ ...f, next_due_at: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Spinner className="size-4 mr-2" />
                Guardando…
              </>
            ) : editingId ? (
              'Actualizar registro'
            ) : (
              'Añadir registro'
            )}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancelar edición
            </Button>
          )}
        </div>
      </form>

      <div>
        <h5 className="font-medium mb-3">Registros</h5>
        {loading ? (
          <Spinner className="size-6" />
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay mantenimientos registrados.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead>Próxima</TableHead>
                  <TableHead className="w-[100px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{formatHistoryDate(row.performed_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatMaintenanceKind(row.kind)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                      {row.notes?.trim() ? row.notes : '—'}
                    </TableCell>
                    <TableCell>{row.next_due_at ? formatHistoryDate(row.next_due_at) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(row)} title="Editar">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteId(row.id)}
                          title="Eliminar"
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
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaintenanceLog;
