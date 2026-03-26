import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Moon,
  Check,
  Timer,
  Dumbbell,
  Trophy,
  Zap,
  WifiOff,
  PlugZap,
  Users,
  Gauge,
  BarChart3,
  Flag,
  Monitor,
  CloudUpload,
  KeyRound,
  Car,
  ArrowLeft,
  Download,
  Package,
} from 'lucide-react';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';

const heroBadges = [
  { label: 'App de escritorio', variant: 'secondary' },
  { label: 'Funciona sin internet', variant: 'secondary' },
  { label: 'Cronómetro DS200', variant: 'secondary' },
  { label: 'Datos en tu PC', variant: 'secondary' },
  { label: 'Sincronización con la web', variant: 'secondary' },
];

const heroCards = [
  {
    icon: Timer,
    title: 'Cronometraje en pista',
    blurb: 'Conecta el cronómetro DS200 y registra cada vuelta con precisión.',
    className: 'border-[#ff1716]/25 bg-card/80',
    iconClass: 'text-[#ff1716]',
  },
  {
    icon: Dumbbell,
    title: 'Entrenamiento individual',
    blurb: 'Un carril, métricas en vivo, historial y archivos para analizar en Excel.',
    className: 'border-[#808a99]/30 bg-card/80',
    iconClass: 'text-[#808a99]',
  },
  {
    icon: Trophy,
    title: 'Competiciones con ranking',
    blurb: 'Rally o simultáneo, mangas, clasificación y modo TV.',
    className: 'border-[#ff1716]/20 bg-card/80',
    iconClass: 'text-[#ff1716]',
  },
];

const pillars = [
  {
    icon: Zap,
    title: 'Tiempo real',
    text: 'Clasificación y métricas actualizadas vuelta a vuelta durante la manga o el entrenamiento.',
  },
  {
    icon: WifiOff,
    title: 'Sin conexión o con copia en la nube',
    text:
      'Funciona sin internet. Si tienes cuenta en Scalextric Collection y hay conexión, los resultados se suben al terminar cada sesión o manga; si no, se guardan y se envían cuando vuelva la red.',
  },
  {
    icon: PlugZap,
    title: 'Semáforo tipo F1',
    text: 'Opcional: conecta un semáforo electrónico por un segundo cable y coordina salidas como en la F1.',
  },
  {
    icon: Users,
    title: 'Multiplataforma de pilotos',
    text: 'Cada piloto vincula su propia cuenta y ve sus tiempos y estadísticas en la web.',
  },
];

