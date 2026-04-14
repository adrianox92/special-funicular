import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import api from '../lib/axios';
import { Download, Upload } from 'lucide-react';

const CSV_TEMPLATE = `timing_date,circuit,lane,laps,best_lap_time,total_time,average_time,best_lap_timestamp,total_time_timestamp,average_time_timestamp,lap_1,lap_2,lap_3
2025-03-01,Mi circuito,1,3,00:12.500,00:38.000,00:12.667,12.5,38,12.667,12.6,12.5,12.7`;

const JSON_TEMPLATE = `[
  {
    "timing_date": "2025-03-01",
    "circuit": "Mi circuito",
    "lane": "1",
    "laps": 3,
    "best_lap_time": "00:12.500",
    "total_time": "00:38.000",
    "average_time": "00:12.667",
    "best_lap_timestamp": 12.5,
    "total_time_timestamp": 38,
    "average_time_timestamp": 12.667,
    "lap_times": [
      { "lap_number": 1, "time_seconds": 12.6 },
      { "lap_number": 2, "time_seconds": 12.5 },
      { "lap_number": 3, "time_seconds": 12.7 }
    ]
  }
]`;

/**
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, vehicles: Array<{ id: string, manufacturer?: string, model?: string }>, circuits?: Array<{ id: string, name?: string, num_lanes?: number }>, defaultVehicleId?: string, defaultCircuitId?: string, fixedVehicleId?: string, onImported?: () => void }} props
 */
