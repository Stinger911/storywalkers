import { A } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import { listGoals } from "../../lib/adminApi";
import {
  convertUsdCentsToCurrencyCents,
  formatCents,
  listCourses,
  type Course,
} from "../../lib/coursesApi";
import { getFxRates } from "../../lib/fxApi";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

const COMMUNITY_PRICE_USD_CENTS = 1900;
const BOOSTY_URL =
  import.meta.env.VITE_BOOSTY_URL ?? "https://boosty.to/storywalkers";
const SUPPORT_CONTACT =
  import.meta.env.VITE_SUPPORT_CONTACT ?? "t.me/storywalkers_support_bot";
const SUPPORT_TELEGRAM_URL =
  import.meta.env.VITE_SUPPORT_TELEGRAM_URL ??
  "https://t.me/storywalkers_support_bot";

export function OnboardingCheckout() {
  const auth = useAuth();
  const { t } = useI18n();
  const [goalTitle, setGoalTitle] = createSignal<string | null>(null);
  const [coursesById, setCoursesById] = createSignal<Record<string, Course>>({});
  const [fxRates, setFxRates] = createSignal<Record<string, number>>({ USD: 1 });
  const me = () => auth.me();
  const preferredCurrency = createMemo(() => me()?.preferredCurrency || "USD");
  const currencyRate = createMemo(() => {
    const rate = fxRates()[preferredCurrency()];
    return typeof rate === "number" && rate > 0 ? rate : 1;
  });

  const selectedCourseIds = createMemo(() => me()?.selectedCourses || []);
  const communitySelected = createMemo(() => Boolean(me()?.subscriptionSelected));

  const formatPrice = (usdCents: number) =>
    formatCents(
      convertUsdCentsToCurrencyCents(usdCents, currencyRate()),
      preferredCurrency(),
    );

  const selectedCourseItems = createMemo(() =>
    selectedCourseIds().map((id) => {
      const course = coursesById()[id];
      return {
        id,
        title: course?.title || id,
        priceUsdCents: course?.priceUsdCents || 0,
      };
    }),
  );

  const totalPrice = createMemo(() => {
    const coursesTotal = selectedCourseItems().reduce(
      (sum, item) => sum + item.priceUsdCents,
      0,
    );
    return convertUsdCentsToCurrencyCents(
      coursesTotal + (communitySelected() ? COMMUNITY_PRICE_USD_CENTS : 0),
      currencyRate(),
    );
  });

  onMount(() => {
    void (async () => {
      const selectedGoalId = me()?.selectedGoalId;
      if (selectedGoalId) {
        try {
          const goals = await listGoals();
          const match = goals.items.find((goal) => goal.id === selectedGoalId);
          setGoalTitle(match?.title || selectedGoalId);
        } catch {
          setGoalTitle(selectedGoalId);
        }
      }

      try {
        const [response, fxResponse] = await Promise.all([listCourses(), getFxRates()]);
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
    () => goalTitle() || me()?.selectedGoalId || t("student.onboarding.checkout.goalEmpty"),
  );

  return (
    <OnboardingLayout
      step="checkout"
      title={t("student.onboarding.checkout.title")}
      subtitle={t("student.onboarding.checkout.subtitle")}
    >
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
                <div class="mt-2 text-muted-foreground">
                  {t("student.onboarding.checkout.coursesEmpty")}
                </div>
              }
            >
              <div class="mt-2 space-y-2">
                <For each={selectedCourseItems()}>
                  {(course) => (
                    <div class="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
                      <span>{course.title}</span>
                      <span class="font-medium">{formatPrice(course.priceUsdCents)}</span>
                    </div>
                  )}
                </For>
                <Show when={communitySelected()}>
                  <div class="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
                    <span>{t("student.onboarding.checkout.communityLabel")}</span>
                    <span class="font-medium">{formatPrice(COMMUNITY_PRICE_USD_CENTS)}</span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
          <div class="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
            <span class="text-muted-foreground">{t("student.onboarding.checkout.totalLabel")}</span>
            <span class="text-lg font-semibold">
              {formatCents(totalPrice(), preferredCurrency())}
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button as={A} href="/onboarding/courses" variant="outline">
              {t("student.onboarding.profile.back")}
            </Button>
            <Button
              as="a"
              href={BOOSTY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("student.onboarding.checkout.boostyCta")}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("student.onboarding.checkout.afterPaymentTitle")}>
        <div class="space-y-3 text-sm">
          <p class="text-muted-foreground">
            {t("student.onboarding.checkout.afterPaymentManual")}
          </p>
          <p class="text-muted-foreground">
            {t("student.onboarding.checkout.afterPaymentContactLabel")}{" "}
            <a
              class="font-medium text-primary underline-offset-4 hover:underline"
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {SUPPORT_CONTACT}
            </a>
          </p>
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
