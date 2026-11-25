import { useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { getNextOnboardingStep, onboardingPath } from "./onboarding/onboardingState";
import { StartButton, StartPage } from "./start/StartUi";

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
  const [params] = useSearchParams();
  const variant = () => normalizeVariant(params.type);
  const onboardingHref = () =>
    auth.me() ? onboardingPath(getNextOnboardingStep(auth.me()!)) : "/start";
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
    <StartPage>
      <p class="st-lead text-[var(--st-muted)]">StoryWalkers Club</p>
      <h1 class="st-heading">{content().title}</h1>
      <p class="st-lead">{content().description}</p>

      <Show when={content().renewalMessage}>
        <div class="st-notice text-center text-xs leading-5">{content().renewalMessage}</div>
      </Show>

      <div class="flex flex-wrap items-center justify-center gap-4">
        <StartButton
          variant="secondary"
          onClick={() => {
            void auth.logout();
            window.location.href = "/";
          }}
        >
          {t("blocked.logout")}
        </StartButton>
        <a href={onboardingHref()} class="st-btn st-btn-primary">
          {t("blocked.continueOnboarding")}
        </a>
      </div>

      <section class="st-card st-card-fill space-y-3 px-6 py-5 text-center">
        <h2 class="st-display text-base">{t("common.contactSupport")}</h2>
        <p class="text-xs leading-5">{t("blocked.descriptionDisabled")}</p>
        <div class="flex flex-wrap justify-center gap-3">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="st-btn st-btn-secondary"
          >
            {t("common.contactSupport")}
          </a>
          <Show when={TELEGRAM_URL}>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="st-btn st-btn-secondary normal-case"
            >
              {TELEGRAM_LABEL}
            </a>
          </Show>
        </div>
      </section>
    </StartPage>
  );
}
