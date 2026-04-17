import { createSignal, Show } from "solid-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useI18n } from "../lib/i18n";
import { useTheme, type ThemeMode } from "../lib/theme";
import { cn } from "../lib/utils";

type SettingsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const localeOptions = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
] as const;

export function SettingsPanel(props: SettingsPanelProps) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [pendingTheme, setPendingTheme] = createSignal<ThemeMode>(theme());

  const applyTheme = (next: ThemeMode) => {
    setPendingTheme(next);
    setTheme(next);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-md rounded-[calc(var(--radius-lg)+6px)] border border-border/70 bg-background p-6 shadow-card">
        <DialogHeader class="space-y-2 text-left">
          <DialogTitle class="text-2xl font-bold tracking-[-0.03em]">
            {t("common.settings")}
          </DialogTitle>
          <DialogDescription class="text-sm leading-6 text-muted-foreground">
            {t("common.language")} and {t("common.appearance").toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-6">
          <section class="space-y-3">
            <div>
              <div class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                {t("common.language")}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              {localeOptions.map((option) => (
                <Button
                  variant={locale() === option.value ? "default" : "outline"}
                  class={cn(
                    "h-11 rounded-[var(--radius-md)]",
                    locale() === option.value
                      ? "bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] text-white"
                      : "bg-background",
                  )}
                  onClick={() => setLocale(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </section>

          <section class="space-y-3">
            <div class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {t("common.theme")}
            </div>
            <div class="grid grid-cols-2 gap-3">
              {([
                { value: "light", label: t("common.themeLight"), icon: "light_mode" },
                { value: "dark", label: t("common.themeDark"), icon: "dark_mode" },
              ] as const).map((option) => (
                <button
                  type="button"
                  class={cn(
                    "flex h-24 flex-col items-start justify-between rounded-[calc(var(--radius-md)+2px)] border px-4 py-4 text-left transition-all duration-300",
                    pendingTheme() === option.value
                      ? "border-primary/20 bg-[rgba(237,244,255,0.9)] shadow-rail"
                      : "border-border/70 bg-background hover:border-primary/20 hover:bg-[rgba(237,244,255,0.7)]",
                  )}
                  onClick={() => applyTheme(option.value)}
                >
                  <span class="material-symbols-outlined text-2xl text-primary">
                    {option.icon}
                  </span>
                  <div>
                    <div class="text-sm font-bold text-foreground">
                      {option.label}
                    </div>
                    <Show when={pendingTheme() === option.value}>
                      <div class="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                        {t("common.active")}
                      </div>
                    </Show>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
