import { useSearchParams } from "@solidjs/router";
import { Show } from "solid-js";
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
  import.meta.env.VITE_SUPPORT_URL ?? "mailto:support@storywalkers.app";
const SUPPORT_LABEL = import.meta.env.VITE_SUPPORT_LABEL ?? "Contact support";
const TELEGRAM_URL = import.meta.env.VITE_SUPPORT_TELEGRAM_URL ?? "";
const TELEGRAM_LABEL = import.meta.env.VITE_SUPPORT_CONTACT ?? "Telegram support";

const VARIANTS: Record<BlockedVariant, BlockedVariantContent> = {
  disabled: {
    title: "Account disabled",
    description:
      "Your account is currently disabled. Access to protected sections is restricted.",
  },
  expired: {
    title: "Access expired",
    description:
      "Your access period has ended. Some sections are unavailable until renewal.",
    renewalMessage:
      "To continue learning, contact support and request renewal.",
  },
};

function normalizeVariant(raw: string | string[] | undefined): BlockedVariant {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "expired") return "expired";
  return "disabled";
}

export function Blocked() {
  const [params] = useSearchParams();
  const variant = () => normalizeVariant(params.type);
  const content = () => VARIANTS[variant()];

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
            {SUPPORT_LABEL}
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
        </CardContent>
      </Card>
    </div>
  );
}
