import {
  createContext,
  createEffect,
  createSignal,
  onMount,
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

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.kbTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeSignal] = createSignal<ThemeMode>("light");

  onMount(() => {
    if (typeof localStorage === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isThemeMode(stored)) {
      setThemeSignal(stored);
      return;
    }

    applyTheme(theme());
    localStorage.setItem(STORAGE_KEY, theme());
  });

  createEffect(() => {
    const nextTheme = theme();
    applyTheme(nextTheme);
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, nextTheme);
  });

  const setTheme = (next: ThemeMode) => setThemeSignal(next);
  const toggleTheme = () =>
    setThemeSignal((current) => (current === "dark" ? "light" : "dark"));

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
