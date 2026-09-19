import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import Footer from './Footer';
import LanguageSelector from './LanguageSelector';
import { useLocale } from '../hooks/useLocale';
import { localizePath } from '../i18n/localeUtils';
import { buildLoginPath } from '../utils/authReturnUrl';

/**
 * Cabecera mínima para páginas públicas del catálogo (sin Navbar autenticado).
 */
export default function PublicCatalogShell({ children }) {
  const { user } = useAuth();
  const { t } = useTranslation('catalog');
  const { locale } = useLocale();
  const location = useLocation();
  const catalogHref = localizePath(locale, '/catalogo');
  const returnUrl = `${location.pathname}${location.search}`;
  const homeHref = locale === 'es' ? '/' : `/${locale}`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link to={homeHref} className="font-semibold text-foreground truncate hover:opacity-90">
              Slot Database
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <Link to={catalogHref} className="hover:text-foreground transition-colors">
                {t('nav.catalog')}
              </Link>
              {user && (
                <>
                  <Link to="/mis-sugerencias-catalogo" className="hover:text-foreground transition-colors">
                    {t('nav.mySuggestions')}
                  </Link>
                  <Link to="/proponer-alta-catalogo" className="hover:text-foreground transition-colors">
                    {t('nav.propose')}
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSelector size="compact" />
            {user ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">{t('nav.dashboard')}</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={buildLoginPath({ returnUrl })}>{t('nav.login')}</Link>
                </Button>
                <Button variant="default" size="sm" asChild>
                  <Link to={buildLoginPath({ register: true, returnUrl })}>{t('nav.register')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
