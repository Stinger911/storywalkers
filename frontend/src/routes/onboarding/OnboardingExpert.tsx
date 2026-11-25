import { A, Navigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";

import { Loading } from "../../components/Loading";
import { useAuth } from "../../lib/auth";
import {
  isPayableInvoice,
  listMyPayments,
  type MyPayment,
} from "../../lib/checkoutApi";
import { formatCents } from "../../lib/coursesApi";
import { useI18n } from "../../lib/i18n";
import { StartLayout } from "../start/StartLayout";
import { draftFromYoutubeOnboarding } from "../start/startDraft";

const BOOSTY_SUBSCRIPTION_URL =
  "https://boosty.to/taveren_ru/purchase/3755394?ssource=DIRECT&share=subscription_link";

const SUPPORT_TELEGRAM_URL =
  import.meta.env.VITE_SUPPORT_TELEGRAM_URL ??
  "https://t.me/storywalkers_support_bot";

/**
 * Students who already had a channel land here after registration: the path
 * itself is built by an expert, so the only thing to do now is to join the
 * community. Lessons are invoiced by the admin after the consultation.
 */
export function OnboardingExpert() {
  const auth = useAuth();
  const { t } = useI18n();

  const [payments] = createResource(async () => {
    try {
      return await listMyPayments();
    } catch {
      return { items: [] as MyPayment[], redirectUrl: BOOSTY_SUBSCRIPTION_URL };
    }
  });
  const invoices = () => (payments()?.items ?? []).filter(isPayableInvoice);

  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      <Show
        when={auth.me()?.role === "student"}
        fallback={
          <Navigate href={auth.me()?.role === "staff" ? "/admin" : "/login"} />
        }
      >
        {/* Step 4 of the redesigned funnel: the stepper names it "Expert". */}
        <StartLayout
          step="plan"
          draft={draftFromYoutubeOnboarding(auth.me()?.youtubeOnboarding)}
          title={t("start.expert.title")}
          subtitle={t("start.expert.body")}
        >
          <section class="st-card st-card-fill space-y-4 px-8 py-6 text-center">
            <h2 class="st-display text-lg">{t("start.expert.subscriptionTitle")}</h2>
            <p class="text-xs leading-6">{t("start.expert.subscriptionBody")}</p>
            <a
              class="st-btn st-btn-secondary"
              href={BOOSTY_SUBSCRIPTION_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("start.expert.subscriptionCta")}
            </a>
          </section>

          <section class="space-y-4 rounded-md border border-[var(--st-line)] bg-white p-6">
            <h2 class="st-display text-sm uppercase tracking-[0.12em]">
              {t("start.expert.invoiceTitle")}
            </h2>
            <Show
              when={invoices().length > 0}
              fallback={
                <p class="text-sm text-[var(--st-muted)]">
                  {t("start.expert.invoiceEmpty")}
                </p>
              }
            >
              <div class="space-y-3">
                <For each={invoices()}>
                  {(invoice) => (
                    <div class="space-y-2 rounded-md border border-[var(--st-line)] bg-[var(--st-surface)] p-5 text-sm">
                      <div class="st-display text-lg text-[var(--st-red)]">
                        {formatCents(invoice.amount, invoice.currency)}
                      </div>
                      <div>
                        <span class="text-[var(--st-muted)]">
                          {t("start.expert.invoiceLessonsLabel")}:{" "}
                        </span>
                        <span class="font-bold">{invoice.selectedLessons.length}</span>
                      </div>
                      <div>
                        <span class="text-[var(--st-muted)]">
                          {t("start.expert.invoiceCodeLabel")}:{" "}
                        </span>
                        <span class="font-mono">{invoice.activationCode}</span>
                      </div>
                      <Show when={invoice.note}>
                        <div>
                          <span class="text-[var(--st-muted)]">
                            {t("start.expert.invoiceNoteLabel")}:{" "}
                          </span>
                          <span>{invoice.note}</span>
                        </div>
                      </Show>
                      <a
                        class="st-btn st-btn-primary"
                        href={payments()?.redirectUrl || BOOSTY_SUBSCRIPTION_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t("start.expert.invoicePayCta")}
                      </a>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="space-y-3 rounded-md border border-[var(--st-line)] bg-[var(--st-surface)] p-6 text-sm">
            <h2 class="st-display text-sm uppercase tracking-[0.12em]">
              {t("start.expert.nextTitle")}
            </h2>
            <p>{t("start.expert.nextBody")}</p>
            <p>
              {t("start.expert.supportLabel")}{" "}
              <a
                class="font-bold text-[var(--st-red)] underline-offset-4 hover:underline"
                href={SUPPORT_TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("common.contactSupport")}
              </a>
            </p>
          </section>

          <div class="flex justify-center">
            <A href="/student/home" class="st-btn st-btn-primary">
              {t("start.expert.toDashboard")}
            </A>
          </div>
        </StartLayout>
      </Show>
    </Show>
  );
}
