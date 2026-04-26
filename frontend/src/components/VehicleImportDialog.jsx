import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Spinner } from './ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import api from '../lib/axios';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

const IGNORE_VALUE = '__ignore__';

const DUPLICATE_MODES = [
  { value: 'skip', label: 'Omitir filas duplicadas (misma ref+fabricante o fabricante+modelo)' },
  { value: 'import', label: 'Importar duplicados igualmente (nuevas filas)' },
  { value: 'update', label: 'Actualizar vehículo existente si hay coincidencia' },
];

/**
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, onImported?: () => void }} props
 */
export default function VehicleImportDialog({ open, onOpenChange, onImported }) {
  const [file, setFile] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [sampleDataRows, setSampleDataRows] = useState([]);
  const [livePreview, setLivePreview] = useState([]);
  const [previewMappingLoading, setPreviewMappingLoading] = useState(false);
  const [mapping, setMapping] = useState(null);
  const [suggestAfterImport, setSuggestAfterImport] = useState([]);
  const [duplicateMode, setDuplicateMode] = useState('skip');
  /** Tras subir un fichero no pedimos /preview-mapped hasta que el usuario cambie el mapeo */
  const userEditedMappingRef = useRef(false);
  const previewDebounceRef = useRef(null);
  const previewAbortRef = useRef(null);

  const reset = useCallback(() => {
    setFile(null);
    setSheetIndex(0);
    setError(null);
    setPreviewInfo(null);
    setSampleDataRows([]);
    setLivePreview([]);
    setPreviewMappingLoading(false);
    setMapping(null);
    setSuggestAfterImport([]);
    setDuplicateMode('skip');
    userEditedMappingRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const runPreview = useCallback(
    async (f, sheet) => {
      if (!f) return;
      setLoading(true);
      setError(null);
      setPreviewInfo(null);
      setSampleDataRows([]);
      setLivePreview([]);
      setMapping(null);
      userEditedMappingRef.current = false;
      try {
        const formData = new FormData();
        formData.append('file', f);
        formData.append('sheetIndex', String(sheet ?? 0));
        const { data } = await api.post('/vehicles/import-preview', formData);
        setPreviewInfo({
          headers: data.headers,
          sheetName: data.sheetName,
          rowCount: data.rowCount,
          targetFields: data.targetFields,
        });
        setSampleDataRows(Array.isArray(data.sampleDataRows) ? data.sampleDataRows : []);
        setLivePreview(Array.isArray(data.preview) ? data.preview : []);
        setSuggestAfterImport(Array.isArray(data.suggestAfterImport) ? data.suggestAfterImport : []);
        const m = {};
        for (const tf of data.targetFields || []) {
          m[tf.key] = data.suggestedMapping?.[tf.key] ?? null;
        }
        setMapping(m);
        toast.success(`Archivo analizado: ${data.rowCount} fila(s)`);
      } catch (e) {
        const msg = e.response?.data?.error || e.message || 'Error al leer el archivo';
        setError(msg);
        toast.error(String(msg));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    runPreview(f, sheetIndex);
  };

  const handleMappingChange = (fieldKey, columnName) => {
    userEditedMappingRef.current = true;
    setMapping((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [fieldKey]: columnName === IGNORE_VALUE || columnName === '' ? null : columnName,
      };
    });
  };

  useEffect(() => {
    if (!open || !userEditedMappingRef.current) return;
    if (!sampleDataRows.length || !mapping) return;

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }
    previewDebounceRef.current = setTimeout(() => {
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
      }
      const ac = new AbortController();
      previewAbortRef.current = ac;
      (async () => {
        setPreviewMappingLoading(true);
        setError(null);
        try {
          const { data } = await api.post(
            '/vehicles/preview-mapped',
            { mapping, sampleDataRows },
            { signal: ac.signal }
          );
          if (!ac.signal.aborted) {
            setLivePreview(Array.isArray(data.preview) ? data.preview : []);
            setSuggestAfterImport(Array.isArray(data.suggestAfterImport) ? data.suggestAfterImport : []);
          }
        } catch (e) {
          if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || (e.message && e.message === 'canceled')) {
            return;
          }
          if (ac.signal.aborted) return;
          const msg = e.response?.data?.error || e.message || 'Error al actualizar la vista previa';
          setError(msg);
          toast.error(String(msg));
        } finally {
          if (!ac.signal.aborted) setPreviewMappingLoading(false);
        }
      })();
    }, 250);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
        previewDebounceRef.current = null;
      }
      if (previewAbortRef.current) {
        previewAbortRef.current.abort();
        previewAbortRef.current = null;
      }
    };
  }, [mapping, sampleDataRows, open]);

  const handleImport = async () => {
    if (!file || !mapping || !previewInfo) {
      setError('Selecciona un archivo y revisa el mapeo.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('duplicateMode', duplicateMode);
      formData.append('sheetIndex', String(sheetIndex));
      const { data } = await api.post('/vehicles/import', formData);
      const parts = [
        `Insertados: ${data.inserted}`,
        `Actualizados: ${data.updated}`,
        `Omitidos: ${data.skipped}`,
        `Fallidos: ${data.failed}`,
      ];
      toast.success(parts.join(' · '));
      if (data.errors?.length) {
        const sample = data.errors
          .slice(0, 5)
          .map((x) => `Fila ${x.sheetRow}: ${x.message}`)
          .join('\n');
        toast.message('Algunas filas tuvieron errores', { description: sample });
      }
      if (data.inserted + data.updated > 0) {
        if (suggestAfterImport.length) {
          const names = suggestAfterImport.map((x) => x.label).join(', ');
          toast.message('Revisa la ficha de los vehículos importados', {
            description: `El alta manual pide además: ${names}. Si no vino en el Excel, complétalos al editar cada coche.`,
            duration: 10_000,
          });
        }
        if (onImported) onImported();
      }
      onOpenChange(false);
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Error al importar';
      setError(msg);
      toast.error(String(msg));
    } finally {
      setImporting(false);
    }
  };

  const headers = previewInfo?.headers ?? [];
  const previewRows = livePreview;
  const targetFields = previewInfo?.targetFields ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[calc(100dvh-2rem)] flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Importar vehículos (CSV o Excel)
          </DialogTitle>
          <DialogDescription>
            Formatos: CSV o Excel (.xlsx, .xlsm, .xlsb, .xls, .xltx, .xltm). Sube un export o una plantilla
            propia; el sistema sugiere el mapeo de columnas para que lo revises antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {suggestAfterImport.length > 0 && (
            <Alert>
              <AlertDescription>
                En el mapeo solo <strong>marca</strong> y <strong>modelo</strong> son obligatorios. Al crear un
                vehículo a mano el formulario también exige:{' '}
                {suggestAfterImport.map((x) => x.label).join(', ')}. Si no lo mapeas o la columna queda vacía,{' '}
                <strong>edita cada vehículo importado</strong> y rellena lo que falte.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="space-y-2 flex-1">
              <Label htmlFor="vehicle-import-file">Fichero</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="vehicle-import-file"
                  type="file"
                  accept=".csv,.xlsx,.xlsm,.xlsb,.xls,.xltx,.xltm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel.sheet.binary.macroEnabled.12,text/csv"
                  className="text-sm w-full"
                  onChange={onFileChange}
                  disabled={loading || importing}
                />
                {loading && <Spinner className="size-5" />}
              </div>
            </div>
            <div className="space-y-2 w-full sm:w-32">
              <Label htmlFor="sheet-index">Hoja (Excel)</Label>
              <input
                id="sheet-index"
                type="number"
                min={0}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={sheetIndex}
                onChange={(e) => {
                  const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                  setSheetIndex(n);
                }}
                onBlur={() => {
                  if (file) runPreview(file, sheetIndex);
                }}
                disabled={loading || importing || !file}
              />
            </div>
          </div>

          {previewInfo && (
            <>
              {previewInfo.sheetName != null && (
                <p className="text-sm text-muted-foreground">
                  Hoja: <strong>{previewInfo.sheetName}</strong> · {previewInfo.rowCount} fila(s) de datos
                </p>
              )}

              <div className="space-y-2">
                <Label>Mapeo de columnas</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto border rounded-md p-3">
                  {targetFields.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <span className="text-xs text-muted-foreground">
                        {f.label}
                        {f.required && <span className="text-destructive"> *</span>}
                      </span>
                      <Select
                        value={mapping?.[f.key] != null ? mapping[f.key] : IGNORE_VALUE}
                        onValueChange={(v) => handleMappingChange(f.key, v)}
                        disabled={!mapping}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Ignorar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={IGNORE_VALUE}>— Ignorar —</SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Duplicados en tu colección</Label>
                <Select value={duplicateMode} onValueChange={setDuplicateMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DUPLICATE_MODES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="mb-0">Vista previa (primeras filas con datos)</Label>
                  {previewMappingLoading && <Spinner className="size-4" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  La tabla se actualiza al cambiar el mapeo de columnas.
                </p>
                <div className="border rounded-md overflow-x-auto max-h-56">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">#</TableHead>
                        <TableHead>OK</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-muted-foreground text-center">
                            No hay filas para previsualizar
                          </TableCell>
                        </TableRow>
                      ) : (
                        previewRows.map((row) => (
                          <TableRow key={row.index}>
                            <TableCell>{row.sheetRow}</TableCell>
                            <TableCell>{row.ok ? 'Sí' : 'No'}</TableCell>
                            <TableCell className="max-w-[120px] truncate" title={row.values?.model || ''}>
                              {row.values?.model || '—'}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate" title={row.values?.manufacturer || ''}>
                              {row.values?.manufacturer || '—'}
                            </TableCell>
                            <TableCell className="max-w-[100px] truncate" title={row.values?.type || ''}>
                              {row.values?.type || '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                              {row.errors?.length
                                ? row.errors.join(' ')
                                : row.warnings?.length
                                  ? row.warnings.join(' ')
                                  : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!previewInfo || !file || loading || importing || previewMappingLoading}
          >
            {importing ? (
              <>
                <Spinner className="size-4 mr-2" />
                Importando…
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
