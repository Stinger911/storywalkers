import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
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

const getSystemTheme = (): ThemeMode => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.kbTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
};

export function ThemeProvider(props: { children: JSX.Element }) {
  const [theme, setThemeSignal] = createSignal<ThemeMode>(getSystemTheme());
  const [hasStoredPreference, setHasStoredPreference] = createSignal(false);

  onMount(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        if (!hasStoredPreference()) {
          setThemeSignal(mediaQuery.matches ? "dark" : "light");
        }
      };

      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleChange);
        onCleanup(() => mediaQuery.removeEventListener("change", handleChange));
      } else {
        mediaQuery.addListener(handleChange);
        onCleanup(() => mediaQuery.removeListener(handleChange));
      }
    }

    if (typeof localStorage === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isThemeMode(stored)) {
      setHasStoredPreference(true);
      setThemeSignal(stored);
      return;
    }

    setHasStoredPreference(false);
    setThemeSignal(getSystemTheme());
  });

  createEffect(() => {
    const nextTheme = theme();
    applyTheme(nextTheme);
    if (typeof localStorage === "undefined") return;
    if (hasStoredPreference()) {
      localStorage.setItem(STORAGE_KEY, nextTheme);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
  });

  const setTheme = (next: ThemeMode) => {
    setHasStoredPreference(true);
    setThemeSignal(next);
  };
  const toggleTheme = () =>
    setTheme(theme() === "dark" ? "light" : "dark");

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
