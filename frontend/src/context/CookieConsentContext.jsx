import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "cookie_consent";

const defaultConsent = {
  necessary: true,
  analytics: false,
  functional: false,
};

function loadStored() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

const CookieConsentContext = createContext(null);

export function CookieConsentProvider({ children }) {
  const [state, setState] = useState(() => {
    const stored = loadStored();
    if (stored?.decided) {
      return {
        hasDecided: true,
        consent: {
          necessary: true,
          analytics: Boolean(stored.analytics),
          functional: Boolean(stored.functional),
        },
      };
    }
    return {
      hasDecided: false,
      consent: { ...defaultConsent },
    };
  });

  const [settingsOpen, setSettingsOpen] = useState(false);

  const saveConsent = useCallback((prefs) => {
    const next = {
      decided: true,
      necessary: true,
      analytics: Boolean(prefs.analytics),
      functional: Boolean(prefs.functional),
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private mode */
    }
    setState({
      hasDecided: true,
      consent: {
        necessary: true,
        analytics: next.analytics,
        functional: next.functional,
      },
    });
    setSettingsOpen(false);
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);

  const value = useMemo(
    () => ({
      consent: state.consent,
      hasDecided: state.hasDecided,
      saveConsent,
      settingsOpen,
      setSettingsOpen,
      openSettings,
    }),
    [
      state.consent,
      state.hasDecided,
      saveConsent,
      settingsOpen,
      openSettings,
    ]
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }
  return ctx;
}

export { STORAGE_KEY as COOKIE_CONSENT_STORAGE_KEY };
