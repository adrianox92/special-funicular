import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCookieConsent } from '../context/CookieConsentContext';
import LanguageSelector from './LanguageSelector';

const linkClass =
  'text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { openSettings } = useCookieConsent();
  const { t } = useTranslation('common');

  return (
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2">
          <p className="text-center text-sm text-muted-foreground">
            {t('footer.copyright', { year: currentYear })}
          </p>
          <LanguageSelector size="compact" />
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm"
            aria-label={t('footer.legalNav')}
          >
            <Link to="/privacidad" className={linkClass}>
              {t('footer.privacy')}
            </Link>
            <Link to="/terminos" className={linkClass}>
              {t('footer.terms')}
            </Link>
            <Link to="/contacto" className={linkClass}>
              {t('footer.contact')}
            </Link>
            <Link to="/catalogo" className={linkClass}>
              {t('footer.catalog')}
            </Link>
          </nav>
          <button type="button" onClick={openSettings} className={linkClass}>
            {t('footer.cookies')}
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
