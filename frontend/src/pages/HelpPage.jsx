import React from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Car,
  Clock,
  Flag,
  Package,
  Trophy,
  User,
  Settings,
  BookOpen,
  ListChecks,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { useTranslation } from 'react-i18next';
import HelpAssistant from '../components/HelpAssistant';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { getPrimerosPasos, getHelpTableOfContents, visibleHelpSections } from '../content/helpGuide';

const SECTION_ICONS = {
  inicio: Home,
  vehiculos: Car,
  tiempos: Clock,
  circuitos: Flag,
  inventario: Package,
  competiciones: Trophy,
  configuracion: Settings,
  perfil: User,
};

const BulletList = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-sm text-muted-foreground">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
);

const StepsList = ({ items }) => (
  <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted-foreground">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ol>
);

const HelpPage = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('help');
  const isAdmin = isLicenseAdminUser(user);
  const locale = i18n.language;
  const primerosPasos = getPrimerosPasos(locale);
  const helpTableOfContents = getHelpTableOfContents(isAdmin, locale);
  const sections = visibleHelpSections(isAdmin, locale);

  return (
  <div className="space-y-8 max-w-3xl">
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-primary">
        <BookOpen className="size-7" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">{t('page.title')}</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        {t('page.lead')}
      </p>
    </div>

    <HelpAssistant />

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('page.tocTitle')}</CardTitle>
        <CardDescription>{t('page.tocDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <nav aria-label={t('page.tocAria')} className="flex flex-wrap gap-2">
          {helpTableOfContents.map(({ id, label }) => {
            const Icon =
              id === 'primeros-pasos'
                ? ListChecks
                : SECTION_ICONS[id] || BookOpen;
            return (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-accent"
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </a>
            );
          })}
        </nav>
      </CardContent>
    </Card>

    <section id="primeros-pasos" className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="size-5 text-primary" aria-hidden />
              {primerosPasos.title}
            </CardTitle>
            <Badge variant="outline">{t('page.recommended')}</Badge>
          </div>
          <CardDescription>{primerosPasos.intro}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal pl-5 space-y-3 text-muted-foreground">
            {primerosPasos.steps.map((st) => (
              <li key={st.title}>
                <span className="font-medium text-foreground">{st.title}.</span> {st.body}{' '}
                {st.linkTo && (
                  <Link to={st.linkTo} className="text-primary font-medium hover:underline whitespace-nowrap">
                    {st.linkLabel} →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </section>

    {sections.map((sec) => {
      const Icon = SECTION_ICONS[sec.id] || BookOpen;
      return (
        <section key={sec.id} id={sec.id} className="scroll-mt-24">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="size-5 text-primary" aria-hidden />
                  {sec.title}
                </CardTitle>
                <Badge variant="secondary">{sec.pathBadge}</Badge>
              </div>
              <CardDescription>{sec.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{sec.intro}</p>
              {sec.steps?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">{t('page.steps')}</p>
                  <StepsList items={sec.steps} />
                </div>
              )}
              {sec.tips?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">{t('page.tips')}</p>
                  <BulletList items={sec.tips} />
                </div>
              )}
              {sec.qa?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">{t('page.qa')}</p>
                  <BulletList items={sec.qa} />
                </div>
              )}
              {sec.gotchas?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">{t('page.gotchas')}</p>
                  <BulletList items={sec.gotchas} />
                </div>
              )}
              <Link to={sec.linkTo} className="text-primary text-sm font-medium hover:underline inline-flex">
                {sec.linkLabel} →
              </Link>
            </CardContent>
          </Card>
        </section>
      );
    })}

    <Separator />

    <p className="text-xs text-muted-foreground">
      {t('page.footer')}
    </p>
  </div>
  );
};

export default HelpPage;
