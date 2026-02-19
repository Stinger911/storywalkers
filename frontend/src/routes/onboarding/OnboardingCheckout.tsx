import { A } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import { listGoals } from "../../lib/adminApi";
import { listCourses, type Course } from "../../lib/coursesApi";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

const COMMUNITY_PRICE = 19;
const BOOSTY_URL =
  import.meta.env.VITE_BOOSTY_URL ?? "https://boosty.to/storywalkers";
const SUPPORT_CONTACT =
  import.meta.env.VITE_SUPPORT_CONTACT ?? "@storywalkers_support";
const SUPPORT_TELEGRAM_URL =
  import.meta.env.VITE_SUPPORT_TELEGRAM_URL ?? "https://t.me/storywalkers_support";

export function OnboardingCheckout() {
  const auth = useAuth();
  const { t } = useI18n();
  const [goalTitle, setGoalTitle] = createSignal<string | null>(null);
  const [coursesById, setCoursesById] = createSignal<Record<string, Course>>({});
  const me = () => auth.me();

  const selectedCourseIds = createMemo(() => me()?.selectedCourses || []);
  const communitySelected = createMemo(() => Boolean(me()?.subscriptionSelected));

  const selectedCourseItems = createMemo(() =>
    selectedCourseIds().map((id) => {
      const course = coursesById()[id];
      return {
        id,
        title: course?.title || id,
        price: course?.price || 0,
      };
    }),
  );

  const totalPrice = createMemo(() => {
    const coursesTotal = selectedCourseItems().reduce(
      (sum, item) => sum + item.price,
      0,
    );
    return coursesTotal + (communitySelected() ? COMMUNITY_PRICE : 0);
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
        const response = await listCourses();
        const nextMap: Record<string, Course> = {};
        for (const item of response.items) {
          nextMap[item.id] = item;
        }
        setCoursesById(nextMap);
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
                      <span class="font-medium">${course.price}</span>
                    </div>
                  )}
                </For>
                <Show when={communitySelected()}>
                  <div class="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
                    <span>{t("student.onboarding.checkout.communityLabel")}</span>
                    <span class="font-medium">${COMMUNITY_PRICE}</span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
          <div class="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
            <span class="text-muted-foreground">{t("student.onboarding.checkout.totalLabel")}</span>
            <span class="text-lg font-semibold">${totalPrice()}</span>
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
