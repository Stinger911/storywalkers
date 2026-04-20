import {
  createContext,
  createEffect,
  createSignal,
  useContext,
  type JSX,
} from "solid-js";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: () => ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>();
const STORAGE_KEY = "theme";

const isThemeMode = (value: string): value is ThemeMode =>
  value === "light" || value === "dark";

const FORCED_THEME: ThemeMode = "light";

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.kbTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
};

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme] = createSignal<ThemeMode>(FORCED_THEME);

  createEffect(() => {
    applyTheme(FORCED_THEME);
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isThemeMode(stored) && stored !== FORCED_THEME) {
        localStorage.removeItem(STORAGE_KEY);
      }
      localStorage.setItem(STORAGE_KEY, FORCED_THEME);
    }
  });

  const setTheme = (_next: ThemeMode) => undefined;
  const toggleTheme = () => undefined;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
