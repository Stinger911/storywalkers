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
  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: "light", label: t("common.themeLight") },
    { value: "dark", label: t("common.themeDark") },
  ];

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent class="max-w-md rounded-[calc(var(--radius-lg)+6px)] border border-border/70 bg-background p-6 shadow-card">
        <DialogHeader class="space-y-2 text-left">
          <DialogTitle class="text-2xl font-bold tracking-[-0.03em]">
            {t("common.settings")}
          </DialogTitle>
          <DialogDescription class="text-sm leading-6 text-muted-foreground">
            {t("common.language")}.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-6">
          <section class="space-y-3">
            <div>
              <div class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                {t("common.appearance")}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              {themeOptions.map((option) => (
                <Button
                  variant={theme() === option.value ? "default" : "outline"}
                  class={cn(
                    "h-11 rounded-[var(--radius-md)]",
                    theme() === option.value
                      ? "bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] text-white dark:bg-[linear-gradient(135deg,#5a8bbf_0%,#3b82f6_100%)]"
                      : "bg-background",
                  )}
                  onClick={() => setTheme(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </section>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
