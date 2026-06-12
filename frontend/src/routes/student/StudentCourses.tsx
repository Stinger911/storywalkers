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

export function StudentCourses() {
  const auth = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = createSignal<string[]>([]);
  const [lessonModeByCourse, setLessonModeByCourse] = createSignal<Record<string, boolean>>({});
  const [lessonsByCourse, setLessonsByCourse] = createSignal<Record<string, CourseLesson[]>>({});
  const [lessonsLoadingByCourse, setLessonsLoadingByCourse] = createSignal<Record<string, boolean>>({});
  const [selectedLessonsByCourse, setSelectedLessonsByCourse] = createSignal<Record<string, string[]>>({});
  const [fxRates, setFxRates] = createSignal<Record<string, number>>({ USD: 1 });
  const [checkout, setCheckout] = createSignal<CheckoutIntentResponse | null>(null);
  const isFirstHundred = createMemo(() => auth.me()?.isFirstHundred === true);

  const ownedCourseIds = createMemo(
    () => new Set(auth.me()?.selectedCourses?.filter((value) => typeof value === "string") ?? []),
  );
  const ownedLessonKeys = createMemo(() => {
    const keys = new Set<string>();
    for (const item of auth.me()?.ownedLessons ?? []) {
      keys.add(`${item.courseId}::${item.lessonId}`);
    }
    return keys;
  });
  const ownedLessonCountByCourse = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of auth.me()?.ownedLessons ?? []) {
      counts[item.courseId] = (counts[item.courseId] ?? 0) + 1;
    }
    return counts;
  });
  const preferredCurrency = createMemo(() => auth.me()?.preferredCurrency || "USD");
  const currencyRate = createMemo(() => {
    const rate = fxRates()[preferredCurrency()];
    return typeof rate === "number" && rate > 0 ? rate : 1;
  });
  const availableCourses = createMemo(() =>
    courses().filter((course) => course.isActive && !ownedCourseIds().has(course.id)),
  );
  const ownedCourses = createMemo(() =>
    courses().filter((course) => course.isActive && ownedCourseIds().has(course.id)),
  );
  const selectedCourses = createMemo(() => {
    const selected = new Set(selectedCourseIds());
    return availableCourses().filter((course) => selected.has(course.id));
  });

  const effectiveCoursePriceUsdCents = (course: Course) => {
    const ownedCount = ownedLessonCountByCourse()[course.id] ?? 0;
    if (ownedCount <= 0) return course.priceUsdCents;
    const perLesson = perLessonPriceUsdCents(course);
    if (perLesson === undefined) return course.priceUsdCents;
    return Math.max(course.priceUsdCents - ownedCount * perLesson, 0);
  };

  const selectedLessons = createMemo(() => {
    const byCourse = selectedLessonsByCourse();
    const result: SelectedLesson[] = [];
    for (const course of availableCourses()) {
      for (const lessonId of byCourse[course.id] ?? []) {
        result.push({ courseId: course.id, lessonId });
      }
    }
    return result;
  });
  const selectedItemsCount = createMemo(
    () => selectedCourseIds().length + selectedLessons().length,
  );
  const totalPrice = createMemo(() => {
    if (isFirstHundred()) return 0;
    const coursesSum = selectedCourses().reduce(
      (sum, course) =>
        sum +
        convertUsdCentsToCurrencyCents(effectiveCoursePriceUsdCents(course), currencyRate()),
      0,
    );
    const courseById = new Map(availableCourses().map((course) => [course.id, course]));
    const lessonsSum = selectedLessons().reduce((sum, item) => {
      const course = courseById.get(item.courseId);
      if (!course) return sum;
      const perLesson = perLessonPriceUsdCents(course);
      if (perLesson === undefined) return sum;
      return sum + convertUsdCentsToCurrencyCents(perLesson, currencyRate());
    }, 0);
    return coursesSum + lessonsSum;
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesData, fxData] = await Promise.all([listCourses({ force: true }), getFxRates()]);
      setCourses(coursesData.items);
      setFxRates(fxData.rates || { USD: 1 });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void load();
  });

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((value) => value !== courseId)
        : [...current, courseId],
    );
    setSelectedLessonsByCourse((current) => ({ ...current, [courseId]: [] }));
    setLessonModeByCourse((current) => ({ ...current, [courseId]: false }));
    setCheckout(null);
  };

  const toggleLessonMode = async (courseId: string) => {
    const next = !lessonModeByCourse()[courseId];
    setLessonModeByCourse((current) => ({ ...current, [courseId]: next }));
    setCheckout(null);
    if (!next) {
      setSelectedLessonsByCourse((current) => ({ ...current, [courseId]: [] }));
      return;
    }
    setSelectedCourseIds((current) => current.filter((value) => value !== courseId));
    if (lessonsByCourse()[courseId]) return;
    setLessonsLoadingByCourse((current) => ({ ...current, [courseId]: true }));
    try {
      const data = await listCourseLessons(courseId);
      setLessonsByCourse((current) => ({ ...current, [courseId]: data.items }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLessonsLoadingByCourse((current) => ({ ...current, [courseId]: false }));
    }
  };

  const toggleLesson = (courseId: string, lessonId: string) => {
    setSelectedLessonsByCourse((current) => {
      const list = current[courseId] ?? [];
      return {
        ...current,
        [courseId]: list.includes(lessonId)
          ? list.filter((value) => value !== lessonId)
          : [...list, lessonId],
      };
    });
    setSelectedCourseIds((current) => current.filter((value) => value !== courseId));
    setCheckout(null);
  };

  const startCheckout = async () => {
    const lessons = selectedLessons();
    if (selectedCourseIds().length === 0 && lessons.length === 0) {
      setError(t("student.courses.selectAtLeastOne"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: { selectedCourses?: string[]; selectedLessons?: SelectedLesson[] } = {};
      if (selectedCourseIds().length > 0) {
        payload.selectedCourses = selectedCourseIds();
      }
      if (lessons.length > 0) {
        payload.selectedLessons = lessons;
      }
      const result = await createCheckoutIntent(payload);
      setCheckout(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (usdCents: number) =>
    formatCents(
      convertUsdCentsToCurrencyCents(usdCents, currencyRate()),
      preferredCurrency(),
    );

  const FreePrice = (props: { usdCents: number }) => (
    <div class="text-sm font-medium">
      <span class="text-muted-foreground line-through">{formatPrice(props.usdCents)}</span>
      <span class="ml-2">{formatCents(0, preferredCurrency())}</span>
    </div>
  );

  const CourseLessonsPanel = (props: { course: Course }) => {
    const perLesson = createMemo(() => perLessonPriceUsdCents(props.course));
    const lessons = createMemo(() => lessonsByCourse()[props.course.id] ?? []);
    return (
      <div class="mt-3 space-y-2 border-t border-border/60 pt-3">
        <Show
          when={!lessonsLoadingByCourse()[props.course.id]}
          fallback={<div class="text-xs text-muted-foreground">{t("student.courses.loading")}</div>}
        >
          <Show
            when={lessons().length > 0 && perLesson() !== undefined}
            fallback={
              <div class="text-xs text-muted-foreground">
                {t("student.courses.lessonsNotAvailable")}
              </div>
            }
          >
            <For each={lessons()}>
              {(lesson) => {
                const owned = () =>
                  ownedLessonKeys().has(`${props.course.id}::${lesson.id}`);
                return (
                  <label class="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background px-3 py-2">
                    <div class="flex min-w-0 items-center gap-2">
                      <Show
                        when={!owned()}
                        fallback={
                          <span class="rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                            {t("student.courses.ownedLesson")}
                          </span>
                        }
                      >
                        <input
                          type="checkbox"
                          checked={(selectedLessonsByCourse()[props.course.id] ?? []).includes(lesson.id)}
                          onChange={() => toggleLesson(props.course.id, lesson.id)}
                        />
                      </Show>
                      <span class="truncate text-xs font-medium">{lesson.title}</span>
                    </div>
                    <Show when={!owned()}>
                      <span class="shrink-0 text-xs text-muted-foreground">
                        {formatPrice(perLesson() ?? 0)} {t("student.courses.lessonPrice")}
                      </span>
                    </Show>
                  </label>
                );
              }}
            </For>
          </Show>
        </Show>
      </div>
    );
  };

  return (
    <section class="space-y-6">
      <SectionCard
        title={t("student.courses.title")}
        description={t("student.courses.description")}
      >
        <Show when={!loading()} fallback={<div class="text-sm text-muted-foreground">{t("student.courses.loading")}</div>}>
          <Show when={!error()} fallback={<div class="rounded-xl border border-error/40 bg-error/10 p-4 text-sm text-error-foreground">{error()}</div>}>
            <div class="space-y-4">
              <Show
                when={availableCourses().length > 0}
                fallback={<div class="text-sm text-muted-foreground">{t("student.courses.emptyAvailable")}</div>}
              >
                <div class="grid gap-3 md:grid-cols-2">
                  <For each={availableCourses()}>
                    {(course) => {
                      const ownedCount = () => ownedLessonCountByCourse()[course.id] ?? 0;
                      const effectivePrice = () => effectiveCoursePriceUsdCents(course);
                      const lessonMode = () => lessonModeByCourse()[course.id] === true;
                      return (
                        <div class="student-list-card rounded-[calc(var(--radius-lg)+2px)] border border-border/70 bg-card p-4 shadow-none">
                          <label class="block">
                            <div class="flex items-start justify-between gap-3">
                              <div class="space-y-1">
                                <div class="text-sm font-semibold">{course.title}</div>
                                <div class="text-xs text-muted-foreground">{course.shortDescription}</div>
                                <Show
                                  when={isFirstHundred()}
                                  fallback={<div class="text-sm font-medium">{formatPrice(effectivePrice())}</div>}
                                >
                                  <FreePrice usdCents={effectivePrice()} />
                                </Show>
                                <Show when={!isFirstHundred() && ownedCount() > 0}>
                                  <div class="text-xs text-muted-foreground">
                                    {t("student.courses.upgradeHint", {
                                      count: ownedCount(),
                                      price: formatPrice(effectivePrice()),
                                    })}
                                  </div>
                                </Show>
                              </div>
                              <input
                                type="checkbox"
                                checked={selectedCourseIds().includes(course.id)}
                                onChange={() => toggleCourse(course.id)}
                              />
                            </div>
                          </label>
                          <Show when={(course.lessonCount ?? 0) > 0}>
                            <button
                              type="button"
                              class="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                              onClick={() => void toggleLessonMode(course.id)}
                            >
                              {lessonMode()
                                ? t("student.courses.courseMode")
                                : t("student.courses.lessonMode")}
                            </button>
                          </Show>
                          <Show when={lessonMode()}>
                            <CourseLessonsPanel course={course} />
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                  <div class="text-sm text-muted-foreground">
                    {t("student.courses.selectedCount", { count: selectedItemsCount() })}
                  </div>
                  <div class="text-lg font-semibold">
                    {formatCents(totalPrice(), preferredCurrency())}
                  </div>
                </div>
                <Show when={isFirstHundred()}>
                  <div class="text-sm text-muted-foreground">
                    {t("student.courses.freeAccessHint")}
                  </div>
                </Show>

                <Button onClick={() => void startCheckout()} disabled={saving() || selectedItemsCount() === 0}>
                  {t("student.courses.createPaymentInstructions")}
                </Button>
              </Show>
            </div>
          </Show>
        </Show>
      </SectionCard>

      <Show when={ownedCourses().length > 0}>
        <SectionCard title={t("student.courses.ownedTitle")}>
          <div class="flex flex-wrap gap-2">
            <For each={ownedCourses()}>
              {(course) => (
                <span class="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium">
                  {course.title}
                </span>
              )}
            </For>
          </div>
        </SectionCard>
      </Show>

      <Show when={checkout()}>
        {(result) => (
          <SectionCard title={t("student.courses.paymentInstructionsTitle")}>
            <div class="space-y-3 text-sm">
              <div class="rounded-xl border border-border/70 bg-card p-4">
                <div class="text-xs font-semibold uppercase text-muted-foreground">{t("student.courses.activationCode")}</div>
                <div class="mt-2 font-mono text-lg">{result().activationCode}</div>
              </div>
              <div class="text-muted-foreground">{result().instructionsText}</div>
              <div class="text-muted-foreground">
                {t("student.courses.amount", {
                  amount: formatCents(result().amount, result().currency),
                })}
              </div>
              <div class="flex flex-wrap gap-2">
                <Show when={result().amount > 0}>
                  <Button as="a" href={result().redirectUrl} target="_blank" rel="noopener noreferrer">
                    {t("student.courses.openPaymentPage")}
                  </Button>
                </Show>
                <Button variant="outline" onClick={() => void load()}>
                  {t("student.courses.refreshCourses")}
                </Button>
              </div>
            </div>
          </SectionCard>
        )}
      </Show>
    </section>
  );
}
