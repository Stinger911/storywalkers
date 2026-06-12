import { A } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import {
  createCheckoutIntent,
  type CheckoutIntentResponse,
  type SelectedLesson,
} from "../../lib/checkoutApi";
import {
  convertRubCentsToCurrencyCents,
  convertUsdCentsToCurrencyCents,
  formatCents,
  listCourseLessons,
  listCourses,
  perLessonPriceUsdCents,
  type Course,
  type CourseLesson,
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
  const [lessonsByCourse, setLessonsByCourse] = createSignal<Record<string, CourseLesson[]>>({});
  const [fxRates, setFxRates] = createSignal<Record<string, number>>({ USD: 1 });
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [checkout, setCheckout] = createSignal<CheckoutIntentResponse | null>(null);
  const me = () => auth.me();
  const isFirstHundred = createMemo(() => me()?.isFirstHundred === true);
  const preferredCurrency = createMemo(() => me()?.preferredCurrency || "USD");
  const currencyRate = createMemo(() => {
    const rate = fxRates()[preferredCurrency()];
    return typeof rate === "number" && rate > 0 ? rate : 1;
  });

  const selectedCourseIds = createMemo(() => me()?.selectedCourses || []);
  const selectedLessons = createMemo<SelectedLesson[]>(() => me()?.selectedLessons || []);
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

  const lessonPriceCents = (courseId: string) => {
    const course = coursesById()[courseId];
    if (!course) return null;
    const perLesson = perLessonPriceUsdCents(course);
    if (perLesson === undefined) return null;
    return convertUsdCentsToCurrencyCents(perLesson, currencyRate());
  };

  const selectedLessonItems = createMemo(() =>
    selectedLessons().map((item) => {
      const course = coursesById()[item.courseId];
      const lesson = (lessonsByCourse()[item.courseId] ?? []).find(
        (entry) => entry.id === item.lessonId,
      );
      return {
        courseId: item.courseId,
        lessonId: item.lessonId,
        courseTitle: course?.title || item.courseId,
        lessonTitle: lesson?.title || item.lessonId,
        priceCents: lessonPriceCents(item.courseId),
      };
    }),
  );

  const lessonsTotalCents = createMemo(() =>
    isFirstHundred()
      ? 0
      : selectedLessonItems().reduce((sum, item) => sum + (item.priceCents ?? 0), 0),
  );

  const totalPrice = createMemo(
    () => (communitySelected() ? communityPriceCents() : 0) + lessonsTotalCents(),
  );

  const hasSelection = createMemo(
    () => selectedCourseIds().length > 0 || selectedLessons().length > 0,
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

      const lessonCourseIds = [
        ...new Set(selectedLessons().map((item) => item.courseId)),
      ];
      for (const courseId of lessonCourseIds) {
        try {
          const lessonsResponse = await listCourseLessons(courseId);
          setLessonsByCourse((current) => ({
            ...current,
            [courseId]: lessonsResponse.items,
          }));
        } catch {
          // keep lesson ids as fallback titles
        }
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
    setCheckout(null);
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

  const removeLesson = async (courseId: string, lessonId: string) => {
    setSaving(true);
    setError(null);
    setCheckout(null);
    try {
      const nextLessons = selectedLessons().filter(
        (item) => item.courseId !== courseId || item.lessonId !== lessonId,
      );
      await auth.patchMe({ selectedLessons: nextLessons });
    } catch (err) {
      const message = (err as Error).message?.trim();
      setError(message || t("student.onboarding.checkout.removeError"));
    } finally {
      setSaving(false);
    }
  };

  const startCheckout = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: { selectedCourses?: string[]; selectedLessons?: SelectedLesson[] } = {};
      if (selectedCourseIds().length > 0) {
        payload.selectedCourses = selectedCourseIds();
      }
      if (selectedLessons().length > 0) {
        payload.selectedLessons = selectedLessons();
      }
      const result = await createCheckoutIntent(payload);
      setCheckout(result);
    } catch (err) {
      const message = (err as Error).message?.trim();
      setError(message || t("student.onboarding.courses.saveError"));
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
              when={hasSelection()}
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
                <Show when={selectedLessonItems().length > 0}>
                  <div class="pt-1 text-muted-foreground">
                    {t("student.onboarding.checkout.lessonsLabel")}
                  </div>
                  <For each={selectedLessonItems()}>
                    {(item) => (
                      <div class="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-card px-3 py-2">
                        <span class="min-w-0 flex-1 truncate">
                          {item.courseTitle} · {item.lessonTitle}
                        </span>
                        <span class="flex shrink-0 items-center gap-2">
                          <Show when={item.priceCents !== null}>
                            <span class="font-medium">
                              {formatCents(item.priceCents ?? 0, preferredCurrency())}
                            </span>
                          </Show>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void removeLesson(item.courseId, item.lessonId)}
                            disabled={saving()}
                          >
                            {t("student.onboarding.checkout.removeCourse")}
                          </Button>
                        </span>
                      </div>
                    )}
                  </For>
                </Show>
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
          <Show when={checkout()}>
            {(result) => (
              <div class="space-y-3 rounded-xl border border-border/70 bg-card p-4">
                <div>
                  <div class="text-xs font-semibold uppercase text-muted-foreground">
                    {t("student.courses.activationCode")}
                  </div>
                  <div class="mt-2 font-mono text-lg">{result().activationCode}</div>
                </div>
                <div class="text-muted-foreground">{result().instructionsText}</div>
                <div class="text-muted-foreground">
                  {t("student.courses.amount", {
                    amount: formatCents(result().amount, result().currency),
                  })}
                </div>
              </div>
            )}
          </Show>
          <div class="flex flex-wrap gap-2">
            <Button as={A} href="/onboarding/courses" variant="outline">
              {t("student.onboarding.profile.back")}
            </Button>
            <Show when={hasSelection() && !checkout()}>
              <Button onClick={() => void startCheckout()} disabled={saving()}>
                {saving()
                  ? t("student.onboarding.common.saving")
                  : t("student.courses.createPaymentInstructions")}
              </Button>
            </Show>
            <Show when={checkout() && (checkout()?.amount ?? 0) > 0}>
              <Button
                as="a"
                href={checkout()?.redirectUrl || BOOSTY_URL}
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
