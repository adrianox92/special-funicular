import React, { useState, useEffect } from 'react';
import { Wand2, Copy, X, Search, Trophy, Settings } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Alert, AlertDescription } from './ui/alert';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Spinner } from './ui/spinner';

const TemplatesDrawer = ({ show, onHide, competitionId, onTemplateApplied, disabled = false }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
    if (show) loadTemplates();
  }, [show]);

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

  const applyTemplate = async (templateId) => {
    try {
      setApplying(true);
      await axios.post(`/competition-rules/apply-template/${templateId}`, { competition_id: competitionId });
      onTemplateApplied?.();
      onHide();
    } catch (err) {
      console.error('Error al aplicar plantilla:', err);
      alert(err.response?.data?.error || 'Error al aplicar la plantilla');
    } finally {
      setApplying(false);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getRuleTypeDescription(t.rule_type).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Sheet open={show} onOpenChange={(open) => !open && onHide()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Wand2 className="size-5" />
            Aplicar Plantilla de Reglas
          </SheetTitle>
          <SheetDescription>
            Selecciona una plantilla predefinida para tu competición
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
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <Wand2 className="size-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">
                {searchTerm ? 'No se encontraron plantillas que coincidan' : 'No hay plantillas disponibles'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
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
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => applyTemplate(template.id)}
                        disabled={disabled || applying}
                        className="shrink-0 flex items-center gap-1"
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
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {template.rule_type === 'best_time_per_round' ? (
                        <Badge variant="secondary">
                          {template.points_structure?.points} pts por mejor vuelta
                        </Badge>
                      ) : (
                        Object.entries(template.points_structure || {})
                          .sort(([a], [b]) => parseInt(a) - parseInt(b))
                          .map(([pos, pts]) => (
                            <Badge key={pos} variant="secondary">{pos}º: {pts} pts</Badge>
                          ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="rounded-lg border p-4 bg-muted/50">
            <h6 className="font-semibold flex items-center gap-2 mb-2">
              <Trophy className="size-4" />
              ¿Qué son las plantillas?
            </h6>
            <p className="text-sm text-muted-foreground">
              Las plantillas son sistemas de puntuación predefinidos que puedes aplicar a tu competición.
              Una vez aplicada, la plantilla se convierte en una regla específica y puedes modificarla.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TemplatesDrawer;