export default function ImportTimingsModal({
  open,
  onOpenChange,
  vehicles,
  circuits = [],
  defaultVehicleId,
  defaultCircuitId,
  fixedVehicleId,
  onImported,
}) {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || '');
  const [importCircuitId, setImportCircuitId] = useState('');
  const [importLane, setImportLane] = useState('');
  const [format, setFormat] = useState('csv');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [showSmartracePicker, setShowSmartracePicker] = useState(false);
  const [selectedRowIndices, setSelectedRowIndices] = useState([]);
  const fileInputRef = useRef(null);
  /** Contenido para el que `previewInfo` sigue siendo válida */
  const previewContentRef = useRef(null);

  const resetPreviewState = () => {
    setPreviewInfo(null);
    setShowSmartracePicker(false);
    setSelectedRowIndices([]);
    previewContentRef.current = null;
  };

  const smartraceLaneCount = useMemo(() => {
    if (!importCircuitId) return 12;
    const c = circuits.find((x) => x.id === importCircuitId);
    const n = parseInt(c?.num_lanes, 10);
    return Number.isFinite(n) && n > 0 ? n : 8;
  }, [importCircuitId, circuits]);

  const laneOptions = useMemo(
    () => Array.from({ length: smartraceLaneCount }, (_, i) => String(i + 1)),
    [smartraceLaneCount]
  );

  useEffect(() => {
    if (open) {
      setVehicleId(fixedVehicleId || defaultVehicleId || (vehicles[0]?.id ?? ''));
      setImportCircuitId(defaultCircuitId || '');
      setImportLane('');
      setError(null);
      setResult(null);
      resetPreviewState();
    }
  }, [open, defaultVehicleId, defaultCircuitId, fixedVehicleId, vehicles]);

  useEffect(() => {
    resetPreviewState();
  }, [content, format]);

  useEffect(() => {
    setImportLane('');
  }, [importCircuitId]);

  const downloadTemplate = () => {
    const text = format === 'csv' ? CSV_TEMPLATE : JSON_TEMPLATE;
    const blob = new Blob([text], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = format === 'csv' ? 'plantilla_sesiones.csv' : 'plantilla_sesiones.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const toggleRowIndex = (idx) => {
    setSelectedRowIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const smartracePayload = () => ({
    ...(importCircuitId ? { circuit_id: importCircuitId } : {}),
    ...(importLane ? { lane: importLane } : {}),
  });

  /** Si al menos una sesión se importó, refresca datos y cierra el modal. Si no, muestra el resultado en el propio modal. */
  const applyImportResult = (data) => {
    if (data.imported > 0) {
      if (onImported) onImported();
      onOpenChange(false);
    } else {
      setResult(data);
    }
  };

  const smartraceMeta = previewInfo?.smartraceMeta;
  const showSmartraceCircuitLane =
    previewInfo?.format === 'smartrace' &&
    smartraceMeta &&
    (smartraceMeta.needsCircuitPick || smartraceMeta.needsLanePick);

  const smartraceNeedsCircuitLaneInput =
    previewInfo?.format === 'smartrace' &&
    smartraceMeta &&
    ((smartraceMeta.needsCircuitPick && !importCircuitId) ||
      (smartraceMeta.needsLanePick && !importLane));

  const handleImport = async () => {
    if (!content.trim()) return;
    const effectiveVehicleId = fixedVehicleId || vehicleId;
    if (!effectiveVehicleId) {
      setError('Selecciona un vehículo para asociar las sesiones importadas.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (format === 'json') {
        const { data } = await api.post('/timings/import', {
          vehicle_id: effectiveVehicleId,
          format,
          content,
        });
        applyImportResult(data);
        return;
      }

      const previewFresh = previewInfo && previewContentRef.current === content;

      // Fase 2: SmartRace multi-fila
      if (previewFresh && showSmartracePicker && previewInfo.format === 'smartrace') {
        const meta = previewInfo.smartraceMeta || {};
        if ((meta.needsCircuitPick && !importCircuitId) || (meta.needsLanePick && !importLane)) {
          setError('Selecciona circuito y carril obligatorios para este CSV.');
          return;
        }
        const valid = selectedRowIndices.filter((i) => {
          const row = previewInfo.rows.find((r) => r.index === i);
          return row && !row.error;
        });
        if (valid.length === 0) {
          setError('Selecciona al menos una fila válida para importar.');
          return;
        }
        const { data } = await api.post('/timings/import', {
          vehicle_id: effectiveVehicleId,
          format,
          content,
          selected_row_indices: valid,
          ...smartracePayload(),
        });
        resetPreviewState();
        applyImportResult(data);
        return;
      }

      if (!previewFresh) {
        const { data: prev } = await api.post('/timings/import-preview', { format, content });
        setPreviewInfo(prev);
        previewContentRef.current = content;

        if (prev.format === 'smartrace') {
          const meta = prev.smartraceMeta || {};
          if (prev.rows.length > 1) {
            setSelectedRowIndices(prev.rows.filter((r) => !r.error).map((r) => r.index));
            setShowSmartracePicker(true);
            return;
          }
          if (prev.rows.length === 1) {
            if ((meta.needsCircuitPick && !importCircuitId) || (meta.needsLanePick && !importLane)) {
              setError('Selecciona circuito y/o carril obligatorios (el CSV no los incluye).');
              return;
            }
            const { data } = await api.post('/timings/import', {
              vehicle_id: effectiveVehicleId,
              format,
              content,
              selected_row_indices: [0],
              ...smartracePayload(),
            });
            resetPreviewState();
            applyImportResult(data);
            return;
          }
        }

        const { data } = await api.post('/timings/import', {
          vehicle_id: effectiveVehicleId,
          format,
          content,
        });
        resetPreviewState();
        applyImportResult(data);
        return;
      }

      // Segundo clic: vista previa ya cargada (p. ej. usuario rellenó circuito/carril)
      if (previewFresh && previewInfo.format === 'smartrace' && previewInfo.rows.length === 1) {
        const meta = previewInfo.smartraceMeta || {};
        if ((meta.needsCircuitPick && !importCircuitId) || (meta.needsLanePick && !importLane)) {
          setError('Selecciona circuito y/o carril obligatorios (el CSV no los incluye).');
          return;
        }
        const { data } = await api.post('/timings/import', {
          vehicle_id: effectiveVehicleId,
          format,
          content,
          selected_row_indices: [0],
          ...smartracePayload(),
        });
        resetPreviewState();
        applyImportResult(data);
        return;
      }

      if (previewFresh && previewInfo.format === 'native') {
        const { data } = await api.post('/timings/import', {
          vehicle_id: effectiveVehicleId,
          format,
          content,
        });
        resetPreviewState();
        applyImportResult(data);
        return;
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al importar');
    } finally {
      setLoading(false);
    }
  };

  const importButtonLabel =
    showSmartracePicker && previewInfo?.format === 'smartrace' ? 'Importar selección' : 'Importar';

  const importDisabled =
    loading ||
    !content.trim() ||
    smartraceNeedsCircuitLaneInput ||
    (showSmartracePicker &&
      previewInfo?.format === 'smartrace' &&
      selectedRowIndices.filter((i) => {
        const row = previewInfo.rows.find((r) => r.index === i);
        return row && !row.error;
      }).length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar sesiones de cronometraje</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            {fixedVehicleId ? (
              <>
                <Label>Vehículo</Label>
                <p className="text-sm text-muted-foreground">
                  Sesiones asignadas a:{' '}
                  <strong>
                    {vehicles.find((v) => v.id === fixedVehicleId)?.manufacturer}{' '}
                    {vehicles.find((v) => v.id === fixedVehicleId)?.model}
                  </strong>
                </p>
                {previewInfo?.format === 'smartrace' && (
                  <p className="text-xs text-muted-foreground">
                    Formato SmartRace detectado: el coche de la sesión es el de esta ficha (no se usa la columna «Coche» del
                    CSV).
                  </p>
                )}
              </>
            ) : (
              <>
                <Label>Vehículo (obligatorio si el CSV/JSON no incluye vehicle_id por fila)</Label>
                <Select value={vehicleId || '__none__'} onValueChange={(v) => setVehicleId(v === '__none__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin seleccionar —</SelectItem>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.manufacturer} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {previewInfo?.format === 'smartrace' && (
                  <p className="text-xs text-muted-foreground">
                    Formato SmartRace detectado: el coche de la sesión es el que elijas aquí (no se usa la columna «Coche» del
                    CSV).
                  </p>
                )}
              </>
            )}
          </div>

          {showSmartraceCircuitLane && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Circuito y carril</p>
              <p className="text-xs text-muted-foreground">
                El CSV no incluye circuito o carril (o vienen vacíos). Elige un circuito y un carril de tu colección para
                guardar la sesión correctamente.
              </p>
              {smartraceMeta?.needsCircuitPick && circuits.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="import-circuit">Circuito</Label>
                  <Select value={importCircuitId || '__none__'} onValueChange={(v) => setImportCircuitId(v === '__none__' ? '' : v)}>
                    <SelectTrigger id="import-circuit">
                      <SelectValue placeholder="Selecciona circuito" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Selecciona —</SelectItem>
                      {circuits.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {smartraceMeta?.needsCircuitPick && circuits.length === 0 && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">
                    El CSV no incluye circuito. Añade al menos un circuito en la aplicación para poder indicar dónde se
                    rodó la sesión.
                  </AlertDescription>
                </Alert>
              )}
              {smartraceMeta?.needsLanePick && (
                <div className="space-y-2">
                  <Label htmlFor="import-lane">Carril</Label>
                  <Select
                    value={importLane || '__none__'}
                    onValueChange={(v) => setImportLane(v === '__none__' ? '' : v)}
                    disabled={!!(smartraceMeta?.needsCircuitPick && !importCircuitId)}
                  >
                    <SelectTrigger id="import-lane">
                      <SelectValue
                        placeholder={
                          smartraceMeta?.needsCircuitPick && !importCircuitId ? 'Primero elige circuito' : 'Carril'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Selecciona —</SelectItem>
                      {laneOptions.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {importCircuitId ? (
                    <p className="text-xs text-muted-foreground">
                      Carril 1–{smartraceLaneCount} según el circuito seleccionado.
                    </p>
                  ) : smartraceMeta?.needsCircuitPick ? (
                    <p className="text-xs text-muted-foreground">Tras elegir circuito, se ajustan los carriles disponibles.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Elige el número de carril (1–{smartraceLaneCount}).</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Formato</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="size-4 mr-2" />
              Descargar plantilla
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={format === 'csv' ? '.csv,text/csv' : '.json,application/json'}
              className="hidden"
              onChange={onPickFile}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4 mr-2" />
              Elegir fichero
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Contenido</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={format === 'csv' ? 'Pega aquí el CSV o carga un fichero…' : 'Pega aquí el JSON o carga un fichero…'}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {showSmartracePicker && previewInfo?.format === 'smartrace' && previewInfo.rows.length > 1 && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-sm font-medium">Varios pilotos en el archivo</p>
              <p className="text-xs text-muted-foreground">
                Marca las filas que quieres registrar como sesiones (cada una con el vehículo seleccionado arriba).
              </p>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {previewInfo.rows.map((row) => {
                  const id = `import-row-${row.index}`;
                  return (
                    <li key={row.index} className="flex items-start gap-2">
                      <input
                        id={id}
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-input"
                        checked={selectedRowIndices.includes(row.index)}
                        disabled={!!row.error}
                        onChange={() => toggleRowIndex(row.index)}
                      />
                      <label htmlFor={id} className={`cursor-pointer ${row.error ? 'text-muted-foreground' : ''}`}>
                        <span className="font-medium">{row.pilotLabel}</span>
                        {row.lapsExpected != null && (
                          <span className="text-muted-foreground"> · {row.lapsExpected} vueltas</span>
                        )}
                        {row.error && <span className="block text-destructive">Error: {row.error}</span>}
                        {row.warning && <span className="block text-amber-600 dark:text-amber-500">Aviso: {row.warning}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <AlertDescription>
                <p className="font-medium">
                  Importadas: {result.imported} de {result.total}
                </p>
                {result.errors?.length > 0 && (
                  <ul className="mt-2 text-sm list-disc pl-4 max-h-40 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        Fila {e.row}: {e.error}
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleImport} disabled={importDisabled}>
            {loading ? <Spinner className="size-4 mr-2" /> : null}
            {importButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
