import React, { useEffect, useState } from "react";
import { useCookieConsent } from "../context/CookieConsentContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

const CookieSettingsDialog = () => {
  const { consent, settingsOpen, setSettingsOpen, saveConsent } =
    useCookieConsent();

  const [analytics, setAnalytics] = useState(consent.analytics);
  const [functional, setFunctional] = useState(consent.functional);

  useEffect(() => {
    if (settingsOpen) {
      setAnalytics(consent.analytics);
      setFunctional(consent.functional);
    }
  }, [settingsOpen, consent.analytics, consent.functional]);

  const handleOpenChange = (open) => setSettingsOpen(open);

  const handleSave = () => {
    saveConsent({ analytics, functional });
  };

  return (
    <Dialog open={settingsOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="cookie-settings-desc">
        <DialogHeader>
          <DialogTitle>Preferencias de cookies</DialogTitle>
          <DialogDescription id="cookie-settings-desc">
            Elige qué cookies permites. Las necesarias son imprescindibles para el
            funcionamiento seguro del sitio (sesión, autenticación).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="cookie-necessary" className="text-base">
                Necesarias
              </Label>
              <p className="text-sm text-muted-foreground">
                Sesión, seguridad y acceso a tu cuenta.
              </p>
            </div>
            <Switch id="cookie-necessary" checked disabled aria-readonly />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="cookie-analytics" className="text-base">
                Analíticas
              </Label>
              <p className="text-sm text-muted-foreground">
                Uso agregado del sitio (Vercel Analytics y Speed Insights).
              </p>
            </div>
            <Switch
              id="cookie-analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="cookie-functional" className="text-base">
                Funcionales
              </Label>
              <p className="text-sm text-muted-foreground">
                Recordar preferencias como el tema claro/oscuro.
              </p>
            </div>
            <Switch
              id="cookie-functional"
              checked={functional}
              onCheckedChange={setFunctional}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar preferencias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CookieSettingsDialog;
