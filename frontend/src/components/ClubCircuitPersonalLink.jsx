import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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

/**
 * Vincula un circuito personal del usuario al circuito canónico del club (migra tiempos).
 */
export default function ClubCircuitPersonalLink({ clubId, clubCircuitId, onLinked }) {
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [clubCircuit, setClubCircuit] = useState(null);
  const [personalCircuits, setPersonalCircuits] = useState([]);
  const [selectedPersonalId, setSelectedPersonalId] = useState('');
  const [deletePersonal, setDeletePersonal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clubId || !clubCircuitId) return;
    try {
      setLoading(true);
      const { data } = await axios.get(
        `/clubs/${clubId}/circuits/${clubCircuitId}/linkable-personal`,
      );
      setClubCircuit(data.club_circuit || null);
      const list = Array.isArray(data.personal_circuits) ? data.personal_circuits : [];
      setPersonalCircuits(list);
      const preferred =
        list.find((c) => c.name_match && c.timing_count > 0)?.id
        || list.find((c) => c.name_match)?.id
        || list.find((c) => c.timing_count > 0)?.id
        || list[0]?.id
        || '';
      setSelectedPersonalId(preferred);
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.error || 'No se pudieron cargar tus circuitos personales');
      setPersonalCircuits([]);
      setSelectedPersonalId('');
    } finally {
      setLoading(false);
    }
  }, [clubId, clubCircuitId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPersonal = useMemo(
    () => personalCircuits.find((c) => c.id === selectedPersonalId),
    [personalCircuits, selectedPersonalId],
  );

  const runLink = async () => {
    if (!selectedPersonalId) return;
    try {
      setLinking(true);
      const { data } = await axios.post(
        `/clubs/${clubId}/circuits/${clubCircuitId}/link-personal/${selectedPersonalId}`,
        { delete_personal: deletePersonal },
      );
      toast.success(
        data.migrated_timings > 0
          ? `Vinculado: ${data.migrated_timings} sesión(es) migrada(s) al circuito del club`
          : 'Vinculación completada (no había tiempos que migrar)',
      );
      setConfirmOpen(false);
      load();
      onLinked?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo vincular');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (personalCircuits.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="size-4" />
            Vincular circuito personal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No tienes circuitos personales que vincular. Crea uno en{' '}
            <a href="/circuits" className="text-primary underline-offset-4 hover:underline">
              Circuitos
            </a>{' '}
            si entrenabas con un nombre distinto antes de que el club definiera «
            {clubCircuit?.name || 'este circuito'}».
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="size-4" />
            Vincular circuito personal
          </CardTitle>
          <CardDescription>
            Migra tus tiempos de entrenamiento al circuito del club «{clubCircuit?.name}» para que
            cuenten en el leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personal-circuit-select">Tu circuito personal</Label>
            <Select value={selectedPersonalId} onValueChange={setSelectedPersonalId}>
              <SelectTrigger id="personal-circuit-select">
                <SelectValue placeholder="Selecciona un circuito" />
              </SelectTrigger>
              <SelectContent>
                {personalCircuits.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.name_match ? ' · mismo nombre' : ''}
                    {c.timing_count > 0 ? ` · ${c.timing_count} sesión(es)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Eliminar circuito personal tras vincular</p>
              <p className="text-xs text-muted-foreground">
                Solo si ya no queda ninguna referencia (competiciones, etc.).
              </p>
            </div>
            <Switch checked={deletePersonal} onCheckedChange={setDeletePersonal} />
          </div>

          <Button
            type="button"
            className="gap-2"
            disabled={!selectedPersonalId || linking}
            onClick={() => setConfirmOpen(true)}
          >
            <Link2 className="size-4" />
            Vincular tiempos
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Vincular circuito personal?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Se reasignarán{' '}
                  <strong>{selectedPersonal?.timing_count ?? 0}</strong> sesión(es) de «
                  {selectedPersonal?.name}» al circuito del club «{clubCircuit?.name}».
                </p>
                <p>Esta acción no se puede deshacer automáticamente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={linking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={linking} onClick={runLink}>
              {linking ? 'Vinculando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
