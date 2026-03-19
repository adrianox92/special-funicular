import React from "react";
import { useCookieConsent } from "../context/CookieConsentContext";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const CookieBanner = () => {
  const { hasDecided, saveConsent, openSettings } = useCookieConsent();

  if (hasDecided) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none"
      role="region"
      aria-label="Aviso de cookies"
    >
      <Card className="mx-auto max-w-4xl shadow-lg pointer-events-auto border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2 text-sm text-muted-foreground md:pr-4">
              <p className="font-medium text-foreground">
                Usamos cookies para mejorar tu experiencia
              </p>
              <p>
                Las cookies necesarias permiten el inicio de sesión y la seguridad.
                Con tu consentimiento también usamos analíticas y preferencias
                (tema). Puedes aceptar todo, rechazar lo opcional o configurar por
                categorías.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => saveConsent({ analytics: false, functional: false })}
              >
                Solo necesarias
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={openSettings}
              >
                Configurar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => saveConsent({ analytics: true, functional: true })}
              >
                Aceptar todo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CookieBanner;
