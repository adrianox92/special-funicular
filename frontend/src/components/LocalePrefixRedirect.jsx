import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import i18n from '../i18n';
import { detectLocaleFromPath, stripLocalePrefix } from '../i18n/localeUtils';

/**
 * Rutas /en/* o /de/* sin componente propio (p. ej. /en/profile) → misma ruta sin prefijo + idioma i18n.
 * Las rutas explícitas (/en, /en/catalog, …) tienen prioridad y no pasan por aquí.
 */
export default function LocalePrefixRedirect() {
  const location = useLocation();
  const locale = detectLocaleFromPath(location.pathname);
  const stripped = stripLocalePrefix(location.pathname);

  useEffect(() => {
    if (locale && locale !== 'es') {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return (
    <Navigate
      to={`${stripped}${location.search}${location.hash}`}
      replace
    />
  );
}
