import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Trash2, Save, X } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Switch } from './ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Spinner } from './ui/spinner';

const RuleFormModal = ({ show, onHide, rule, competitionId, onSave, disabled = false }) => {
  const [formData, setFormData] = useState({
    rule_type: 'per_round',
    description: '',
    points_structure: { "1": 10, "2": 8, "3": 6, "4": 4, "5": 2 },
    use_bonus_best_lap: false
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      if (rule) {
        setFormData({
          rule_type: rule.rule_type,
          description: rule.description || '',
          points_structure: rule.points_structure,
          use_bonus_best_lap: rule.use_bonus_best_lap || false
        });
      } else {
        setFormData({
          rule_type: 'per_round',
          description: '',
          points_structure: { "1": 10, "2": 8, "3": 6, "4": 4, "5": 2 },
          use_bonus_best_lap: false
        });
      }
      setError(null);
    }
  }, [show, rule]);

  const updatePointsStructure = (position, points) => {
    const newStructure = { ...formData.points_structure };
    if (points === '' || points === null) {
      delete newStructure[position];
    } else {
      newStructure[position] = parseInt(points) || 0;
    }
    setFormData({ ...formData, points_structure: newStructure });
  };

  const addPosition = () => {
    const positions = Object.keys(formData.points_structure).map(Number);
    const nextPosition = positions.length > 0 ? Math.max(...positions) + 1 : 1;
    setFormData({
      ...formData,
      points_structure: { ...formData.points_structure, [nextPosition]: 0 }
    });
  };

  const removePosition = (position) => {
    const newStructure = { ...formData.points_structure };
    delete newStructure[position];
    setFormData({ ...formData, points_structure: newStructure });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!formData.rule_type) {
        setError('Debes seleccionar un tipo de regla');
        setSaving(false);
        return;
      }
      if (!formData.description?.trim()) {
        setError('Debes especificar una descripción');
        setSaving(false);
        return;
      }
      if ((formData.rule_type === 'per_round' || formData.rule_type === 'final') &&
          (!formData.points_structure || Object.keys(formData.points_structure).length === 0)) {
        setError('Debes especificar al menos una posición con puntos');
        setSaving(false);
        return;
      }
      const ruleData = {
        ...formData,
        competition_id: rule ? undefined : competitionId,
        is_template: false
      };
      if (rule) {
        await axios.put(`/competition-rules/${rule.id}`, ruleData);
      } else {
        await axios.post(`/competition-rules`, ruleData);
      }
      onHide();
      onSave?.();
    } catch (err) {
      console.error('Error al guardar regla:', err);
      setError(err.response?.data?.error || 'Error al guardar la regla');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onHide()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            {rule ? 'Editar Regla' : 'Nueva Regla de Puntuación'}
          </DialogTitle>
          <DialogDescription>Configura los puntos para cada posición</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de regla *</Label>
                <Select
                  value={formData.rule_type}
                  onValueChange={(v) => setFormData({ ...formData, rule_type: v })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_round">Por ronda</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {formData.rule_type === 'per_round'
                    ? 'Los puntos se asignan en cada ronda individual'
                    : 'Los puntos se asignan al final de la competición'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-desc">Descripción (opcional)</Label>
                <Input
                  id="rule-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Puntuación estándar F1"
                  disabled={disabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estructura de puntos *</Label>
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Define los puntos para cada posición</span>
                  <Button type="button" variant="outline" size="sm" onClick={addPosition} disabled={disabled} className="flex items-center gap-1">
                    <Plus className="size-4" />
                    Añadir posición
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(formData.points_structure)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([position, points]) => (
                      <div key={position} className="flex gap-2 items-center">
                        <span className="text-sm font-medium w-8">{position}º</span>
                        <Input
                          type="number"
                          min="0"
                          value={points}
                          onChange={(e) => updatePointsStructure(position, e.target.value)}
                          placeholder="Puntos"
                          disabled={disabled}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:text-destructive shrink-0"
                          onClick={() => removePosition(position)}
                          disabled={disabled || Object.keys(formData.points_structure).length === 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {formData.rule_type === 'per_round' && (
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="bonus-lap">Bonus por mejor vuelta</Label>
                  <p className="text-sm text-muted-foreground">
                    El participante con la mejor vuelta de cada ronda recibirá 1 punto adicional.
                  </p>
                </div>
                <Switch
                  id="bonus-lap"
                  checked={formData.use_bonus_best_lap}
                  onCheckedChange={(checked) => setFormData({ ...formData, use_bonus_best_lap: checked })}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onHide} disabled={saving}>
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || disabled}>
              {saving ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  {rule ? 'Actualizar' : 'Crear'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RuleFormModal;
