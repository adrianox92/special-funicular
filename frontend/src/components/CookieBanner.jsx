import React from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCookieConsent } from "../context/CookieConsentContext";
import { stripLocalePrefix } from "../i18n/localeUtils";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

/** Pantallas públicas de directo / OBS: sin banner de cookies. */
function isBroadcastRoute(pathname) {
  const path = stripLocalePrefix(pathname);
  return (
    path.startsWith("/competitions/presentation/") ||
    path.startsWith("/competitions/status/")
  );
}

const CookieBanner = () => {
  const location = useLocation();
  const { t } = useTranslation("common");
  const { hasDecided, saveConsent, openSettings } = useCookieConsent();

  if (hasDecided || isBroadcastRoute(location.pathname)) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none"
      role="region"
      aria-label={t("cookies.bannerAria")}
    >
      <Card className="mx-auto max-w-4xl shadow-lg pointer-events-auto border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-sm text-muted-foreground md:pr-4">
              <p className="font-medium text-foreground">
                {t("cookies.title")}
              </p>
              <p>{t("cookies.body")}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveConsent({ analytics: false, functional: false })}
              >
                {t("cookies.necessaryOnly")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openSettings}
              >
                {t("cookies.configure")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveConsent({ analytics: true, functional: true })}
              >
                {t("cookies.acceptAll")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CookieBanner;
