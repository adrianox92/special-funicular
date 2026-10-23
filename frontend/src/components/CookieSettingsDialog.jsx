import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("common");
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
          <DialogTitle>{t("cookies.settingsTitle")}</DialogTitle>
          <DialogDescription id="cookie-settings-desc">
            {t("cookies.settingsLead")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="cookie-necessary" className="text-base">
                {t("cookies.necessary")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("cookies.necessaryHint")}
              </p>
            </div>
            <Switch id="cookie-necessary" checked disabled aria-readonly />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="cookie-analytics" className="text-base">
                {t("cookies.analytics")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("cookies.analyticsHint")}
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
                {t("cookies.functional")}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t("cookies.functionalHint")}
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
            {t("actions.cancel")}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t("cookies.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CookieSettingsDialog;
