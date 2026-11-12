import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button } from './ui/button';
import Footer from './Footer';
import LanguageSelector from './LanguageSelector';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { useLocale } from '../hooks/useLocale';
import { localizePath } from '../i18n/localeUtils';
import { buildLoginPath } from '../utils/authReturnUrl';

/**
 * Cabecera mínima para páginas públicas del catálogo (sin Navbar autenticado).
 */
export default function PublicCatalogShell({ children }) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation('catalog');
  const { locale } = useLocale();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const catalogHref = localizePath(locale, '/catalogo');
  const returnUrl = `${location.pathname}${location.search}`;
  const homeHref = locale === 'es' ? '/' : `/${locale}`;
  const headerLogoSrc = `${process.env.PUBLIC_URL || ''}/${
    theme === 'dark' ? 'logo-header.png' : 'logo-header-dark.png'
  }`;

  useEffect(() => {
    document.body.classList.add('public-catalog-shell');
    return () => document.body.classList.remove('public-catalog-shell');
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navLinks = (
    <>
      <Link to={catalogHref} onClick={closeMenu} className="hover:text-foreground transition-colors">
        {t('nav.catalog')}
      </Link>
      {user && (
        <>
          <Link to="/mis-sugerencias-catalogo" onClick={closeMenu} className="hover:text-foreground transition-colors">
            {t('nav.mySuggestions')}
          </Link>
          <Link to="/proponer-alta-catalogo" onClick={closeMenu} className="hover:text-foreground transition-colors">
            {t('nav.propose')}
          </Link>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <Link to={homeHref} className="flex shrink-0 items-center hover:opacity-90" aria-label="Slot Database">
            <img
              key={headerLogoSrc}
              src={headerLogoSrc}
              alt="Slot Database"
              className="h-9 w-auto max-w-[min(46vw,16rem)] object-contain object-left"
            />
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-muted-foreground min-w-0">
            {navLinks}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
            <LanguageSelector size="compact" />
            <div className="hidden md:flex items-center gap-2">
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
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.openMenu')}>
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex w-[min(100vw-1.5rem,280px)] flex-col gap-0 overflow-hidden p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              >
                <SheetHeader className="shrink-0 px-6 pb-2 pt-6 pr-12">
                  <SheetTitle>{t('nav.menu')}</SheetTitle>
                </SheetHeader>
                <nav className="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-4 pb-6 text-sm [-webkit-overflow-scrolling:touch]">
                  <Link
                    to={catalogHref}
                    onClick={closeMenu}
                    className="rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    {t('nav.catalog')}
                  </Link>
                  {user && (
                    <>
                      <Link
                        to="/mis-sugerencias-catalogo"
                        onClick={closeMenu}
                        className="rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        {t('nav.mySuggestions')}
                      </Link>
                      <Link
                        to="/proponer-alta-catalogo"
                        onClick={closeMenu}
                        className="rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        {t('nav.propose')}
                      </Link>
                    </>
                  )}
                  <div className="mt-4 flex flex-col gap-2">
                    {user ? (
                      <Button variant="outline" asChild>
                        <Link to="/dashboard" onClick={closeMenu}>{t('nav.dashboard')}</Link>
                      </Button>
                    ) : (
                      <>
                        <Button variant="outline" asChild>
                          <Link to={buildLoginPath({ returnUrl })} onClick={closeMenu}>{t('nav.login')}</Link>
                        </Button>
                        <Button variant="default" asChild>
                          <Link to={buildLoginPath({ register: true, returnUrl })} onClick={closeMenu}>
                            {t('nav.register')}
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
