import { A } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import {
  convertRubCentsToCurrencyCents,
  formatCents,
  listCourses,
  type Course,
} from "../../lib/coursesApi";
import { getFxRates } from "../../lib/fxApi";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

const COMMUNITY_PRICE_RUB_CENTS = 200000;
const BOOSTY_URL =
  import.meta.env.VITE_BOOSTY_URL ??
  "https://boosty.to/taveren_ru/purchase/3755394?ssource=DIRECT&share=subscription_link";
const SUPPORT_TELEGRAM_URL =
  import.meta.env.VITE_SUPPORT_TELEGRAM_URL ??
  "https://t.me/storywalkers_support_bot";

export function OnboardingCheckout() {
  const auth = useAuth();
  const { t } = useI18n();
  const [goalTitle, setGoalTitle] = createSignal<string | null>(null);
  const [coursesById, setCoursesById] = createSignal<Record<string, Course>>({});
  const [fxRates, setFxRates] = createSignal<Record<string, number>>({ USD: 1 });
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const me = () => auth.me();
  const isFirstHundred = createMemo(() => me()?.isFirstHundred === true);
  const preferredCurrency = createMemo(() => me()?.preferredCurrency || "USD");

  const selectedCourseIds = createMemo(() => me()?.selectedCourses || []);
  const communitySelected = createMemo(() => true);

  const communityPriceCents = createMemo(() =>
    convertRubCentsToCurrencyCents(
      COMMUNITY_PRICE_RUB_CENTS,
      fxRates(),
      preferredCurrency(),
    ),
  );

  const selectedCourseItems = createMemo(() =>
    selectedCourseIds().map((id) => {
      const course = coursesById()[id];
      return {
        id,
        title: course?.title || id,
      };
    }),
  );

  const totalPrice = createMemo(() =>
    communitySelected() ? communityPriceCents() : 0,
  );

  onMount(() => {
    void (async () => {
      const selectedGoalTitle = me()?.selectedGoalTitle;
      const selectedGoalId = me()?.selectedGoalId;
      if (selectedGoalTitle || selectedGoalId) {
        setGoalTitle(selectedGoalTitle || selectedGoalId || null);
      }

      try {
        const [response, fxResponse] = await Promise.all([
          listCourses(),
          getFxRates(),
        ]);
        const nextMap: Record<string, Course> = {};
        for (const item of response.items) {
          nextMap[item.id] = item;
        }
        setCoursesById(nextMap);
        setFxRates(fxResponse.rates || { USD: 1 });
      } catch {
        setCoursesById({});
      }
    })();
  });

  const goalSummary = createMemo(
    () =>
      goalTitle() ||
      me()?.selectedGoalTitle ||
      me()?.selectedGoalId ||
      t("student.onboarding.checkout.goalEmpty"),
  );

  const removeCourse = async (courseId: string) => {
    setSaving(true);
    setError(null);
    try {
      const nextCourses = selectedCourseIds().filter((id) => id !== courseId);
      await auth.patchMe({ selectedCourses: nextCourses });
    } catch (err) {
      const message = (err as Error).message?.trim();
      setError(message || t("student.onboarding.checkout.removeError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      step="checkout"
      title={t("student.onboarding.checkout.title")}
      subtitle={t("student.onboarding.checkout.subtitle")}
    >
      <Show when={isFirstHundred()}>
        <SectionCard title={t("student.onboarding.checkout.firstHundredCardTitle")}>
          <p class="text-sm leading-6 text-muted-foreground">
            {t("student.onboarding.checkout.firstHundredCardBody")}
          </p>
        </SectionCard>
      </Show>

      <SectionCard title={t("student.onboarding.checkout.cardTitle")}>
        <div class="space-y-4 text-sm">
          <div>
            <span class="text-muted-foreground">
              {t("student.onboarding.checkout.goalLabel")}
            </span>{" "}
            <span class="font-medium">{goalSummary()}</span>
          </div>
          <div>
            <div class="text-muted-foreground">
              {t("student.onboarding.checkout.coursesLabel")}
            </div>
            <Show
              when={selectedCourseItems().length > 0}
              fallback={
                <div class="mt-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-warning-foreground">
                  <div>{t("student.onboarding.checkout.coursesEmpty")}</div>
                  <div class="mt-3">
                    <Button as={A} href="/onboarding/courses" variant="outline">
                      {t("student.onboarding.checkout.backToCourses")}
                    </Button>
                  </div>
                </div>
              }
            >
              <div class="mt-2 space-y-2">
                <For each={selectedCourseItems()}>
                  {(course) => (
                    <div class="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2">
                      <span>{course.title}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void removeCourse(course.id)}
                        disabled={saving()}
                      >
                        {t("student.onboarding.checkout.removeCourse")}
                      </Button>
                    </div>
                  )}
                </For>
                <Show when={communitySelected()}>
                  <div class="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
                    <span>{t("student.onboarding.checkout.communityLabel")}</span>
                    <span class="font-medium">
                      {formatCents(communityPriceCents(), preferredCurrency())}
                    </span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
          <div class="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
            <span class="text-muted-foreground">
              {t("student.onboarding.checkout.totalLabel")}
            </span>
            <span class="text-lg font-semibold">
              {formatCents(totalPrice(), preferredCurrency())}
            </span>
          </div>
          <Show when={error()}>
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {error()}
            </div>
          </Show>
          <div class="flex flex-wrap gap-2">
            <Button as={A} href="/onboarding/courses" variant="outline">
              {t("student.onboarding.profile.back")}
            </Button>
            <Show when={totalPrice() > 0 && selectedCourseItems().length > 0}>
              <Button
                as="a"
                href={BOOSTY_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("student.onboarding.checkout.boostyCta")}
              </Button>
            </Show>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("student.onboarding.checkout.afterPaymentTitle")}>
        <div class="space-y-3 text-sm">
          <p class="text-muted-foreground">
            {isFirstHundred()
              ? t("student.onboarding.checkout.afterPaymentFree")
              : t("student.onboarding.checkout.afterPaymentManual")}
          </p>
          <p class="text-muted-foreground">
            {t("student.onboarding.checkout.afterPaymentContactLabel")} {" "}
            <a
              class="font-medium text-primary underline-offset-4 hover:underline"
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("common.contactSupport")}
            </a>
          </p>
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
