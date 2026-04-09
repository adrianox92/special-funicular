import React, { useEffect, useState, useId } from 'react';
import { MessageCircleQuestion, Loader2 } from 'lucide-react';
import api from '../lib/axios';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { visibleHelpSections } from '../content/helpGuide';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

function SectionAnchor({ id, children }) {
  return (
    <a href={`#${id}`} className="text-primary font-medium hover:underline">
      {children}
    </a>
  );
}

export default function HelpAssistant() {
  const { user } = useAuth();
  const helpSections = visibleHelpSections(isLicenseAdminUser(user));
  const formId = useId();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [serviceAvailable, setServiceAvailable] = useState(true);
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/help/status')
      .then((res) => {
        if (!cancelled) setServiceAvailable(Boolean(res.data?.available ?? res.data?.aiEnabled));
      })
      .catch(() => {
        if (!cancelled) setServiceAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 3) {
      setError('Escribe al menos 3 caracteres.');
      return;
    }
    if (!serviceAvailable) {
      setError('El asistente no está disponible en este momento. Consulta el índice y las secciones de esta página.');
      return;
    }
    setError(null);
    setAnswer(null);
    setLoading(true);

    try {
      const { data } = await api.post('/help/ask', { question: trimmed });
      if (data?.answer) {
        setAnswer(data.answer);
      } else if (data?.message) {
        setError(data.message);
      } else {
        setError('No se ha podido obtener una respuesta. Inténtalo de nuevo más tarde.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo obtener respuesta.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestion className="size-5 text-primary" aria-hidden />
          Pregunta a la guía
        </CardTitle>
        <CardDescription>
          Escribe en lenguaje natural (por ejemplo: «¿cómo doy de alta un coche?»). La respuesta se basa en el contenido de
          esta guía.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3" aria-labelledby={`${formId}-label`}>
          <div className="space-y-2">
            <Label id={`${formId}-label`} htmlFor={`${formId}-q`}>
              Tu pregunta
            </Label>
            <Textarea
              id={`${formId}-q`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej.: ¿Cómo registro una sesión de tiempos?"
              rows={3}
              className="resize-y min-h-[80px]"
              disabled={loading || !serviceAvailable}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={loading || !serviceAvailable}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" aria-hidden />
                  Buscando respuesta…
                </>
              ) : (
                'Buscar respuesta'
              )}
            </Button>
          </div>
        </form>

        {error && (
          <div className="space-y-2" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            {!serviceAvailable && (
              <p className="text-sm text-muted-foreground">
                Secciones de la guía:{' '}
                {helpSections.map((sec, i) => (
                  <span key={sec.id}>
                    {i > 0 ? ', ' : ''}
                    <SectionAnchor id={sec.id}>{sec.title}</SectionAnchor>
                  </span>
                ))}
                .
              </p>
            )}
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-4 min-h-[4rem]" aria-live="polite" aria-atomic="true">
          {loading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin shrink-0" aria-hidden />
              Buscando respuesta…
            </p>
          ) : !serviceAvailable ? (
            <p className="text-sm text-muted-foreground">
              El asistente no está disponible ahora mismo. Puedes usar el índice y las secciones de esta página.
            </p>
          ) : answer ? (
            <div className="text-sm text-foreground whitespace-pre-wrap">{answer}</div>
          ) : !error ? (
            <p className="text-sm text-muted-foreground">La respuesta aparecerá aquí.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
