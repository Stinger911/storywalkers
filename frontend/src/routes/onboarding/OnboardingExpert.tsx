import { A, Navigate } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";

import { Loading } from "../../components/Loading";
import { Button, buttonVariants } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import {
  isPayableInvoice,
  listMyPayments,
  type MyPayment,
} from "../../lib/checkoutApi";
import { formatCents } from "../../lib/coursesApi";
import { useI18n } from "../../lib/i18n";
import { StudentLayout } from "../student/StudentLayout";

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
        <StudentLayout>
          <section class="mx-auto max-w-3xl space-y-5">
            <SectionCard title={t("start.expert.title")}>
              <p class="text-sm leading-6 text-muted-foreground">
                {t("start.expert.body")}
              </p>
            </SectionCard>

            <SectionCard title={t("start.expert.subscriptionTitle")}>
              <div class="space-y-4">
                <p class="text-sm leading-6 text-muted-foreground">
                  {t("start.expert.subscriptionBody")}
                </p>
                <a
                  class={buttonVariants({})}
                  href={BOOSTY_SUBSCRIPTION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("start.expert.subscriptionCta")}
                </a>
              </div>
            </SectionCard>

            <SectionCard title={t("start.expert.invoiceTitle")}>
              <Show
                when={invoices().length > 0}
                fallback={
                  <p class="text-sm text-muted-foreground">
                    {t("start.expert.invoiceEmpty")}
                  </p>
                }
              >
                <div class="space-y-3">
                  <For each={invoices()}>
                    {(invoice) => (
                      <div class="space-y-2 rounded-xl border border-border/70 bg-card p-4 text-sm">
                        <div class="text-lg font-semibold">
                          {formatCents(invoice.amount, invoice.currency)}
                        </div>
                        <div>
                          <span class="text-muted-foreground">
                            {t("start.expert.invoiceLessonsLabel")}:{" "}
                          </span>
                          <span>{invoice.selectedLessons.length}</span>
                        </div>
                        <div>
                          <span class="text-muted-foreground">
                            {t("start.expert.invoiceCodeLabel")}:{" "}
                          </span>
                          <span class="font-mono">{invoice.activationCode}</span>
                        </div>
                        <Show when={invoice.note}>
                          <div>
                            <span class="text-muted-foreground">
                              {t("start.expert.invoiceNoteLabel")}:{" "}
                            </span>
                            <span>{invoice.note}</span>
                          </div>
                        </Show>
                        <a
                          class={buttonVariants({ size: "sm" })}
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
            </SectionCard>

            <SectionCard title={t("start.expert.nextTitle")}>
              <div class="space-y-3 text-sm">
                <p class="text-muted-foreground">{t("start.expert.nextBody")}</p>
                <p class="text-muted-foreground">
                  {t("start.expert.supportLabel")}{" "}
                  <a
                    class="font-medium text-primary underline-offset-4 hover:underline"
                    href={SUPPORT_TELEGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("common.contactSupport")}
                  </a>
                </p>
                <Button as={A} href="/student/home" variant="outline">
                  {t("start.expert.toDashboard")}
                </Button>
              </div>
            </SectionCard>
          </section>
        </StudentLayout>
      </Show>
    </Show>
  );
}
