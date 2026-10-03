import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  PieChart,
  Package,
} from 'lucide-react';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { cn } from '../lib/utils';
import { applyLandingPageSeo } from '../utils/landingSeo';
import LanguageSelector from '../components/LanguageSelector';
import useLocale from '../hooks/useLocale';
import { localizePath } from '../i18n/localeUtils';

const STAT_DEFS = [
  { id: 'complete', icon: LayoutGrid },
  { id: 'precision', icon: Zap },
  { id: 'competitions', icon: Monitor },
  { id: 'inventory', icon: Package },
];

const FEATURE_DEFS = [
  { id: 'collection', visualIcons: [Car, FileText, Layers, Download], reverse: false },
  { id: 'inventory', visualIcons: [Package, Banknote, Layers, FileText], reverse: true },
  { id: 'timing', visualIcons: [Clock, Gauge, BarChart3, TrendingUp], reverse: false },
  { id: 'competitions', visualIcons: [Trophy, Users, Settings, Monitor], reverse: true },
  { id: 'analytics', visualIcons: [BarChart3, TrendingUp, Banknote, PieChart], reverse: false },
];

const EXTRA_DEFS = [
  { id: 'pwa', icon: Smartphone },
  { id: 'api', icon: KeyRound },
  { id: 'theme', icon: Palette },
  { id: 'responsive', icon: Layers },
  { id: 'circuits', icon: LayoutGrid },
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
            {(Array.isArray(bullets) ? bullets : []).map((item) => (
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
  const { t } = useTranslation('landing');
  const { locale } = useLocale();
  const { theme, toggleTheme } = useTheme();

  const headerLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-header.png' : 'logo-header-dark.png'
  }`;

  const heroLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-hero-dark.png' : 'logo-hero-light.png'
  }`;

  const heroHighlights = [
    { label: t('highlights.pwa'), variant: 'secondary' },
    { label: t('highlights.pdf'), variant: 'secondary' },
    { label: t('highlights.api'), variant: 'secondary' },
  ];

  const heroCards = [
    { icon: Car, title: t('cards.collection.title'), blurb: t('cards.collection.blurb'), className: 'border-primary/20 bg-card/80', iconClass: 'text-primary' },
    { icon: Gauge, title: t('cards.timings.title'), blurb: t('cards.timings.blurb'), className: 'border-border bg-card/80', iconClass: 'text-primary' },
    { icon: Trophy, title: t('cards.competitions.title'), blurb: t('cards.competitions.blurb'), className: 'border-border bg-card/80', iconClass: 'text-primary' },
    { icon: Package, title: t('cards.inventory.title'), blurb: t('cards.inventory.blurb'), className: 'border-border bg-card/80', iconClass: 'text-primary' },
  ];

  const keyStats = STAT_DEFS.map((s) => ({
    ...s,
    title: t(`stats.${s.id}.title`),
    text: t(`stats.${s.id}.text`),
  }));

  const featureBlocks = FEATURE_DEFS.map((block) => ({
    ...block,
    title: t(`features.${block.id}.title`),
    description: t(`features.${block.id}.description`),
    bullets: t(`features.${block.id}.bullets`, { returnObjects: true }),
  }));

  const extraCapabilities = EXTRA_DEFS.map((c) => ({
    ...c,
    title: t(`extras.${c.id}.title`),
    text: t(`extras.${c.id}.text`),
  }));

  const catalogHref = localizePath(locale, '/catalogo');

  useEffect(() => {
    applyLandingPageSeo(locale);
  }, [locale]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/50 to-background">
      <header
        className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md"
        role="banner"
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center">
            <img
              key={headerLogoSrc}
              src={headerLogoSrc}
              alt="Slot Database"
              className="h-9 w-auto max-w-[min(100%,14rem)] object-contain object-left sm:max-w-[16rem]"
              decoding="async"
            />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector size="compact" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label={t('themeToggle')}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to={catalogHref}>{t('nav.catalog')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/slot-race-manager">{t('nav.slotRaceManager')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">{t('nav.login')}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login?register=true">{t('nav.register')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section
        className="relative overflow-hidden px-4 pb-16 pt-12 md:pb-24 md:pt-16"
        aria-labelledby="landing-hero-heading"
      >
        <div
          className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-muted/50 blur-3xl dark:bg-muted/30"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-muted/40 blur-3xl dark:bg-muted/25"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl flex-1 text-center lg:text-left">
            <h1
              id="landing-hero-heading"
              className="text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl"
            >
              <span className="block">
                <img
                  key={heroLogoSrc}
                  src={heroLogoSrc}
                  alt="Slot Database"
                  className="mx-auto h-auto w-full min-w-[250px] max-w-[min(100%,36rem)] object-contain object-center lg:mx-0 lg:object-left"
                  decoding="async"
                />
              </span>
              <span className="mt-3 block text-2xl font-bold tracking-tight text-foreground md:text-3xl lg:text-4xl">
                {t('hero.tagline')}
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              {t('hero.lead')}
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
                <Link to="/login">{t('hero.ctaLogin')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login?register=true">{t('hero.ctaRegisterShort')}</Link>
              </Button>
            </div>
            <Button asChild variant="link" className="mt-2 px-0 lg:justify-start">
              <Link to="/login" className="text-muted-foreground">
                {t('hero.ctaHaveAccount')}
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
            {t('stats.aria')}
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
            {t('extras.heading')}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-muted-foreground">
            {t('extras.lead')}
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
          className="absolute inset-0 bg-gradient-to-br from-primary/5 via-muted/40 to-transparent dark:from-primary/10 dark:via-muted/20"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <h2 id="cta-final-heading" className="text-2xl font-bold md:text-3xl">
            {t('cta.title')}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {t('cta.lead')}
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/login?register=true">{t('cta.register')}</Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;