const featureBlocks = [
  {
    id: 'ds200',
    title: 'Cronometraje DS200',
    description:
      'La app se conecta al cronómetro DS200, muestra la clasificación al instante y guarda todo en tu ordenador.',
    bullets: [
      'Tiempos al milisegundo; lecturas duplicadas del cronómetro se ignoran automáticamente',
      'Clasificación en vivo: posición, vueltas, tiempos totales, última vuelta, media, mejor tiempo y distancia respecto al líder',
      'Tiempo mínimo de vuelta ajustable para ignorar rebotes',
      'Puedes anular la última vuelta válida en cada carril si hubo un error',
      'La manga puede terminar por número de vueltas, por tiempo o por señal del cronómetro',
    ],
    visualIcons: [Timer, Gauge, Flag, BarChart3],
    reverse: false,
  },
  {
    id: 'training',
    title: 'Modo entrenamiento',
    description:
      'Sesión en un solo carril sin vueltas objetivo: paras cuando quieras. Ideal para mejorar reglaje y ritmo.',
    bullets: [
      'Última vuelta, diferencia respecto a la anterior y a tu mejor vuelta, media de las últimas cinco',
      'Tendencia, regularidad y gráfico de las últimas cincuenta vueltas',
      'Historial de sesiones con detalle y descarga de archivo para analizar en Excel',
    ],
    visualIcons: [Dumbbell, BarChart3, Download, Gauge],
    reverse: true,
  },
  {
    id: 'competition',
    title: 'Gestión de competiciones',
    description:
      'Competiciones con mangas planificadas, clasificación general y por manga, y ventana auxiliar para TV o proyector.',
    bullets: [
      'Modos Rally y Simultáneo; plan automático de mangas y rotación de carriles',
      'Salida por primer cruce, cuenta atrás o semáforo F1 con hardware opcional',
      'Clasificatoria opcional y generación de mangas desde tiempos',
      'Ventana TV y clasificación en vivo para segundo monitor',
      'Descarga de listados de vueltas, resúmenes y datos completos para archivo o Excel',
    ],
    visualIcons: [Trophy, Flag, Monitor, Timer],
    reverse: false,
  },
  {
    id: 'sync',
    title: 'Sincronización con Scalextric Collection',
    description:
      'Opcional: indica la dirección de esta web, el circuito y el acceso de cada piloto para que los tiempos aparezcan en su cuenta.',
    bullets: [
      'Cada piloto obtiene su acceso iniciando sesión con correo y contraseña desde la app de escritorio',
      'Los coches locales se emparejan con los de la cuenta en la web',
      'Se envían las mangas y los entrenamientos con el detalle de cada vuelta',
      'Si no hay red, los resultados quedan pendientes y se pueden enviar después con un solo clic',
    ],
    visualIcons: [CloudUpload, KeyRound, Car, Package],
    reverse: true,
  },
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
          <Icon className="size-8 text-[#ff1716]" />
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
      aria-labelledby={`srm-feature-${block.id}-heading`}
    >
      <div
        className={cn(
          'mx-auto flex max-w-6xl flex-col gap-10 lg:items-center lg:gap-16',
          reverse ? 'lg:flex-row-reverse' : 'lg:flex-row',
        )}
      >
        <div className="flex flex-1 flex-col justify-center space-y-4">
          <h2
            id={`srm-feature-${block.id}-heading`}
            className="text-2xl font-bold tracking-tight md:text-3xl"
          >
            {title}
          </h2>
          <p className="text-muted-foreground">{description}</p>
          <ul className="space-y-2.5">
            {bullets.map((item) => (
              <li key={item} className="flex gap-2 text-sm">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400"
                  aria-hidden
                />
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

const SlotRaceManagerPage = () => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/50 to-background">
      <header
        className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md"
        role="banner"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0 px-2">
              <Link to="/" aria-label="Volver al inicio">
                <ArrowLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">Inicio</span>
              </Link>
            </Button>
            <span className="h-6 w-px bg-border shrink-0" aria-hidden />
            <Link
              to="/slot-race-manager"
              className="truncate text-lg font-bold tracking-tight"
              aria-label="Slot Race Manager"
            >
              <span
                className="bg-gradient-to-r from-[#ff1716] to-[#c41212] bg-clip-text text-transparent"
              >
                Slot Race Manager
              </span>
            </Link>
          </div>
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
            {user ? (
              <Button asChild variant="default" size="sm">
                <Link to="/dashboard">Ir al panel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login">Iniciar sesión</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login?register=true">Registrarse</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden px-4 pb-16 pt-12 md:pb-24 md:pt-16"
        aria-labelledby="srm-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,23,22,0.08)_0%,transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(128,138,153,0.12)_0%,transparent_50%)]"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl flex-1 text-center lg:text-left">
            <p className="text-sm font-medium text-[#808a99] dark:text-[#808a99]">
              Aplicación de escritorio para Windows
            </p>
            <h1
              id="srm-hero-heading"
              className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl"
            >
              <span className="bg-gradient-to-r from-[#ff1716] to-[#c41212] bg-clip-text text-transparent">
                Rendimiento en pista, conectado a tu colección
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Slot Race Manager se conecta al cronómetro DS200, gestiona entrenamientos y competiciones
              en tu ordenador, y si quieres sincroniza con{' '}
              <strong className="text-foreground">Scalextric Collection</strong> para ver tus
              tiempos y estadísticas en la web después de cada sesión.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start" role="list">
              {heroBadges.map((h) => (
                <Badge key={h.label} variant={h.variant} className="font-normal" role="listitem">
                  {h.label}
                </Badge>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
              {user ? (
                <Button asChild size="lg" className="bg-[#ff1716] hover:bg-[#e01414]">
                  <Link to="/dashboard">Abrir Scalextric Collection</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="bg-[#ff1716] hover:bg-[#e01414]">
                  <Link to="/login?register=true">Crear cuenta para sincronizar</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <a href="#descarga">Descarga (Windows)</a>
              </Button>
            </div>
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
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.blurb}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/40 py-14 px-4" aria-labelledby="srm-pillars-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="srm-pillars-heading" className="sr-only">
            Pilares de Slot Race Manager
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((p) => (
              <div key={p.title} className="text-center sm:text-left">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-background shadow-sm sm:mx-0">
                  <p.icon className="size-6 text-[#ff1716]" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
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

      <section
        id="descarga"
        className="scroll-mt-20 py-16 px-4"
        aria-labelledby="srm-download-heading"
      >
        <div className="mx-auto max-w-6xl">
          <h2 id="srm-download-heading" className="text-center text-2xl font-bold md:text-3xl">
            Descarga en el PC del circuito
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            Disponible para Windows: instalador recomendado o versión portable en un solo archivo. En
            el PC del circuito solo necesitas instalar o copiar el programa, conectar el cronómetro
            DS200 y, si lo usas, el semáforo opcional.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card className="border-[#ff1716]/20 bg-card/80">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <Download className="size-8 text-[#ff1716]" aria-hidden />
                  <h3 className="text-lg font-semibold">Instalador (recomendado)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Incluye el asistente de instalación habitual en Windows. Es la opción más cómoda
                  para dejar el programa listo en el ordenador del circuito.
                </p>
                <Badge variant="secondary" className="w-fit">
                  Instalador de Slot Race Manager
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-[#808a99]/25 bg-card/80">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <Package className="size-8 text-[#808a99]" aria-hidden />
                  <h3 className="text-lg font-semibold">Portable</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Un solo archivo ejecutable sin instalador: práctico para probar rápido o llevar en
                  una memoria USB.
                </p>
                <Badge variant="secondary" className="w-fit">
                  Versión portable (un solo archivo)
                </Badge>
              </CardContent>
            </Card>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Pensado para <strong className="text-foreground">Windows</strong>. Obtén el instalador o
            el ejecutable desde quien distribuya Slot Race Manager; en pista solo hace falta el
            programa instalado o copiado.
          </p>
        </div>
      </section>

      <section
        className="relative overflow-hidden py-20 px-4"
        aria-labelledby="srm-cta-heading"
      >
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#ff1716]/10 via-transparent to-[#808a99]/5 dark:from-[#ff1716]/15"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 id="srm-cta-heading" className="text-2xl font-bold md:text-3xl">
            Activa la sincronización con Scalextric Collection
          </h2>
          <p className="mt-3 text-muted-foreground">
            Crea tu cuenta en esta web, inicia sesión desde Slot Race Manager como piloto para
            vincular tu acceso, y empareja coches y circuito para que cada sesión quede reflejada en
            tu perfil.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="bg-[#ff1716] hover:bg-[#e01414]">
              <Link to="/login?register=true">Crear cuenta gratis</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/">Volver a la landing</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SlotRaceManagerPage;
