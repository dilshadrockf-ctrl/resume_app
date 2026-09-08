"use client";
import * as React from "react";

type Theme = "light" | "dark" | "system";
export type { Theme };

const ThemeCtx = React.createContext<{ theme: Theme; setTheme: (t: Theme) => void; resolved: "light" | "dark" }>({
  theme: "system",
  setTheme: () => {},
  resolved: "light",
});

export function ThemeProvider({ children, initial = "system" }: { children: React.ReactNode; initial?: Theme }) {
  const [theme, setThemeState] = React.useState<Theme>(initial);
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const apply = (t: Theme) => {
      const root = document.documentElement;
      const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
      setResolved(isDark ? "dark" : "light");
    };
    apply(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => apply("system");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [theme]);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("rf-theme", t);
    } catch {
      /* private mode */
    }
    void fetch("/api/theme", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: t }) }).catch(() => undefined);
  }, []);

  return <ThemeCtx value={{ theme, setTheme, resolved }}>{children}</ThemeCtx>;
}

export function useTheme() {
  return React.useContext(ThemeCtx);
}

