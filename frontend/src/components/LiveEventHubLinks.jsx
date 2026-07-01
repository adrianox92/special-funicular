import React, { useCallback, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { BookOpen, ChevronDown, ChevronRight, Copy, ExternalLink, QrCode, Radio, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Spinner } from './ui/spinner';
import { cn } from '../lib/utils';

const SCENES = [
  { id: 'ranking', label: 'Clasificación OBS', scene: 'ranking', width: 960, height: 540 },
  { id: 'bestlap', label: 'Mejor vuelta OBS', scene: 'bestlap', width: 720, height: 220 },
  { id: 'nextpilot', label: 'Próximo piloto OBS', scene: 'nextpilot', width: 720, height: 220 },
];

const OBS_BROWSER_CSS = `body { background-color: rgba(0,0,0,0); margin: 0; overflow: hidden; }`;

function buildPresentationUrl(slug, params = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const search = new URLSearchParams(params);
  const qs = search.toString();
  return `${origin}/competitions/presentation/${slug}${qs ? `?${qs}` : ''}`;
}

function ObsOverlayGuide({ onCopyCss }) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm font-medium',
          'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        onClick={() => setGuideOpen((open) => !open)}
        aria-expanded={guideOpen}
      >
        {guideOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <BookOpen className="size-4 shrink-0 text-muted-foreground" />
        Guía: usar overlays en OBS Studio
      </button>

      {guideOpen && (
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground list-decimal pl-5">
          <li>
            Abre <strong className="text-foreground">OBS Studio</strong> y selecciona la escena donde quieras el overlay.
          </li>
          <li>
            En <strong className="text-foreground">Fuentes</strong>, pulsa <strong className="text-foreground">+</strong>{' '}
            y elige <strong className="text-foreground">Navegador</strong> (Browser Source). Ponle un nombre descriptivo
            (p. ej. «Clasificación SlotScale»).
          </li>
          <li>
            Copia uno de los enlaces OBS de abajo y pégalo en el campo <strong className="text-foreground">URL</strong>.
            Cada enlace muestra una escena distinta (clasificación, mejor vuelta o próximo piloto).
          </li>
          <li>
            Ajusta <strong className="text-foreground">Ancho</strong> y <strong className="text-foreground">Alto</strong>{' '}
            según la escena (valores orientativos en cada enlace). Para una banda inferior usa, por ejemplo, 1920×220.
          </li>
          <li>
            Activa <strong className="text-foreground">«Controlar audio mediante OBS»</strong> solo si lo necesitas; para
            overlays visuales puedes dejarlo desactivado.
          </li>
          <li>
            En <strong className="text-foreground">Propiedades personalizadas de CSS</strong>, pega el snippet de abajo
            si el fondo no aparece transparente:
            <pre className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs font-mono text-foreground overflow-x-auto">
              {OBS_BROWSER_CSS}
            </pre>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onCopyCss}>
              <Copy className="size-3.5 mr-1" />
              Copiar CSS
            </Button>
          </li>
          <li>
            Repite el proceso para añadir varios overlays a la vez, o usa el enlace de{' '}
            <strong className="text-foreground">rotación automática</strong> para alternar escenas en una sola fuente.
          </li>
          <li>
            Para un monitor o proyector a pantalla completa (sin OBS), usa el enlace{' '}
            <strong className="text-foreground">Modo presentación TV</strong> en el navegador del dispositivo.
          </li>
        </ol>
      )}
    </div>
  );
}

/**
 * Enlaces y QR del Live Event Hub para organizadores (colapsable).
 * @param {{ publicSlug: string, defaultExpanded?: boolean }} props
 */
