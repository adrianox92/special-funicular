import React, { useState, useEffect, useRef } from 'react';
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
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, vehicles: Array<{ id: string, manufacturer?: string, model?: string }>, defaultVehicleId?: string, onImported?: () => void }} props
 */
export default function ImportTimingsModal({ open, onOpenChange, vehicles, defaultVehicleId, onImported }) {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || '');
  const [format, setFormat] = useState('csv');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setVehicleId(defaultVehicleId || (vehicles[0]?.id ?? ''));
      setError(null);
      setResult(null);
    }
  }, [open, defaultVehicleId, vehicles]);

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

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await api.post('/timings/import', {
        vehicle_id: vehicleId || undefined,
        format,
        content,
      });
      setResult(data);
      if (data.imported > 0 && onImported) onImported();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error al importar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar sesiones de cronometraje</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
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
          </div>

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
          <Button onClick={handleImport} disabled={loading || !content.trim()}>
            {loading ? <Spinner className="size-4 mr-2" /> : null}
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
