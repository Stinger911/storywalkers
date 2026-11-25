import { A } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";

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
import { draftFromYoutubeOnboarding, writeDraft } from "../start/startDraft";
import { StartButton } from "../start/StartUi";
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
  // The backend activates a free "first hundred" checkout at once.
  const isAutoActivated = (result: CheckoutIntentResponse) =>
    isFirstHundred() && result.amount === 0;
  const activated = createMemo(() => {
    const result = checkout();
    return result !== null && isAutoActivated(result);
  });
  const preferredCurrency = createMemo(() => me()?.preferredCurrency || "USD");
  const currencyRate = createMemo(() => {
    const rate = fxRates()[preferredCurrency()];
    return typeof rate === "number" && rate > 0 ? rate : 1;
  });

  // Going back reopens the path step of the funnel. Accounts without funnel
  // answers start it from the beginning.
  const backToPathHref = createMemo(() =>
    me()?.youtubeOnboarding ? "/start/plan" : "/start",
  );
  // The draft was cleared after registration, so rebuild it from the account.
  const restorePath = () => {
    const current = me();
    if (!current?.youtubeOnboarding) return;
    writeDraft({
      ...draftFromYoutubeOnboarding(current.youtubeOnboarding),
      selectedCourses: current.selectedCourses ?? [],
      selectedLessons: current.selectedLessons ?? [],
    });
  };
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
    })();
  });

  // The account can arrive after this component mounts (full page load), so
  // lesson titles are requested when the selection becomes known.
  const requestedLessonCourses = new Set<string>();
  createEffect(() => {
    for (const { courseId } of selectedLessons()) {
      if (requestedLessonCourses.has(courseId)) continue;
      requestedLessonCourses.add(courseId);
      void listCourseLessons(courseId).then(
        (response) =>
          setLessonsByCourse((current) => ({ ...current, [courseId]: response.items })),
        () => {
          // keep lesson ids as fallback titles
        },
      );
    }
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
      // The dashboard is closed to an inactive student, so reload the account
      // before offering the way there.
      if (isAutoActivated(result)) await auth.refreshMe();
      setCheckout(result);
    } catch (err) {
      const message = (err as Error).message?.trim();
      setError(message || t("student.onboarding.checkout.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const TrashIcon = () => (
    <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="1.6">
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12M9 7V4h6v3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );

  return (
    <OnboardingLayout
      step="checkout"
      title={t("student.onboarding.checkout.title")}
      subtitle={t("student.onboarding.checkout.subtitle")}
    >
      <Show when={isFirstHundred()}>
        <div class="st-card st-card-fill space-y-2 px-8 py-6 text-center">
          <h2 class="st-display text-lg">
            {t("student.onboarding.checkout.firstHundredCardTitle")}
          </h2>
          <p class="text-xs leading-6">
            {t("student.onboarding.checkout.firstHundredCardBody")}
          </p>
        </div>
      </Show>

      <section class="space-y-5 rounded-md border border-[var(--st-line)] bg-white p-6">
        <h2 class="st-display text-sm uppercase tracking-[0.12em]">
          {t("student.onboarding.checkout.cardTitle")}
        </h2>
        <div class="text-sm">
          <span class="text-[var(--st-muted)]">
            {t("student.onboarding.checkout.goalLabel")}
          </span>{" "}
          <span class="font-bold">{goalSummary()}</span>
        </div>

        <div class="space-y-2 text-sm">
          <div class="text-[var(--st-muted)]">
            {t("student.onboarding.checkout.coursesLabel")}
          </div>
          <Show
            when={hasSelection()}
            fallback={
              <div class="st-notice space-y-3">
                <div>{t("student.onboarding.checkout.coursesEmpty")}</div>
                <A
                  href={backToPathHref()}
                  class="st-btn st-btn-secondary"
                  onClick={restorePath}
                >
                  {t("student.onboarding.checkout.backToCourses")}
                </A>
              </div>
            }
          >
            <For each={selectedCourseItems()}>
              {(course) => (
                <div class="st-row">
                  <span class="min-w-0 flex-1 font-bold">{course.title}</span>
                  <Show when={!activated()}>
                    <button
                      type="button"
                      class="st-icon-btn"
                      aria-label={t("student.onboarding.checkout.removeCourse")}
                      onClick={() => void removeCourse(course.id)}
                      disabled={saving()}
                    >
                      <TrashIcon />
                    </button>
                  </Show>
                </div>
              )}
            </For>
            <Show when={selectedLessonItems().length > 0}>
              <div class="pt-1 text-[var(--st-muted)]">
                {t("student.onboarding.checkout.lessonsLabel")}
              </div>
              <For each={selectedLessonItems()}>
                {(item) => (
                  <div class="st-row">
                    <span class="min-w-0 flex-1 truncate">
                      {item.courseTitle} · {item.lessonTitle}
                    </span>
                    <Show when={item.priceCents !== null && !isFirstHundred()}>
                      <span class="flex-none font-bold">
                        {formatCents(item.priceCents ?? 0, preferredCurrency())}
                      </span>
                    </Show>
                    <Show when={!activated()}>
                      <button
                        type="button"
                        class="st-icon-btn"
                        aria-label={t("student.onboarding.checkout.removeCourse")}
                        onClick={() => void removeLesson(item.courseId, item.lessonId)}
                        disabled={saving()}
                      >
                        <TrashIcon />
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </Show>
          {/* The community line stays visible even with no courses left:
              it is mandatory and always part of the total. */}
          <Show when={communitySelected()}>
            <div class="st-row">
              <span class="min-w-0 flex-1 font-bold">
                {t("student.onboarding.checkout.communityLabel")}
              </span>
              <span class="flex-none font-bold">
                {formatCents(communityPriceCents(), preferredCurrency())}
              </span>
            </div>
          </Show>
        </div>

        <div class="flex items-center justify-between rounded-md bg-[var(--st-red-soft)] px-5 py-4">
          <span class="text-xs uppercase tracking-[0.1em]">
            {t("student.onboarding.checkout.totalLabel")}
          </span>
          <span class="st-display text-lg text-[var(--st-red)]">
            {formatCents(totalPrice(), preferredCurrency())}
          </span>
        </div>

        <Show when={error()}>
          <div
            role="alert"
            class="rounded-md border border-[var(--st-red-border)] bg-[var(--st-red-soft)] px-4 py-3 text-center text-xs text-[var(--st-red)]"
          >
            {error()}
          </div>
        </Show>
        <Show when={checkout()}>
          {(result) => (
            <div class="space-y-3 rounded-md border border-[var(--st-line)] bg-[var(--st-surface)] p-5 text-sm">
              <div>
                <div class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-[var(--st-muted)]">
                  {t("student.courses.activationCode")}
                </div>
                <div class="mt-2 font-mono text-lg">{result().activationCode}</div>
              </div>
              <Show
                when={!activated()}
                fallback={
                  <div role="status" class="font-bold">
                    {t("student.onboarding.checkout.activatedMessage")}
                  </div>
                }
              >
                <div>{result().instructionsText}</div>
                <div class="text-[var(--st-muted)]">
                  {t("student.courses.amount", {
                    amount: formatCents(result().amount, result().currency),
                  })}
                </div>
              </Show>
            </div>
          )}
        </Show>

        <div class="flex flex-wrap items-center justify-center gap-4">
          <Show
            when={!activated()}
            fallback={
              <A href="/student/home" class="st-btn st-btn-primary">
                {t("student.onboarding.checkout.dashboardCta")}
              </A>
            }
          >
            <A href={backToPathHref()} class="st-btn st-btn-secondary" onClick={restorePath}>
              {t("student.onboarding.profile.back")}
            </A>
          </Show>
          <Show when={hasSelection() && !checkout()}>
            <StartButton onClick={() => void startCheckout()} disabled={saving()}>
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.courses.createPaymentInstructions")}
            </StartButton>
          </Show>
          {/* Offered after a free activation too: the community is paid there. */}
          <Show when={checkout()}>
            <a
              class="st-btn"
              classList={{
                "st-btn-primary": !activated(),
                "st-btn-secondary": activated(),
              }}
              href={checkout()?.redirectUrl || BOOSTY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("student.onboarding.checkout.boostyCta")}
            </a>
          </Show>
        </div>
      </section>

      <section class="space-y-3 rounded-md border border-[var(--st-line)] bg-[var(--st-surface)] p-6 text-sm">
        <h2 class="st-display text-sm uppercase tracking-[0.12em]">
          {t("student.onboarding.checkout.afterPaymentTitle")}
        </h2>
        <p>
          {isFirstHundred()
            ? t("student.onboarding.checkout.afterPaymentFree")
            : t("student.onboarding.checkout.afterPaymentManual")}
        </p>
        <p>
          {t("student.onboarding.checkout.afterPaymentContactLabel")}{" "}
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
    </OnboardingLayout>
  );
}
