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
import HelpAssistant from '../components/HelpAssistant';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import { primerosPasos, getHelpTableOfContents, visibleHelpSections } from '../content/helpGuide';

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
  const isAdmin = isLicenseAdminUser(user);
  const helpTableOfContents = getHelpTableOfContents(isAdmin);
  const sections = visibleHelpSections(isAdmin);

  return (
  <div className="space-y-8 max-w-3xl">
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-primary">
        <BookOpen className="size-7" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Onboarding y ayuda</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Guía para empezar con Slot Collection Pro y referencia de cada sección: qué hace, en qué orden conviene
        configurarla y buenas prácticas. También puedes usar el buscador de abajo con preguntas en lenguaje natural.
      </p>
    </div>

    <HelpAssistant />

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Índice</CardTitle>
        <CardDescription>Saltar a una sección o abrirla en la app.</CardDescription>
      </CardHeader>
      <CardContent>
        <nav aria-label="Índice de ayuda" className="flex flex-wrap gap-2">
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
            <Badge variant="outline">Recomendado</Badge>
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
                  <p className="font-medium text-foreground mb-2">Pasos</p>
                  <StepsList items={sec.steps} />
                </div>
              )}
              {sec.tips?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">Qué tener en cuenta</p>
                  <BulletList items={sec.tips} />
                </div>
              )}
              {sec.gotchas?.length > 0 && (
                <div>
                  <p className="font-medium text-foreground mb-2">Errores frecuentes</p>
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
      ¿Algo no cuadra con lo que ves en pantalla? Comprueba que estás en la última versión de la app y vuelve a cargar la
      página.
    </p>
  </div>
  );
};

export default HelpPage;
