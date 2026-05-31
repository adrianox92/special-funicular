import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import axios from '../lib/axios';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from 'sonner';
import { hasRegulation } from '../utils/competitionRegulation';

const REGULATION_MAX = 10 * 1024 * 1024;
const ACCEPTED_TYPES = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const emptyRegulation = () => ({
  regulation_url: '',
  regulationMode: 'none',
});

const CompetitionRegulation = ({ competitionId, readOnly = false }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regulation, setRegulation] = useState(null);
  const [form, setForm] = useState(emptyRegulation());
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!competitionId) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/competitions/${competitionId}`);
      const row = {
        regulation_url: data.regulation_url || null,
        regulation_file_path: data.regulation_file_path || null,
        regulation_file_name: data.regulation_file_name || null,
        regulation_file_url: data.regulation_file_url || null,
      };
      setRegulation(row);
      setForm({
        regulation_url: row.regulation_url || '',
        regulationMode: row.regulation_url
          ? 'url'
          : row.regulation_file_path
            ? 'file'
            : 'none',
      });
      setPendingFile(null);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el reglamento de la competición');
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveUrl = async () => {
    if (readOnly) return;
    try {
      setSaving(true);
      setError(null);
      const url = form.regulationMode === 'url' ? form.regulation_url.trim() : '';
      const { data } = await axios.put(`/competitions/${competitionId}/regulation`, {
        regulation_url: url || null,
      });
      setRegulation({
        regulation_url: data.regulation_url || null,
        regulation_file_path: data.regulation_file_path || null,
        regulation_file_name: data.regulation_file_name || null,
        regulation_file_url: data.regulation_file_url || null,
      });
      setForm({
        regulation_url: data.regulation_url || '',
        regulationMode: data.regulation_url ? 'url' : data.regulation_file_path ? 'file' : 'none',
      });
      toast.success('Reglamento actualizado');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el reglamento');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFile = async () => {
    if (readOnly || !pendingFile) return;
    if (pendingFile.size > REGULATION_MAX) {
      toast.error('El archivo no puede superar 10 MB');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const fd = new FormData();
      fd.append('file', pendingFile);
      const { data } = await axios.post(`/competitions/${competitionId}/regulation`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRegulation({
        regulation_url: data.regulation_url || null,
        regulation_file_path: data.regulation_file_path || null,
        regulation_file_name: data.regulation_file_name || null,
        regulation_file_url: data.regulation_file_url || null,
      });
      setForm({
        regulation_url: '',
        regulationMode: 'file',
      });
      setPendingFile(null);
      toast.success('Fichero de reglamento subido');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir el reglamento');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFile = async () => {
    if (readOnly) return;
    try {
      setSaving(true);
      setError(null);
      const { data } = await axios.delete(`/competitions/${competitionId}/regulation`);
      setRegulation({
        regulation_url: data.regulation_url || null,
        regulation_file_path: data.regulation_file_path || null,
        regulation_file_name: data.regulation_file_name || null,
        regulation_file_url: data.regulation_file_url || null,
      });
      setForm(emptyRegulation());
      setPendingFile(null);
      toast.success('Fichero eliminado');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el fichero');
    } finally {
      setSaving(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" />
          Reglamento de la competición
        </CardTitle>
        <CardDescription>
          Visible en la inscripción pública cuando la competición no tiene categorías.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {readOnly ? (
          hasRegulation(regulation) ? (
            <div className="text-sm space-y-1">
              {regulation.regulation_url && (
                <p>
                  URL:{' '}
                  <a
                    href={regulation.regulation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {regulation.regulation_url}
                  </a>
                </p>
              )}
              {regulation.regulation_file_name && (
                <p className="flex items-center gap-2">
                  <FileText className="size-4" />
                  {regulation.regulation_file_name}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay reglamento configurado.</p>
          )
        ) : (
          <>
            <div className="space-y-2">
              <Label>Tipo de reglamento</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'none', label: 'Sin reglamento' },
                  { value: 'url', label: 'URL externa' },
                  { value: 'file', label: 'Subir fichero' },
                ].map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={form.regulationMode === opt.value ? 'default' : 'outline'}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, regulationMode: opt.value }));
                      setPendingFile(null);
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {form.regulationMode === 'url' && (
              <div className="space-y-2">
                <Label htmlFor="competition-regulation-url">URL del reglamento</Label>
                <Input
                  id="competition-regulation-url"
                  type="url"
                  value={form.regulation_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, regulation_url: e.target.value }))}
                  placeholder="https://..."
                />
                <Button type="button" size="sm" onClick={handleSaveUrl} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar URL'}
                </Button>
              </div>
            )}

            {form.regulationMode === 'file' && (
              <div className="space-y-2">
                {regulation?.regulation_file_name && !pendingFile && (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm flex items-center gap-2">
                      <FileText className="size-4" />
                      {regulation.regulation_file_name}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={handleRemoveFile}
                      disabled={saving}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
                <Label htmlFor="competition-regulation-file">Fichero (PDF o Word, máx. 10 MB)</Label>
                <Input
                  id="competition-regulation-file"
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                />
                {pendingFile && (
                  <Button type="button" size="sm" onClick={handleUploadFile} disabled={saving}>
                    <Upload className="size-4 mr-1" />
                    {saving ? 'Subiendo...' : 'Subir fichero'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompetitionRegulation;
