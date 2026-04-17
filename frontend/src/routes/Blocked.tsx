import { useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { getNextOnboardingStep, onboardingPath } from "./onboarding/onboardingState";
import { useTheme } from "../lib/theme";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

type BlockedVariant = "disabled" | "expired";

type BlockedVariantContent = {
  title: string;
  description: string;
  renewalMessage?: string;
};

const SUPPORT_URL =
  import.meta.env.VITE_SUPPORT_URL ?? "https://t.me/storywalkers_support_bot";
const TELEGRAM_URL = import.meta.env.VITE_SUPPORT_TELEGRAM_URL ?? "";
const TELEGRAM_LABEL =
  import.meta.env.VITE_SUPPORT_CONTACT ?? "t.me/storywalkers_support_bot";

function normalizeVariant(raw: string | string[] | undefined): BlockedVariant {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "expired") return "expired";
  return "disabled";
}

export function Blocked() {
  const auth = useAuth();
  const { t } = useI18n();
  const { theme } = useTheme();
  const [params] = useSearchParams();
  const variant = () => normalizeVariant(params.type);
  const onboardingHref = () =>
    auth.me() ? onboardingPath(getNextOnboardingStep(auth.me()!)) : "/onboarding/profile";
  const themeStyles = () =>
    theme() === "dark"
      ? {
          "--background": "214 24% 10%",
          "--foreground": "210 40% 96%",
          "--muted": "214 22% 18%",
          "--muted-foreground": "214 16% 72%",
          "--popover": "214 26% 12%",
          "--popover-foreground": "210 40% 96%",
          "--border": "214 18% 22%",
          "--input": "214 20% 18%",
          "--card": "214 24% 13%",
          "--card-foreground": "210 40% 96%",
          "--primary": "209 52% 66%",
          "--primary-foreground": "214 26% 12%",
          "--secondary": "212 90% 68%",
          "--secondary-foreground": "214 26% 12%",
          "--accent": "214 20% 18%",
          "--accent-foreground": "210 40% 96%",
          "--ring": "209 52% 66%",
          "--radius": "0.5rem",
          "--radius-lg": "1.5rem",
          "--radius-md": "0.875rem",
          "--shadow-card": "0 20px 40px rgba(0, 0, 0, 0.28)",
          "--shadow-rail": "0 12px 28px rgba(0, 0, 0, 0.24)",
        }
      : {
          "--background": "220 44% 98%",
          "--foreground": "210 35% 11%",
          "--muted": "214 48% 95%",
          "--muted-foreground": "217 9% 33%",
          "--popover": "0 0% 100%",
          "--popover-foreground": "210 35% 11%",
          "--border": "217 27% 87%",
          "--input": "215 45% 91%",
          "--card": "0 0% 100%",
          "--card-foreground": "210 35% 11%",
          "--primary": "209 50% 37%",
          "--primary-foreground": "0 0% 100%",
          "--secondary": "212 100% 37%",
          "--secondary-foreground": "0 0% 100%",
          "--accent": "214 48% 95%",
          "--accent-foreground": "210 35% 11%",
          "--ring": "209 50% 37%",
          "--radius": "0.5rem",
          "--radius-lg": "1.5rem",
          "--radius-md": "0.875rem",
          "--shadow-card": "0 20px 40px rgba(18, 29, 38, 0.05)",
          "--shadow-rail": "0 12px 28px rgba(18, 29, 38, 0.05)",
        };
  const content = (): BlockedVariantContent =>
    variant() === "expired"
      ? {
          title: t("blocked.titleExpired"),
          description: t("blocked.descriptionExpired"),
          renewalMessage: t("blocked.renewalMessage"),
        }
      : {
          title: t("blocked.titleDisabled"),
          description: t("blocked.descriptionDisabled"),
        };

  return (
    <div
      class="student-shell min-h-screen bg-background text-foreground [font-family:Manrope,'Space_Grotesk',system-ui,sans-serif]"
      style={themeStyles()}
    >
      <div class="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div class="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <section class="space-y-6 rounded-[calc(var(--radius-lg)+8px)] border border-border/70 bg-white px-6 py-7 shadow-card sm:px-8 sm:py-8">
            <div class="space-y-3">
              <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">
                StoryWalkers Club
              </div>
              <h1 class="text-3xl font-extrabold tracking-[-0.04em] text-foreground sm:text-4xl">
                {content().title}
              </h1>
              <p class="max-w-2xl text-base leading-7 text-muted-foreground">
                {content().description}
              </p>
            </div>

            <Show when={content().renewalMessage}>
              <div class="rounded-[var(--radius-md)] border border-border/70 bg-[rgba(237,244,255,0.7)] p-4 text-sm leading-6 text-muted-foreground">
                {content().renewalMessage}
              </div>
            </Show>

            <div class="flex flex-wrap gap-3">
              <a
                href={onboardingHref()}
                class="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[linear-gradient(135deg,#2f5f8d_0%,#4a78a7_100%)] px-6 text-sm font-bold text-white shadow-card"
              >
                {t("blocked.continueOnboarding")}
              </a>
              <Button
                variant="outline"
                class="h-12 rounded-[var(--radius-md)] px-6"
                onClick={() => {
                  void auth.logout();
                  window.location.href = "/";
                }}
              >
                {t("blocked.logout")}
              </Button>
            </div>
          </section>

          <Card class="overflow-hidden rounded-[calc(var(--radius-lg)+8px)] border-0 bg-white shadow-card">
            <CardHeader class="border-b border-border/60 bg-[linear-gradient(180deg,rgba(237,244,255,0.86)_0%,rgba(255,255,255,0.94)_100%)] px-6 py-6">
              <CardTitle class="text-2xl font-bold tracking-[-0.03em]">
                {t("common.contactSupport")}
              </CardTitle>
              <CardDescription class="mt-2 max-w-sm text-sm leading-6">
                {t("blocked.descriptionDisabled")}
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4 px-6 py-6">
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-between rounded-[var(--radius-md)] border border-border/70 bg-[rgba(237,244,255,0.62)] px-4 py-3 text-sm font-semibold text-primary transition-colors duration-300 hover:bg-[rgba(223,233,247,0.9)]"
              >
                <span>{t("common.contactSupport")}</span>
                <span class="material-symbols-outlined text-[18px]">open_in_new</span>
              </a>
              <Show when={TELEGRAM_URL}>
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center justify-between rounded-[var(--radius-md)] border border-border/70 bg-card px-4 py-3 text-sm text-foreground transition-colors duration-300 hover:border-primary/30 hover:text-primary"
                >
                  <span class="truncate">{TELEGRAM_LABEL}</span>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              </Show>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
