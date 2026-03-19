import React, { createContext, useContext, useEffect, useState } from "react";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  useCookieConsent,
} from "./CookieConsentContext";

const ThemeContext = createContext({
  theme: "light",
  setTheme: () => null,
  toggleTheme: () => null,
});

function readSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Lee tema guardado solo si el consentimiento funcional ya está aceptado (evita flash). */
function readInitialThemeFromStorage() {
  if (typeof window === "undefined") return "light";
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return readSystemTheme();
    const p = JSON.parse(raw);
    if (p?.decided && p?.functional) {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") return stored;
    }
  } catch {
    /* ignore */
  }
  return readSystemTheme();
}

export function ThemeProvider({ children }) {
  const { consent, hasDecided } = useCookieConsent();

  const [theme, setThemeState] = useState(readInitialThemeFromStorage);

  useEffect(() => {
    if (!hasDecided || consent.functional) return;
    try {
      localStorage.removeItem("theme");
    } catch {
      /* ignore */
    }
    setThemeState(readSystemTheme());
  }, [hasDecided, consent.functional]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    if (!hasDecided) return;
    if (consent.functional) {
      try {
        localStorage.setItem("theme", theme);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.removeItem("theme");
      } catch {
        /* ignore */
      }
    }
  }, [theme, hasDecided, consent.functional]);

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
