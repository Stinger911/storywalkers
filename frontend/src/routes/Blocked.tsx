import { useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
import { Button } from "../components/ui/button";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
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
  const [params] = useSearchParams();
  const variant = () => normalizeVariant(params.type);
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
    <div class="min-h-screen grid place-items-center bg-muted/20 p-6">
      <Card class="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{content().title}</CardTitle>
          <CardDescription>{content().description}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <Show when={content().renewalMessage}>
            <p class="text-sm">{content().renewalMessage}</p>
          </Show>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("common.contactSupport")}
          </a>
          <Show when={TELEGRAM_URL}>
            <div>
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex text-sm text-primary underline-offset-4 hover:underline"
              >
                {TELEGRAM_LABEL}
              </a>
            </div>
          </Show>
          <div class="flex items-center gap-2">
            <a
              href="/onboarding/goal"
              class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
            >
              {t("blocked.continueOnboarding")}
            </a>
            <Button
              variant="outline"
              class="ml-auto"
              onClick={() => {
                void auth.logout();
                window.location.href = "/";
              }}
            >
              {t("blocked.logout")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
