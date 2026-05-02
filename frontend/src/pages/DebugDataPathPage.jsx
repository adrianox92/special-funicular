import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/axios';

function safeHostFromUrl(raw) {
  if (raw == null || raw === '') return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

const DebugDataPathPage = () => {
  const [publicHealth, setPublicHealth] = useState(null);
  const [publicError, setPublicError] = useState(null);
  const [dataPath, setDataPath] = useState(null);
  const [dataPathError, setDataPathError] = useState(null);
  const [loading, setLoading] = useState(true);

  const axiosBase = api.defaults.baseURL || '';
  const reactApiEnv = process.env.REACT_APP_API_URL || '';
  const reactSupabaseHost = safeHostFromUrl(process.env.REACT_APP_SUPABASE_URL);

  const run = useCallback(async () => {
    setLoading(true);
    setPublicError(null);
    setDataPathError(null);
    try {
      const h = await api.get('/debug/health');
      setPublicHealth(h.data);
    } catch (e) {
      setPublicHealth(null);
      setPublicError(e.response?.data || e.message || String(e));
    }
    try {
      const d = await api.get('/debug/data-path');
      setDataPath(d.data);
    } catch (e) {
      setDataPath(null);
      setDataPathError(e.response?.data || e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Diagnóstico de API y datos</h1>
        <p className="text-sm text-muted-foreground">
          Comprueba desde el navegador qué URL usa el frontend, si el backend responde y si Supabase devuelve
          filas con el cliente <code className="text-xs">anon</code> (como las rutas actuales) frente al cliente
          con tu JWT.
        </p>
        <ButtonRow onRetry={run} loading={loading} />
      </div>

      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
        <h2 className="mb-2 font-medium">Cliente (este build)</h2>
        <ul className="space-y-1 font-mono text-xs break-all">
          <li>
            <span className="text-muted-foreground">axios baseURL: </span>
            {axiosBase || '(vacío)'}
          </li>
          <li>
            <span className="text-muted-foreground">REACT_APP_API_URL (build): </span>
            {reactApiEnv || '(no definida → en runtime puede usarse fallback localhost del bundle)'}
          </li>
          <li>
            <span className="text-muted-foreground">REACT_APP_SUPABASE_URL host (build): </span>
            {reactSupabaseHost || '(no definida)'}
          </li>
        </ul>
        {axiosBase.includes('localhost') && !reactApiEnv ? (
          <p className="mt-3 text-amber-700 dark:text-amber-400">
            El baseURL apunta a localhost y no hay REACT_APP_API_URL en este build: en producción las peticiones no
            llegarán a tu API salvo que rehagas el deploy con la variable configurada.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
        <h2 className="mb-2 font-medium">GET /api/debug/health (público)</h2>
        {publicError ? (
          <pre className="overflow-auto rounded bg-destructive/10 p-2 text-xs">{JSON.stringify(publicError, null, 2)}</pre>
        ) : publicHealth ? (
          <pre className="overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(publicHealth, null, 2)}</pre>
        ) : (
          <p className="text-muted-foreground">Sin datos.</p>
        )}
      </section>

      {publicHealth?.supabaseHost && reactSupabaseHost && publicHealth.supabaseHost !== reactSupabaseHost ? (
        <section className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm shadow-sm">
          <h2 className="mb-1 font-medium text-destructive">Proyecto Supabase distinto</h2>
          <p className="text-xs">
            Backend: <code className="break-all">{publicHealth.supabaseHost}</code> · Frontend (build):{' '}
            <code className="break-all">{reactSupabaseHost}</code>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            El login puede usar un proyecto y la API otro; los datos no coincidirán. Alinea{' '}
            <code className="text-[11px]">SUPABASE_URL</code> en el servidor con{' '}
            <code className="text-[11px]">REACT_APP_SUPABASE_URL</code> en el build del cliente.
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card p-4 text-sm shadow-sm">
        <h2 className="mb-2 font-medium">GET /api/debug/data-path (requiere sesión)</h2>
        {dataPathError ? (
          <pre className="overflow-auto rounded bg-destructive/10 p-2 text-xs">{JSON.stringify(dataPathError, null, 2)}</pre>
        ) : dataPath ? (
          <>
            {dataPath.hints?.length ? (
              <div className="mb-3 space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
                <p className="text-xs font-medium text-amber-900 dark:text-amber-100">Pistas</p>
                <ul className="list-inside list-disc text-xs text-amber-900/90 dark:text-amber-100/90">
                  {dataPath.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <pre className="max-h-[480px] overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(dataPath, null, 2)}</pre>
          </>
        ) : (
          <p className="text-muted-foreground">Sin datos.</p>
        )}
      </section>

      <p className="text-center text-sm">
        <Link to="/settings" className="text-primary underline">
          Volver a ajustes
        </Link>
      </p>
    </div>
  );
};

function ButtonRow({ onRetry, loading }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onRetry()}
        disabled={loading}
        className="rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {loading ? 'Comprobando…' : 'Repetir comprobaciones'}
      </button>
    </div>
  );
}

export default DebugDataPathPage;
