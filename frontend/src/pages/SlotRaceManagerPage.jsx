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
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const BADGE_IDS = ['desktop', 'offline', 'ds200', 'localData', 'sync'];

const CARD_DEFS = [
  { id: 'timing', icon: Timer, className: 'border-[#ff1716]/25 bg-card/80', iconClass: 'text-[#ff1716]' },
  { id: 'training', icon: Dumbbell, className: 'border-[#808a99]/30 bg-card/80', iconClass: 'text-[#808a99]' },
  { id: 'competitions', icon: Trophy, className: 'border-[#ff1716]/20 bg-card/80', iconClass: 'text-[#ff1716]' },
];

const PILLAR_DEFS = [
  { id: 'realtime', icon: Zap },
  { id: 'offline', icon: WifiOff },
  { id: 'lights', icon: PlugZap },
  { id: 'pilots', icon: Users },
];

const FEATURE_DEFS = [
  { id: 'ds200', visualIcons: [Timer, Gauge, Flag, BarChart3], reverse: false },
  { id: 'training', visualIcons: [Dumbbell, BarChart3, Download, Gauge], reverse: true },
  { id: 'competition', visualIcons: [Trophy, Flag, Monitor, Timer], reverse: false },
  { id: 'sync', visualIcons: [CloudUpload, KeyRound, Car, Package], reverse: true },
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
            {(Array.isArray(bullets) ? bullets : []).map((item) => (
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
  const { t } = useTranslation('slotRaceManager');

  const heroBadges = BADGE_IDS.map((id) => ({
    label: t(`badges.${id}`),
    variant: 'secondary',
  }));
  const heroCards = CARD_DEFS.map((item) => ({
    ...item,
    title: t(`cards.${item.id}.title`),
    blurb: t(`cards.${item.id}.blurb`),
  }));
  const pillars = PILLAR_DEFS.map((p) => ({
    ...p,
    title: t(`pillars.${p.id}.title`),
    text: t(`pillars.${p.id}.text`),
  }));
  const featureBlocks = FEATURE_DEFS.map((block) => ({
    ...block,
    title: t(`features.${block.id}.title`),
    description: t(`features.${block.id}.description`),
    bullets: t(`features.${block.id}.bullets`, { returnObjects: true }),
  }));

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/50 to-background">
      <header
        className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md"
        role="banner"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0 px-2">
              <Link to="/" aria-label={t('backHomeAria')}>
                <ArrowLeft className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">{t('backHome')}</span>
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
              aria-label={t('themeToggle')}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <LanguageSelector size="compact" />
            {user ? (
              <Button asChild variant="default" size="sm">
                <Link to="/dashboard">{t('goDashboard')}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to="/login">{t('login')}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/login?register=true">{t('register')}</Link>
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
              {t('hero.kicker')}
            </p>
            <h1
              id="srm-hero-heading"
              className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl"
            >
              <span className="bg-gradient-to-r from-[#ff1716] to-[#c41212] bg-clip-text text-transparent">
                {t('hero.title')}
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              {t('hero.lead')}
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
                  <Link to="/dashboard">{t('ctaOpen')}</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="bg-[#ff1716] hover:bg-[#e01414]">
                  <Link to="/login?register=true">{t('ctaSyncAccount')}</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <a href="#descarga">{t('ctaDownload')}</a>
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
            {t('pillars.aria')}
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
            {t('download.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            {t('download.lead')}
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card className="border-[#ff1716]/20 bg-card/80">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <Download className="size-8 text-[#ff1716]" aria-hidden />
                  <h3 className="text-lg font-semibold">{t('download.installerTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('download.installerText')}
                </p>
                <Badge variant="secondary" className="w-fit">
                  {t('download.installerBadge')}
                </Badge>
              </CardContent>
            </Card>
            <Card className="border-[#808a99]/25 bg-card/80">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center gap-2">
                  <Package className="size-8 text-[#808a99]" aria-hidden />
                  <h3 className="text-lg font-semibold">{t('download.portableTitle')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('download.portableText')}
                </p>
                <Badge variant="secondary" className="w-fit">
                  {t('download.portableBadge')}
                </Badge>
              </CardContent>
            </Card>
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('download.footnote')}
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
            {t('finalCta.title')}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {t('finalCta.lead')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" className="bg-[#ff1716] hover:bg-[#e01414]">
              <Link to="/login?register=true">{t('finalCta.register')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/">{t('finalCta.backLanding')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SlotRaceManagerPage;
