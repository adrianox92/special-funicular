import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../lib/axios';
import PublicCatalogShell from '../components/PublicCatalogShell';
import { Spinner } from '../components/ui/spinner';
import { Alert, AlertDescription } from '../components/ui/alert';

/**
 * Renderizado mínimo de Markdown a HTML:
 * - Encabezados h1-h3
 * - Párrafos
 * - Listas sin ordenar
 * - Negrita / cursiva
 * Sin dependencias externas para mantener el bundle ligero.
 */
function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    // Sanitizar básico: escapar <, > en el contenido
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Encabezados
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 class="text-2xl font-bold mt-2 mb-3">$1</h1>')
    // Listas sin ordenar
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Negrita e cursiva
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    // Párrafos: líneas no-vacías que no son ya etiquetas
    .replace(/^(?!<[hlu]|<li)(.+)$/gm, (line) =>
      line.trim() ? `<p class="mb-3">${line}</p>` : '',
    )
    // Envolver listas
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (block) => `<ul class="mb-3 space-y-1">${block}</ul>`);
  return html;
}

export default function PoliciesPage() {
  const { slug } = useParams();
  const [policy, setPolicy]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/store-listings/public/policies/${encodeURIComponent(slug)}`);
        if (!cancelled) setPolicy(data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || 'No se encontró la política solicitada.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    const FALLBACK_TITLES = {
      'seller-terms': 'Condiciones para vendedores',
      'listing-guidelines': 'Guía de publicación de listados',
    };
    if (policy?.title) {
      document.title = `${policy.title} | Slot Database`;
    } else if (slug && FALLBACK_TITLES[slug]) {
      document.title = `${FALLBACK_TITLES[slug]} | Slot Database`;
    } else {
      document.title = `Políticas | Slot Database`;
    }
  }, [policy, slug]);

  return (
    <PublicCatalogShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-7" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(policy?.content_md) }}
            />
            <p className="mt-8 text-xs text-muted-foreground border-t border-border pt-4">
              Última actualización:{' '}
              {policy?.updated_at
                ? new Date(policy.updated_at).toLocaleDateString('es-ES', {
                    day:   'numeric',
                    month: 'long',
                    year:  'numeric',
                  })
                : '—'}
            </p>
            <p className="mt-4 text-sm">
              <Link to="/catalogo" className="text-primary hover:underline">
                ← Volver al catálogo
              </Link>
            </p>
          </>
        )}
      </div>
    </PublicCatalogShell>
  );
}
