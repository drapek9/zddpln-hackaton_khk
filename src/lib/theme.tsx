import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Světlý / tmavý režim. Volba se pamatuje jen v tomto prohlížeči.
export type Theme = "light" | "dark";

const KEY = "cesty-khk-theme";

// Uložená volba má přednost, jinak se řídí nastavením systému (prefers-color-scheme).
function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Theme | null>(storedTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme = chosen ?? system;

  // Bez vlastní volby sledovat změnu systémového režimu.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setChosen(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // úložiště není dostupné, režim platí do zavření stránky
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      className={`theme-toggle ${dark ? "is-dark" : ""}`}
      onClick={toggle}
      aria-label={dark ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      title={dark ? "Světlý režim" : "Tmavý režim"}
    >
      <span className="theme-knob">{dark ? "☾" : "☀"}</span>
    </button>
  );
}
