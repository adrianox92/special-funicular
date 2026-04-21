import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Pencil, Trash2, AlertTriangle, Settings, Wand2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
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
import RuleFormModal from './RuleFormModal';
import TemplatesDrawer from './TemplatesDrawer';

const CompetitionRulesPanel = ({ competitionId, onRuleChange, readOnly = false }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showTemplatesDrawer, setShowTemplatesDrawer] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [, setCompetition] = useState(null);
  const [timesRegistered, setTimesRegistered] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, ruleId: null });

  useEffect(() => {
    if (competitionId) {
      axios.get(`/competitions/${competitionId}`).then(res => setCompetition(res.data)).catch(() => {});
      axios.get(`/competitions/${competitionId}/progress`).then(res => setTimesRegistered(res.data.times_registered || 0)).catch(() => setTimesRegistered(0));
    }
  }, [competitionId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competition-rules/competition/${competitionId}`);
      setRules(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar reglas:', err);
      setError('Error al cargar las reglas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId]);

  const openRuleModal = (rule = null) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const handleDelete = (ruleId) => {
    setDeleteConfirm({ open: true, ruleId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.ruleId) return;
    try {
      await axios.delete(`/competition-rules/${deleteConfirm.ruleId}`);
      setDeleteConfirm({ open: false, ruleId: null });
      loadRules();
      onRuleChange?.();
    } catch (err) {
      console.error('Error al eliminar regla:', err);
      toast.error('Error al eliminar la regla');
    }
  };

  const getRuleTypeDescription = (type) => {
    switch (type) {
      case 'per_round': return 'Por ronda';
      case 'final': return 'Final';
      default: return type;
    }
  };

  const getRuleTypeVariant = (type) => {
    switch (type) {
      case 'per_round': return 'default';
      case 'final': return 'secondary';
      case 'best_time_per_round': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <h6 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Reglas de Puntuación
          </h6>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Spinner className="size-6 mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Cargando reglas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h6 className="font-semibold flex items-center gap-2">
            <Trophy className="size-4" />
            Reglas de Puntuación ({rules.length})
          </h6>
          {!readOnly && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplatesDrawer(true)}
                disabled={timesRegistered > 0}
                className="flex items-center gap-1"
              >
                <Wand2 className="size-4" />
                Aplicar Plantilla
              </Button>
              <Button
                size="sm"
                onClick={() => openRuleModal()}
                disabled={timesRegistered > 0}
                className="flex items-center gap-1"
              >
                <Plus className="size-4" />
                Nueva Regla
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!readOnly && timesRegistered > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                No se pueden modificar las reglas porque ya hay tiempos registrados en la competición.
              </AlertDescription>
            </Alert>
          )}

          {rules.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="size-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">No hay reglas de puntuación definidas</p>
              {!readOnly && (
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setShowTemplatesDrawer(true)} className="flex items-center gap-1">
                    <Wand2 className="size-4" />
                    Aplicar Plantilla
                  </Button>
                  <Button size="sm" onClick={() => openRuleModal()} className="flex items-center gap-1">
                    <Plus className="size-4" />
                    Crear Primera Regla
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant={getRuleTypeVariant(rule.rule_type)}>
                          {getRuleTypeDescription(rule.rule_type)}
                        </Badge>
                        {rule.use_bonus_best_lap && (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Settings className="size-3" />
                            Bonus
                          </Badge>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRuleModal(rule)}
                          disabled={timesRegistered > 0}
                          title="Editar regla"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(rule.id)}
                          disabled={timesRegistered > 0}
                          title="Eliminar regla"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rule.rule_type === 'best_time_per_round' ? (
                      <Badge variant="secondary">
                        {rule.points_structure?.points} pts por mejor vuelta
                      </Badge>
                    ) : (
                      Object.entries(rule.points_structure || {})
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([pos, pts]) => (
                          <Badge key={pos} variant="secondary">{pos}º: {pts} pts</Badge>
                        ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, ruleId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar esta regla? Esta acción no se puede deshacer.
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
      <RuleFormModal
        show={showRuleModal}
        onHide={() => setShowRuleModal(false)}
        rule={editingRule}
        competitionId={competitionId}
        onSave={() => {
          loadRules();
          onRuleChange?.();
        }}
        disabled={timesRegistered > 0}
      />
      )}

      {!readOnly && (
      <TemplatesDrawer
        show={showTemplatesDrawer}
        onHide={() => setShowTemplatesDrawer(false)}
        competitionId={competitionId}
        onTemplateApplied={() => {
          loadRules();
          onRuleChange?.();
        }}
        disabled={timesRegistered > 0}
      />
      )}
    </>
  );
};

export default CompetitionRulesPanel;
