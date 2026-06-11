import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, RefreshCw, ExternalLink, ChevronUp, ChevronDown, Import } from 'lucide-react';
import axios from '../../lib/axios';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
import CompetitionStatusBadge from '../CompetitionStatusBadge';
import { toast } from 'sonner';
import { Spinner } from '../ui/spinner';

const LeagueCompetitionsTab = ({ league, canManage, onRefresh }) => {
  const [available, setAvailable] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [adding, setAdding] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [importingAll, setImportingAll] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState({ open: false, competitionId: null });

  const loadAvailable = useCallback(async () => {
    if (!canManage) return;
    try {
      setLoadingAvailable(true);
      const res = await axios.get('/leagues/my-competitions/available');
      setAvailable(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAvailable(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadAvailable();
  }, [loadAvailable, league?.id]);

  const handleAdd = async () => {
    if (!selectedCompetitionId) return;
    try {
      setAdding(true);
      await axios.post(`/leagues/${league.id}/competitions`, {
        competition_id: selectedCompetitionId,
      });
      toast.success('Competición añadida a la liga');
      setSelectedCompetitionId('');
      onRefresh?.();
      loadAvailable();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al añadir competición');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!removeConfirm.competitionId) return;
    try {
      await axios.delete(`/leagues/${league.id}/competitions/${removeConfirm.competitionId}`);
      toast.success('Competición eliminada de la liga');
      setRemoveConfirm({ open: false, competitionId: null });
      onRefresh?.();
      loadAvailable();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar competición');
    }
  };

  const handleSync = async (competitionId, autoApprove = false) => {
    try {
      setSyncingId(competitionId);
      const res = await axios.post(
        `/leagues/${league.id}/competitions/${competitionId}/sync-participants`,
        { auto_approve: autoApprove },
      );
      toast.success(`Sincronizados ${res.data.created || 0} participantes`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al sincronizar participantes');
    } finally {
      setSyncingId(null);
    }
  };

  const formatImportResult = (data) => {
    const created = data.created || 0;
    const updated = data.updated || 0;
    if (created === 0 && updated === 0) {
      return data.message || 'No hay participantes nuevos para importar';
    }
    const parts = [];
    if (created > 0) parts.push(`${created} nuevos`);
    if (updated > 0) parts.push(`${updated} actualizados`);
    return `Importados a la liga: ${parts.join(', ')}`;
  };

  const handleImport = async (competitionId) => {
    try {
      setImportingId(competitionId);
      const res = await axios.post(
        `/leagues/${league.id}/competitions/${competitionId}/import-participants`,
      );
      const msg = formatImportResult(res.data);
      if (res.data.created === 0 && res.data.updated === 0) {
        toast.info(msg);
      } else {
        toast.success(msg);
        onRefresh?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al importar participantes');
    } finally {
      setImportingId(null);
    }
  };

  const handleImportAll = async () => {
    try {
      setImportingAll(true);
      const res = await axios.post(`/leagues/${league.id}/import-from-competitions`);
      const msg = formatImportResult(res.data);
      if (res.data.created === 0 && res.data.updated === 0) {
        toast.info(msg);
      } else {
        toast.success(msg);
        onRefresh?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al importar participantes');
    } finally {
      setImportingAll(false);
    }
  };

  const handleSyncAll = async (autoApprove = false) => {
    try {
      setSyncingAll(true);
      const res = await axios.post(`/leagues/${league.id}/sync-all-competitions`, {
        auto_approve: autoApprove,
      });
      toast.success(`Sincronizados ${res.data.total_created || 0} participantes en total`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al sincronizar');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleReorder = async (competitionId, direction) => {
    const competitions = [...(league?.competitions || [])].sort(
      (a, b) => a.order_index - b.order_index,
    );
    const idx = competitions.findIndex((c) => c.id === competitionId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= competitions.length) return;

    const order = competitions.map((c, i) => ({
      competition_id: c.id,
      order_index: i,
    }));
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    order.forEach((item, i) => {
      item.order_index = i;
    });

    try {
      setReordering(true);
      await axios.patch(`/leagues/${league.id}/competitions/reorder`, { order });
      toast.success('Orden actualizado');
      onRefresh?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reordenar');
    } finally {
      setReordering(false);
    }
  };

  const competitions = [...(league?.competitions || [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <div className="space-y-4">
      {canManage && (
        <>
          <Card>
            <CardContent className="pt-6 flex flex-col sm:flex-row gap-3">
              <Select value={selectedCompetitionId} onValueChange={setSelectedCompetitionId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={loadingAvailable ? 'Cargando...' : 'Seleccionar competición'} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} disabled={!selectedCompetitionId || adding}>
                {adding ? <Spinner className="size-4" /> : <Plus className="size-4 mr-2" />}
                Añadir prueba
              </Button>
            </CardContent>
          </Card>

          {competitions.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportAll}
                disabled={importingAll}
              >
                <Import className={`size-4 mr-2 ${importingAll ? 'animate-pulse' : ''}`} />
                Importar pilotos a la liga
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncAll(false)}
                disabled={syncingAll}
              >
                <RefreshCw className={`size-4 mr-2 ${syncingAll ? 'animate-spin' : ''}`} />
                Enviar inscritos de liga a pruebas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncAll(true)}
                disabled={syncingAll}
              >
                Enviar inscritos (aprobar directo)
              </Button>
            </div>
          )}
        </>
      )}

      {competitions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay competiciones en esta liga todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {competitions.map((comp, index) => (
            <Card key={comp.id}>
              <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="font-medium">{comp.name}</span>
                    <CompetitionStatusBadge status={comp.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {comp.rounds} ronda{comp.rounds !== 1 ? 's' : ''}
                    {comp.circuit_name ? ` · ${comp.circuit_name}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={index === 0 || reordering}
                        onClick={() => handleReorder(comp.id, 'up')}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={index === competitions.length - 1 || reordering}
                        onClick={() => handleReorder(comp.id, 'down')}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/competitions/${comp.id}/participants`}>
                      <ExternalLink className="size-4 mr-2" />
                      Gestionar
                    </Link>
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImport(comp.id)}
                        disabled={importingId === comp.id}
                      >
                        <Import className={`size-4 mr-2 ${importingId === comp.id ? 'animate-pulse' : ''}`} />
                        Importar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(comp.id, false)}
                        disabled={syncingId === comp.id}
                      >
                        <RefreshCw className={`size-4 mr-2 ${syncingId === comp.id ? 'animate-spin' : ''}`} />
                        Enviar a prueba
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRemoveConfirm({ open: true, competitionId: comp.id })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={removeConfirm.open} onOpenChange={(open) => !open && setRemoveConfirm({ open: false, competitionId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar competición de la liga?</AlertDialogTitle>
            <AlertDialogDescription>
              La competición seguirá existiendo, solo se desvinculará de esta liga.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LeagueCompetitionsTab;
