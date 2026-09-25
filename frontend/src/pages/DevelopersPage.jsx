import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, ExternalLink, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import Footer from '../components/Footer';
import LanguageSelector from '../components/LanguageSelector';
import { DEVELOPERS_CHANGELOG } from '../content/developersChangelog';
import { applyDevelopersPageSeo } from '../utils/developersSeo';
import { buildLoginPath } from '../utils/authReturnUrl';
import {
  CONTACT_PATH,
  PARTNER_OPENAPI_LOCAL_URL,
  PARTNER_OPENAPI_PRODUCTION_URL,
  PARTNER_SWAGGER_LOCAL_URL,
  PARTNER_SWAGGER_PRODUCTION_URL,
  PROFILE_PATH,
} from '../utils/partnerApiUrls';

const PERSONAL_STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
const CLUB_STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
const COMPAT_RULES = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'];
const ATTRIBUTION_ROWS = [
  'memberWithVehicle',
  'memberWithoutVehicle',
  'guestWithVehicle',
  'external',
];

const DevelopersPage = () => {
  const { user } = useAuth();
  const { t } = useTranslation('developers');
  const { locale } = useLocale();
  const location = useLocation();
  const returnUrl = `${location.pathname}${location.search}`;

  useEffect(() => {
    applyDevelopersPageSeo(locale);
  }, [locale]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-muted/50 to-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="text-sm font-bold text-foreground">
            Slot Database
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector size="compact" />
            {user ? (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link to={PROFILE_PATH}>{t('nav.profile')}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard">{t('nav.dashboard')}</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link to={buildLoginPath({ returnUrl })}>{t('nav.login')}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 pb-16 sm:px-6">
        <article className="space-y-10">
          <header className="space-y-4">
            <Badge variant="secondary">{t('hero.kicker')}</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('hero.title')}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">{t('hero.lead')}</p>
            <p className="text-base leading-relaxed text-muted-foreground">{t('hero.lead2')}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button asChild>
                <a
                  href={PARTNER_SWAGGER_PRODUCTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <BookOpen className="size-4" />
                  {t('cta.swagger')}
                  <ExternalLink className="size-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={PARTNER_OPENAPI_PRODUCTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('cta.openapi')}
                  <ExternalLink className="size-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to={user ? PROFILE_PATH : buildLoginPath({ returnUrl: PROFILE_PATH })}>
                  <KeyRound className="size-4" />
                  {t('cta.getKey')}
                </Link>
              </Button>
            </div>
          </header>

          <Card>
            <CardHeader>
              <CardTitle>{t('auth.title')}</CardTitle>
              <CardDescription>{t('auth.lead')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>{t('auth.personal')}</p>
              <p>{t('auth.club')}</p>
              <Button asChild variant="link" className="h-auto px-0">
                <Link to={user ? PROFILE_PATH : buildLoginPath({ returnUrl: PROFILE_PATH })}>
                  {t('auth.profileCta')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <section className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('personal.title')}</CardTitle>
                <CardDescription>{t('personal.lead')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {PERSONAL_STEPS.map((step) => (
                    <li key={step}>{t(`personal.${step}`)}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('club.title')}</CardTitle>
                <CardDescription>{t('club.lead')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {CLUB_STEPS.map((step) => (
                    <li key={step}>{t(`club.${step}`)}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t('attribution.title')}</CardTitle>
              <CardDescription>{t('attribution.lead')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('attribution.colType')}</TableHead>
                    <TableHead>{t('attribution.colInDb')}</TableHead>
                    <TableHead>{t('attribution.colHistory')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ATTRIBUTION_ROWS.map((row) => (
                    <TableRow key={row}>
                      <TableCell className="align-top font-medium">
                        {t(`attribution.${row}Type`)}
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground">
                        {t(`attribution.${row}InDb`)}
                      </TableCell>
                      <TableCell className="align-top">{t(`attribution.${row}History`)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('docs.title')}</CardTitle>
              <CardDescription>{t('docs.lead')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <a
                  href={PARTNER_SWAGGER_PRODUCTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('docs.swaggerLabel')}
                </a>
                <span className="text-muted-foreground"> — {PARTNER_SWAGGER_PRODUCTION_URL}</span>
              </p>
              <p>
                <a
                  href={PARTNER_OPENAPI_PRODUCTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('docs.openapiLabel')}
                </a>
                <span className="text-muted-foreground"> — {PARTNER_OPENAPI_PRODUCTION_URL}</span>
              </p>
              <p className="text-muted-foreground">
                {t('docs.localHint', {
                  swagger: PARTNER_SWAGGER_LOCAL_URL,
                  openapi: PARTNER_OPENAPI_LOCAL_URL,
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('compat.title')}</CardTitle>
              <CardDescription>{t('compat.lead')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
                {COMPAT_RULES.map((rule) => (
                  <li key={rule}>{t(`compat.${rule}`)}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('changelog.title')}</CardTitle>
              <CardDescription>{t('changelog.lead')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {DEVELOPERS_CHANGELOG.map((entry) => (
                <section key={entry.version} className="space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-base font-semibold text-foreground">
                      v{entry.version}
                    </h2>
                    <time className="text-xs text-muted-foreground" dateTime={entry.date}>
                      {entry.date}
                    </time>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t(`changelog.${entry.titleKey}`)}
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {entry.noteKeys.map((key) => (
                      <li key={key}>{t(`changelog.${key}`)}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('support.title')}</CardTitle>
              <CardDescription>{t('support.lead')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to={CONTACT_PATH}>
                  <Mail className="size-4" />
                  {t('support.cta')}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default DevelopersPage;
