import React from 'react';
import { Link } from 'react-router-dom';
import {
  Car,
  TrendingUp,
  Trophy,
  Users,
  Clock,
  Settings,
  Sun,
  Moon,
  Check,
  FileText,
  Smartphone,
  Bot,
  Gauge,
  Monitor,
  LayoutGrid,
  Download,
  KeyRound,
  Palette,
  Layers,
  BarChart3,
  Zap,
  Banknote,
} from 'lucide-react';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';

const heroHighlights = [
  { label: 'PWA instalable', variant: 'secondary' },
  { label: 'Insights IA', variant: 'secondary' },
  { label: 'PDF exportable', variant: 'secondary' },
  { label: 'API de sincronización', variant: 'secondary' },
];

const heroCards = [
  {
    icon: Car,
    title: 'Colección',
    blurb: 'Fichas, fotos y reglajes en un solo lugar.',
    className: 'border-violet-500/20 bg-card/80',
    iconClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    icon: Gauge,
    title: 'Tiempos',
    blurb: 'Vueltas al milisegundo y análisis por sesión.',
    className: 'border-cyan-500/20 bg-card/80',
    iconClass: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    icon: Trophy,
    title: 'Competiciones',
    blurb: 'Inscripciones, reglas y ranking en vivo.',
    className: 'border-amber-500/20 bg-card/80',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
];

const keyStats = [
  {
    icon: LayoutGrid,
    title: 'Gestión completa',
    text: 'Fotos multi-vista, especificaciones técnicas y modificaciones con coste.',
  },
  {
    icon: Zap,
    title: 'Precisión al ms',
    text: 'Cronometraje por vuelta, consistencia y gráficos de evolución.',
  },
  {
    icon: Monitor,
    title: 'Competiciones pro',
    text: 'Ranking en vivo y modo presentación tipo TV para tu evento.',
  },
  {
    icon: Bot,
    title: 'Insights IA',
    text: 'Resúmenes inteligentes sobre tu colección y tendencias.',
  },
];

const featureBlocks = [
  {
    id: 'collection',
    title: 'Gestión de colección',
    description:
      'Catálogo profesional para cada coche: imágenes, datos de compra, reglaje y documentación lista para compartir.',
    bullets: [
      'Fotos por 6 vistas (frontal, perfiles, trasera, superior, chasis, 3/4)',
      'Especificaciones técnicas con componentes (motor, piñón, corona, guía, ejes…)',
      'Registro de modificaciones con coste y evolución',
      'Exportación a PDF de la ficha técnica completa',
      'Filtros avanzados, vista grid/tabla y exportación CSV',
      'Badges Digital, Museo y Taller',
    ],
    visualIcons: [Car, FileText, Layers, Download],
    reverse: false,
  },
  {
    id: 'timing',
    title: 'Cronometraje y rendimiento',
    description:
      'Entiende cómo rinde cada coche y cada cambio de setup con datos granulares y comparativas claras.',
    bullets: [
      'Tiempos por vuelta con precisión de milisegundos',
      'Análisis de sesión: evolución, histograma y delta vs mejor vuelta',
      'Comparativa de dos sesiones lado a lado',
      'Análisis de configuraciones: compara reglajes entre sesiones',
      'Comparativa de rendimiento por carril',
      'Gráficos de evolución de tiempos y velocidad',
    ],
    visualIcons: [Clock, Gauge, BarChart3, TrendingUp],
    reverse: true,
  },
  {
    id: 'competitions',
    title: 'Sistema de competiciones',
    description:
      'Organiza eventos con el mismo rigor que llevas en el garaje: categorías, reglas y resultados trazables.',
    bullets: [
      'Competiciones con circuitos y categorías',
      'Inscripciones públicas por enlace compartible',
      'Reglas de puntuación personalizables y plantillas',
      'Tiempos por ronda con penalizaciones',
      'Ranking en vivo y modo presentación (Live TV)',
      'Exportación CSV y PDF de resultados',
    ],
    visualIcons: [Trophy, Users, Settings, Monitor],
    reverse: false,
  },
  {
    id: 'analytics',
    title: 'Dashboard y analítica',
    description:
      'Un panel que resume inversión, distribución de la flota y rendimiento para decidir con datos.',
    bullets: [
      'Métricas de colección: vehículos, inversiones y tendencias',
      'Gráficos por marca, tipo, tienda y modificaciones',
      'Evolución de la inversión en el tiempo',
      'Top vehículos por coste y componentes más usados',
      'Insights generados por IA con opción de regenerar',
    ],
    visualIcons: [BarChart3, TrendingUp, Banknote, Bot],
    reverse: true,
  },
];

const extraCapabilities = [
  { icon: Smartphone, title: 'PWA', text: 'Instalable en móvil y escritorio.' },
  { icon: KeyRound, title: 'API & sync', text: 'API keys y endpoints para apps externas.' },
  { icon: Palette, title: 'Tema claro / oscuro', text: 'Cómodo en cualquier entorno.' },
  { icon: Layers, title: 'Responsive', text: 'Móvil, tablet y escritorio.' },
  { icon: LayoutGrid, title: 'Circuitos', text: 'Varios carriles y longitudes por carril.' },
];

const FeatureVisual = ({ icons }) => (
  <Card className="h-full border-dashed bg-muted/30">
    <CardContent className="flex h-full min-h-[200px] flex-wrap items-center justify-center gap-4 p-8">
      {icons.map((Icon, i) => (
        <div
          key={i}
          className="flex size-16 items-center justify-center rounded-xl border bg-card shadow-sm"
          aria-hidden
        >
          <Icon className="size-8 text-primary" />
        </div>
      ))}
    </CardContent>
  </Card>
);

const FeatureSection = ({ block }) => {
  const { title, description, bullets, visualIcons, reverse } = block;
  return (
    <section
      className="py-14 px-4 md:py-20"
      aria-labelledby={`feature-${block.id}-heading`}
    >
      <div
        className={cn(
          'mx-auto flex max-w-6xl flex-col gap-10 lg:items-center lg:gap-16',
          reverse ? 'lg:flex-row-reverse' : 'lg:flex-row',
        )}
      >
        <div className="flex flex-1 flex-col justify-center space-y-4">
          <h2 id={`feature-${block.id}-heading`} className="text-2xl font-bold tracking-tight md:text-3xl">
            {title}
          </h2>
          <p className="text-muted-foreground">{description}</p>
          <ul className="space-y-2.5">
            {bullets.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex-1">
          <FeatureVisual icons={visualIcons} />
        </div>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/50 to-background">
      <header
        className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md"
        role="banner"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight"
            aria-label="Slot Collection Pro, inicio"
          >
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Slot Collection Pro
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/slot-race-manager">Slot Race Manager</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login?register=true">Registrarse</Link>
            </Button>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden px-4 pb-16 pt-12 md:pb-24 md:pt-16"
        aria-labelledby="landing-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.12)_0%,transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(99,102,241,0.1)_0%,transparent_50%)]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl flex-1 text-center lg:text-left">
            <h1
              id="landing-hero-heading"
              className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl"
            >
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                Tu colección y tus tiempos, al nivel que mereces
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Gestiona coches de slot con fichas completas, cronometra por vuelta, compara reglajes y
              organiza competiciones con inscripción pública y ranking en vivo — todo en una sola
              plataforma.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start" role="list">
              {heroHighlights.map((h) => (
                <Badge key={h.label} variant={h.variant} className="font-normal" role="listitem">
                  {h.label}
                </Badge>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
              <Button asChild size="lg">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login?register=true">Registrarse</Link>
              </Button>
            </div>
            <Button asChild variant="link" className="mt-2 px-0 lg:justify-start">
              <Link to="/login" className="text-muted-foreground">
                ¿Ya tienes cuenta? Entra aquí
              </Link>
            </Button>
          </div>
          <div className="flex w-full max-w-md flex-1 flex-col gap-4 sm:max-w-lg">
            {heroCards.map((item) => (
              <Card
                key={item.title}
                className={cn(
                  'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
                  item.className,
                )}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div
                    className={cn(
                      'flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted',
                      item.iconClass,
                    )}
                  >
                    <item.icon className="size-7" aria-hidden />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.blurb}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40 py-14 px-4" aria-labelledby="key-stats-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="key-stats-heading" className="sr-only">
            Pilares de la plataforma
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {keyStats.map((s) => (
              <div key={s.title} className="text-center sm:text-left">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-background shadow-sm sm:mx-0">
                  <s.icon className="size-6 text-primary" aria-hidden />
                </div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divide-y">
        {featureBlocks.map((block) => (
          <FeatureSection key={block.id} block={block} />
        ))}
      </div>

      <section className="py-16 px-4" aria-labelledby="extras-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="extras-heading" className="text-center text-2xl font-bold md:text-3xl">
            Y además…
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Detalles que marcan la diferencia para usar la herramienta cada día.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {extraCapabilities.map((c) => (
              <Card key={c.title} className="bg-card/80">
                <CardContent className="flex flex-col gap-2 p-4">
                  <c.icon className="size-8 text-primary" aria-hidden />
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        className="relative overflow-hidden py-20 px-4"
        aria-labelledby="cta-final-heading"
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-indigo-600/5 to-transparent dark:from-violet-500/15"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 id="cta-final-heading" className="text-2xl font-bold md:text-3xl">
            Empieza a gestionar tu colección hoy
          </h2>
          <p className="mt-3 text-muted-foreground">
            Crea tu cuenta en segundos y lleva registro de cada coche, cada vuelta y cada evento.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/login?register=true">Crear cuenta gratis</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
