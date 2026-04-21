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
    <div class="student-shell min-h-screen bg-background text-foreground [font-family:Manrope,'Space_Grotesk',system-ui,sans-serif]">
      <div class="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div class="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <section
            classList={{
              "bg-white": theme() !== "dark",
            }}
            class="space-y-6 rounded-[calc(var(--radius-lg)+8px)] border border-border/70 px-6 py-7 shadow-card sm:px-8 sm:py-8"
          >
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
              <div
                class="rounded-[var(--radius-md)] border border-border/70 p-4 text-sm leading-6 text-muted-foreground"
                classList={{
                  "bg-[rgba(237,244,255,0.7)]": theme() !== "dark",
                  "bg-[rgba(18,29,38,0.88)]": theme() === "dark",
                }}
              >
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

          <Card
            class={theme() === "dark" ? "overflow-hidden rounded-[calc(var(--radius-lg)+8px)] border border-border/70 bg-card shadow-card" : "overflow-hidden rounded-[calc(var(--radius-lg)+8px)] border-0 bg-white shadow-card"}
          >
            <CardHeader
              class={theme() === "dark"
                ? "border-b border-border/70 bg-[linear-gradient(180deg,rgba(18,29,38,0.96)_0%,rgba(22,33,42,0.92)_100%)] px-6 py-6"
                : "border-b border-border/60 bg-[linear-gradient(180deg,rgba(237,244,255,0.86)_0%,rgba(255,255,255,0.94)_100%)] px-6 py-6"}
            >
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
                class={theme() === "dark"
                  ? "flex items-center justify-between rounded-[var(--radius-md)] border border-border/70 bg-[rgba(18,29,38,0.88)] px-4 py-3 text-sm font-semibold text-primary transition-colors duration-300 hover:border-primary/40 hover:bg-[rgba(22,33,42,0.96)]"
                  : "flex items-center justify-between rounded-[var(--radius-md)] border border-border/70 bg-[rgba(237,244,255,0.62)] px-4 py-3 text-sm font-semibold text-primary transition-colors duration-300 hover:bg-[rgba(223,233,247,0.9)]"}
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