const LiveEventHubLinks = ({ publicSlug, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState('status');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);

  const links = useMemo(() => {
    if (!publicSlug) return null;
    return {
      status: `${typeof window !== 'undefined' ? window.location.origin : ''}/competitions/status/${publicSlug}`,
      presentationTv: buildPresentationUrl(publicSlug, { tv: '1' }),
      overlayRotate: buildPresentationUrl(publicSlug, { overlay: '1', rotate: '1', interval: '12' }),
    };
  }, [publicSlug]);

  const copyLink = useCallback(async (url, label) => {
    if (!url || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  }, []);

  const copyObsCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(OBS_BROWSER_CSS);
      toast.success('CSS para OBS copiado');
    } catch {
      toast.error('No se pudo copiar el CSS');
    }
  }, []);

  const openQr = useCallback(
    async (target) => {
      if (!links) return;
      const url = target === 'status' ? links.status : links.presentationTv;
      setQrTarget(target);
      setQrOpen(true);
      setQrDataUrl('');
      setQrLoading(true);
      try {
        const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 2 });
        setQrDataUrl(dataUrl);
      } catch {
        toast.error('No se pudo generar el QR');
      } finally {
        setQrLoading(false);
      }
    },
    [links],
  );

  if (!publicSlug || !links) {
    return null;
  }

  const linkRow = (label, url, hint = null) => (
    <div key={label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        <code className="text-xs text-muted-foreground break-all">{url.replace(/^https?:\/\/[^/]+/, '')}</code>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => copyLink(url, label)}>
          <Copy className="size-3.5 mr-1" />
          Copiar
        </Button>
        <Button type="button" size="sm" variant="ghost" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
    </div>
  );

  const quickActions = (
    <div className="flex flex-wrap gap-1.5">
      <Button type="button" size="sm" variant="outline" onClick={() => copyLink(links.status, 'Estado en vivo')}>
        <Radio className="size-3.5 mr-1" />
        Estado
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => copyLink(links.presentationTv, 'Modo TV')}>
        <Tv className="size-3.5 mr-1" />
        TV
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => openQr('status')}>
        <QrCode className="size-3.5 mr-1" />
        QR pista
      </Button>
    </div>
  );

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="py-3 pb-2 space-y-2">
          <div className="flex items-start gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 mt-0.5"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls="live-event-hub-content"
              title={expanded ? 'Minimizar' : 'Expandir'}
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </Button>
            <button
              type="button"
              className={cn(
                'min-w-0 flex-1 text-left rounded-md -m-1 p-1',
                'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-controls="live-event-hub-content"
            >
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="size-4" />
                Live Event Hub
              </CardTitle>
              <CardDescription className="mt-1">
                Enlaces TV, overlays OBS y QR para espectadores. {expanded ? '' : 'Pulsa para ver todos los enlaces.'}
              </CardDescription>
            </button>
          </div>
          {!expanded && quickActions}
        </CardHeader>

        {expanded && (
          <CardContent id="live-event-hub-content" className="space-y-4 pt-0">
            {quickActions}
            {linkRow('Estado en vivo (público)', links.status)}
            {linkRow('Modo presentación TV', links.presentationTv, 'Pantalla completa en monitor o proyector')}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Overlays OBS (fondo transparente)</p>
              {SCENES.map(({ label, scene, width, height }) =>
                linkRow(
                  label,
                  buildPresentationUrl(publicSlug, { overlay: '1', scene }),
                  `Tamaño sugerido: ${width}×${height} px`,
                ),
              )}
              {linkRow(
                'Rotación automática OBS',
                links.overlayRotate,
                'Alterna clasificación, mejor vuelta y próximo piloto cada 12 s',
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => openQr('status')}>
                <QrCode className="size-4 mr-1" />
                QR estado en pista
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => openQr('tv')}>
                <QrCode className="size-4 mr-1" />
                QR modo TV
              </Button>
            </div>
            <ObsOverlayGuide onCopyCss={copyObsCss} />
          </CardContent>
        )}
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR — {qrTarget === 'status' ? 'estado en vivo' : 'modo TV'}</DialogTitle>
            <DialogDescription>Comparte en pista o redes del club.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrLoading ? (
              <Spinner className="size-8" />
            ) : (
              qrDataUrl && (
                <img src={qrDataUrl} alt="Código QR competición" className="max-w-[220px] rounded-md border border-border" />
              )
            )}
            <code className="text-xs text-center break-all text-muted-foreground">
              {qrTarget === 'status' ? links.status : links.presentationTv}
            </code>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => copyLink(qrTarget === 'status' ? links.status : links.presentationTv, 'Enlace')}
            >
              Copiar enlace
            </Button>
            <Button type="button" variant="secondary" onClick={() => setQrOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LiveEventHubLinks;
