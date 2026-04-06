import React from 'react';
import { Link } from 'react-router-dom';
import { useCookieConsent } from '../context/CookieConsentContext';

const linkClass =
  'text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { openSettings } = useCookieConsent();

  return (
    <footer className="border-t bg-muted/50 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2">
          <p className="text-center text-sm text-muted-foreground">
            © {currentYear} Adrian Palomera Sanz. Todos los derechos reservados.
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm"
            aria-label="Legal"
          >
            <Link to="/privacidad" className={linkClass}>
              Política de privacidad
            </Link>
            <Link to="/terminos" className={linkClass}>
              Términos de servicio
            </Link>
            <Link to="/contacto" className={linkClass}>
              Contacto
            </Link>
          </nav>
          <button type="button" onClick={openSettings} className={linkClass}>
            Gestionar cookies
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
