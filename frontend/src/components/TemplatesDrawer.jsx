import React, { useState, useEffect } from 'react';
import { Wand2, Copy, X, Search, Trophy, Settings, Plus, Pencil, Trash2 } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
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
import { Spinner } from './ui/spinner';
import { toast } from 'sonner';
import RuleFormModal from './RuleFormModal';

const TemplatesDrawer = ({ show, onHide, competitionId, leagueId, categories = [], onTemplateApplied, disabled = false }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, templateId: null });

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/competition-rules/templates');
      setTemplates(response.data);
      setError(null);
    } catch (err) {
      console.error('Error al cargar plantillas:', err);
      setError('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      loadTemplates();
      setCategoryId('');
      setSearchTerm('');
    }
  }, [show]);

  const getRuleTypeDescription = (type) => {
    switch (type) {
      case 'per_round': return 'Por ronda';
      case 'final': return 'Final';
      case 'power_stage': return 'Power Stage';
      default: return type;
    }
  };

  const getRuleTypeVariant = (type) => {
    switch (type) {
      case 'per_round': return 'default';
      case 'final': return 'secondary';
      case 'power_stage': return 'destructive';
      case 'best_time_per_round': return 'outline';
      default: return 'secondary';
    }
  };

  const applyTemplate = async (templateId) => {
    try {
      setApplying(true);
      await axios.post(`/competition-rules/apply-template/${templateId}`, {
        competition_id: leagueId ? undefined : competitionId,
        league_id: leagueId || undefined,
        category_id: leagueId ? null : (categoryId || null),
      });
      const categoryLabel = categoryId
        ? categories.find((c) => c.id === categoryId)?.name
        : null;
      toast.success(
        categoryLabel
          ? `Plantilla aplicada para la categoría ${categoryLabel}`
          : 'Plantilla aplicada correctamente'
      );
      onTemplateApplied?.();
      onHide();
    } catch (err) {
      console.error('Error al aplicar plantilla:', err);
      toast.error(err.response?.data?.error || 'Error al aplicar la plantilla');
    } finally {
      setApplying(false);
    }
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteConfirm.templateId) return;
    try {
      await axios.delete(`/competition-rules/${deleteConfirm.templateId}`);
      setDeleteConfirm({ open: false, templateId: null });
      loadTemplates();
      toast.success('Plantilla eliminada');
    } catch (err) {
      console.error('Error al eliminar plantilla:', err);
      toast.error(err.response?.data?.error || 'Error al eliminar la plantilla');
    }
  };

  const filterTemplates = (list) =>
    list.filter((t) =>
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRuleTypeDescription(t.rule_type).toLowerCase().includes(searchTerm.toLowerCase())
    );

  const systemTemplates = filterTemplates(templates.filter((t) => t.created_by == null));
  const userTemplates = filterTemplates(templates.filter((t) => t.created_by != null));

  const renderPointsBadges = (template) => {
    if (template.rule_type === 'best_time_per_round') {
      return (
        <Badge variant="secondary">
          {template.points_structure?.points} pts por mejor vuelta
        </Badge>
      );
    }
    return Object.entries(template.points_structure || {})
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([pos, pts]) => (
        <Badge key={pos} variant="secondary">{pos}º: {pts} pts</Badge>
      ));
  };

  const renderTemplateCard = (template, { isOwn = false } = {}) => (
    <Card key={template.id}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start gap-4 mb-2">
          <div className="flex-1 min-w-0">
            <h6 className="font-semibold mb-1">{template.name}</h6>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant={getRuleTypeVariant(template.rule_type)}>
                {getRuleTypeDescription(template.rule_type)}
              </Badge>
              {template.use_bonus_best_lap && (
                <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                  <Settings className="size-3" />
                  Bonus
                </Badge>
              )}
              {template.rule_type === 'power_stage' && Array.isArray(template.target_rounds) && template.target_rounds.length > 0 && (
                <Badge variant="outline">
                  Rondas: {template.target_rounds.join(', ')}
                </Badge>
              )}
              <Badge variant="outline">
                {isOwn ? 'Personal' : 'Sistema'}
              </Badge>
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground">{template.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => applyTemplate(template.id)}
              disabled={disabled || applying}
              className="flex items-center gap-1"
            >
              {applying ? (
                <>
                  <Spinner className="size-4" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Aplicar
                </>
              )}
            </Button>
            {isOwn && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowTemplateModal(true);
                  }}
                  title="Editar plantilla"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirm({ open: true, templateId: template.id })}
                  title="Eliminar plantilla"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {renderPointsBadges(template)}
        </div>
      </CardContent>
    </Card>
  );

  const hasFilteredResults = systemTemplates.length > 0 || userTemplates.length > 0;

  return (
    <>
      <Sheet open={show} onOpenChange={(open) => !open && onHide()}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Wand2 className="size-5" />
              Aplicar Plantilla de Reglas
            </SheetTitle>
            <SheetDescription>
              Selecciona una plantilla del sistema o una de tus plantillas personalizadas
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {disabled && (
              <Alert variant="destructive">
                <X className="size-4" />
                <AlertDescription>
                  No se pueden aplicar plantillas porque ya hay tiempos registrados en la competición.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateModal(true);
                }}
              >
                <Plus className="size-4" />
                Nueva plantilla
              </Button>
            </div>

            {!disabled && categories.length > 0 && (
              <div className="space-y-2 rounded-lg border p-4">
                <Label>{'Categoría'}</Label>
                <Select
                  value={categoryId || 'all'}
                  onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías (global)</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  La plantilla se creará como regla{' '}
                  {categoryId
                    ? `solo para la categoría ${categories.find((c) => c.id === categoryId)?.name || ''}`
                    : 'válida para todos los participantes'}
                  .
                </p>
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar plantillas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Spinner className="size-8 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Cargando plantillas...</p>
              </div>
            ) : !hasFilteredResults ? (
              <div className="text-center py-8">
                <Wand2 className="size-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {searchTerm ? 'No se encontraron plantillas que coincidan' : 'No hay plantillas disponibles'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {userTemplates.length > 0 && (
                  <div className="space-y-3">
                    <h6 className="font-semibold text-sm">Mis plantillas</h6>
                    {userTemplates.map((template) => renderTemplateCard(template, { isOwn: true }))}
                  </div>
                )}
                {systemTemplates.length > 0 && (
                  <div className="space-y-3">
                    <h6 className="font-semibold text-sm">Plantillas del sistema</h6>
                    {systemTemplates.map((template) => renderTemplateCard(template, { isOwn: false }))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border p-4 bg-muted/50">
              <h6 className="font-semibold flex items-center gap-2 mb-2">
                <Trophy className="size-4" />
                ¿Qué son las plantillas?
              </h6>
              <p className="text-sm text-muted-foreground">
                Las plantillas son reglas de puntuación reutilizables. Puedes usar las predefinidas,
                crear las tuyas propias o guardar una regla existente como plantilla personal.
                Una vez aplicada, puedes modificar la regla en la competición sin afectar la plantilla.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <RuleFormModal
        show={showTemplateModal}
        onHide={() => {
          setShowTemplateModal(false);
          setEditingTemplate(null);
        }}
        rule={editingTemplate}
        templateMode
        onSave={loadTemplates}
      />

      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, templateId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta plantilla personalizada se eliminará permanentemente. Las competiciones donde ya la hayas aplicado no se verán afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TemplatesDrawer;
