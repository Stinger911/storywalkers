import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
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

const getInitialTheme = (): ThemeMode => {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isThemeMode(stored)) return stored;
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
};

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.kbTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
};

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeSignal] = createSignal<ThemeMode>(getInitialTheme());

  createEffect(() => {
    const current = theme();
    applyTheme(current);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, current);
    }
  });

  createEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && isThemeMode(stored)) return;
      setThemeSignal(media.matches ? "dark" : "light");
    };
    media.addEventListener("change", onChange);
    onCleanup(() => media.removeEventListener("change", onChange));
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
