import { A, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button, buttonVariants } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { SmallStatBadge } from "../../components/ui/small-stat-badge";
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../../lib/auth";
import {
  convertRubCentsToCurrencyCents,
  convertUsdCentsToCurrencyCents,
  formatCents,
  listCourseLessons,
  listCourses,
  type CourseLesson,
  type Course,
} from "../../lib/coursesApi";
import { getFxRates } from "../../lib/fxApi";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

const COMMUNITY_CARD = {
  id: "community",
  titleKey: "student.onboarding.courses.communityTitle",
  descKey: "student.onboarding.courses.communityDescription",
  priceRubCents: 200000,
} as const;

type CurrencyOption = {
  value: "USD" | "EUR" | "PLN" | "RUB";
  label: string;
};

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "PLN", label: "PLN" },
  { value: "RUB", label: "RUB" },
];

export function OnboardingCourses() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isFirstHundred = createMemo(() => auth.me()?.isFirstHundred === true);

  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [expandedCourseId, setExpandedCourseId] = createSignal<string | null>(null);
  const [lessonsByCourse, setLessonsByCourse] = createSignal<Record<string, CourseLesson[]>>({});
  const [lessonLoadingByCourse, setLessonLoadingByCourse] = createSignal<Record<string, boolean>>({});
  const [lessonErrorByCourse, setLessonErrorByCourse] = createSignal<Record<string, string | null>>({});
  const [fxRates, setFxRates] = createSignal<Record<string, number>>({ USD: 1 });
  const initialPreferredCurrency = (): CurrencyOption["value"] => {
    const current = auth.me()?.preferredCurrency;
    if (current === "EUR" || current === "PLN" || current === "RUB") {
      return current;
    }
    return "USD";
  };
  const [preferredCurrency, setPreferredCurrency] =
    createSignal<CurrencyOption["value"]>(initialPreferredCurrency());
  const selectedGoalId = createMemo(() => auth.me()?.selectedGoalId || null);

  const [saving, setSaving] = createSignal(false);
  const [currencySaving, setCurrencySaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [currencyError, setCurrencyError] = createSignal<string | null>(null);

  const [selectedCourses, setSelectedCourses] = createSignal<string[]>(
    auth.me()?.selectedCourses || [],
  );
  const communitySelected = () => true;

  const hasPreferredRate = createMemo(() => {
    const next = fxRates()[preferredCurrency()];
    return typeof next === "number" && next > 0;
  });
  const displayCurrency = createMemo<CurrencyOption["value"]>(() =>
    hasPreferredRate() ? preferredCurrency() : "USD",
  );
  const currencyRate = createMemo(() =>
    displayCurrency() === "USD" ? 1 : (fxRates()[displayCurrency()] as number),
  );

  const formatPrice = (usdCents: number) =>
    formatCents(
      convertUsdCentsToCurrencyCents(usdCents, currencyRate()),
      displayCurrency(),
    );

  const communityPriceCents = createMemo(() =>
    convertRubCentsToCurrencyCents(
      COMMUNITY_CARD.priceRubCents,
      fxRates(),
      displayCurrency(),
    ),
  );

  const totalPriceCents = createMemo(() => {
    const selected = new Set(selectedCourses());
    const coursesTotalUsdCents = courses()
      .filter((course) => course.isActive)
      .filter((course) => selected.has(course.id))
      .reduce((sum, course) => sum + course.priceUsdCents, 0);
    const communityCents = communitySelected() ? communityPriceCents() : 0;
    return convertUsdCentsToCurrencyCents(
      isFirstHundred() ? 0 : coursesTotalUsdCents,
      currencyRate(),
    ) + communityCents;
  });

  const FreePrice = (props: { usdCents: number }) => (
    <span class="inline-flex items-center gap-2">
      <span class="text-muted-foreground line-through">
        {formatPrice(props.usdCents)}
      </span>
      <span>{formatCents(0, displayCurrency())}</span>
    </span>
  );

  const activeCourses = createMemo(() => courses().filter((course) => course.isActive));
  const inactiveCourses = createMemo(() =>
    courses().filter((course) => !course.isActive),
  );
  const selectedActiveCourseIds = createMemo(() => {
    const activeIds = new Set(activeCourses().map((course) => course.id));
    return selectedCourses().filter((id) => activeIds.has(id));
  });

  const toggleCourse = (courseId: string, isActive: boolean) => {
    if (saving() || currencySaving()) return;
    if (!isActive) return;
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId],
    );
  };

  const setLessonsLoading = (courseId: string, value: boolean) => {
    setLessonLoadingByCourse((current) => ({ ...current, [courseId]: value }));
  };

  const setLessonsError = (courseId: string, value: string | null) => {
    setLessonErrorByCourse((current) => ({ ...current, [courseId]: value }));
  };

  const loadLessons = async (courseId: string) => {
    if (lessonsByCourse()[courseId] || lessonLoadingByCourse()[courseId]) return;
    setLessonsLoading(courseId, true);
    setLessonsError(courseId, null);
    try {
      const response = await listCourseLessons(courseId);
      setLessonsByCourse((current) => ({ ...current, [courseId]: response.items }));
    } catch (err) {
      setLessonsError(courseId, formatError(err, t("student.onboarding.courses.loadError")));
    } finally {
      setLessonsLoading(courseId, false);
    }
  };

  const toggleExpandedCourse = (courseId: string) => {
    if (expandedCourseId() === courseId) {
      setExpandedCourseId(null);
      return;
    }
    setExpandedCourseId(courseId);
    void loadLessons(courseId);
  };

  const formatError = (err: unknown, fallback: string) => {
    const message = (err as Error).message?.trim();
    if (!message || message.toLowerCase() === "request failed") return fallback;
    return `${fallback} ${message}`;
  };

  const load = async (options?: { force?: boolean }) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [courseResponse, fxResponse] = await Promise.all([
        listCourses({ ...options, goalId: selectedGoalId() }),
        getFxRates(options),
      ]);
      setCourses(courseResponse.items);
      setFxRates(fxResponse.rates || { USD: 1 });
    } catch (err) {
      setLoadError(formatError(err, t("student.onboarding.courses.loadError")));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void load();
  });

  const save = async (): Promise<boolean> => {
    setSaving(true);
    setSaveError(null);
    try {
      await auth.patchMe({
        selectedCourses: selectedActiveCourseIds(),
        subscriptionSelected: true,
      });
      return true;
    } catch (err) {
      setSaveError(formatError(err, t("student.onboarding.courses.saveError")));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updatePreferredCurrency = async (nextCurrency: CurrencyOption["value"]) => {
    if (nextCurrency === preferredCurrency()) return;
    const previous = preferredCurrency();
    setPreferredCurrency(nextCurrency);
    setCurrencySaving(true);
    setCurrencyError(null);
    try {
      await auth.patchMe({ preferredCurrency: nextCurrency });
    } catch (err) {
      setPreferredCurrency(previous);
      setCurrencyError(
        formatError(err, t("student.onboarding.courses.currencySaveError")),
      );
    } finally {
      setCurrencySaving(false);
    }
  };

  const next = async () => {
    const ok = await save();
    if (ok) {
      void navigate("/onboarding/checkout");
    }
  };

  const CourseRow = (props: { course: Course; disabled?: boolean }) => {
    const selected = () => selectedCourses().includes(props.course.id);
    const expanded = () => expandedCourseId() === props.course.id;
    const lessons = () => lessonsByCourse()[props.course.id] ?? [];
    const lessonsLoading = () => Boolean(lessonLoadingByCourse()[props.course.id]);
    const lessonsError = () => lessonErrorByCourse()[props.course.id];

    return (
      <div
        class={`rounded-[calc(var(--radius-lg)+2px)] border bg-card transition-all duration-300 ${
          selected()
            ? "border-primary bg-primary/5 shadow-rail"
            : "border-border/70 hover:border-primary/40"
        } ${props.disabled ? "opacity-70" : ""}`}
      >
        <div class="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-start gap-4 text-left"
            onClick={() => toggleCourse(props.course.id, props.course.isActive)}
            disabled={saving() || currencySaving() || props.disabled}
          >
            <span
              class={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                selected()
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent"
              }`}
            >
              <span class="material-symbols-outlined text-[16px]">check</span>
            </span>
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <div class="text-base font-semibold tracking-[-0.02em] text-foreground">
                  {props.course.title}
                </div>
                <Show when={typeof props.course.lessonCount === "number"}>
                  <SmallStatBadge class="bg-background">
                    {t("student.onboarding.courses.lessonCount", {
                      count: props.course.lessonCount ?? 0,
                    })}
                  </SmallStatBadge>
                </Show>
              </div>
              <p class="max-w-3xl text-sm leading-6 text-muted-foreground">
                {props.course.shortDescription}
              </p>
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {selected()
                  ? t("student.onboarding.courses.selected")
                  : t("student.onboarding.courses.clickToSelect")}
              </div>
            </div>
          </button>

          <div class="flex flex-col items-start gap-3 lg:items-end">
            <div class="text-lg font-semibold text-foreground">
              <Show
                when={isFirstHundred()}
                fallback={formatPrice(props.course.priceUsdCents)}
              >
                <FreePrice usdCents={props.course.priceUsdCents} />
              </Show>
            </div>
            <button
              type="button"
              class={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => toggleExpandedCourse(props.course.id)}
            >
              {expanded()
                ? t("student.onboarding.courses.hideLessons")
                : t("student.onboarding.courses.showLessons")}
            </button>
          </div>
        </div>

        <Show when={expanded()}>
          <div class="border-t border-border/60 px-5 py-4">
            <div class="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-secondary">
              {t("student.onboarding.courses.lessonsTitle")}
            </div>
            <Show when={!lessonsLoading()} fallback={<div class="space-y-2">
              <Skeleton class="h-10 rounded-[var(--radius-md)]" />
              <Skeleton class="h-10 rounded-[var(--radius-md)]" />
            </div>}>
              <Show when={!lessonsError()} fallback={
                <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
                  {lessonsError()}
                </div>
              }>
                <Show
                  when={lessons().length > 0}
                  fallback={
                    <div class="text-sm text-muted-foreground">
                      {t("student.onboarding.courses.lessonsEmpty")}
                    </div>
                  }
                >
                  <div class="space-y-2">
                    <For each={lessons()}>
                      {(lesson, index) => (
                        <div class="flex items-center gap-3 rounded-[var(--radius-md)] bg-[rgba(237,244,255,0.6)] px-4 py-3 text-sm">
                          <span class="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary shadow-sm">
                            {index() + 1}
                          </span>
                          <span class="min-w-0 flex-1 truncate text-foreground">
                            {lesson.title}
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <OnboardingLayout
      step="courses"
      title={t("student.onboarding.courses.title")}
      subtitle={t("student.onboarding.courses.subtitle")}
    >
      <SectionCard
        title={t("student.onboarding.courses.cardTitle")}
        description={t("student.onboarding.courses.cardDescription")}
      >
        <div class="space-y-4">
          <div class="max-w-[220px]">
            <Select
              value={CURRENCY_OPTIONS.find((item) => item.value === preferredCurrency())}
              onChange={(value) => {
                const raw = value?.value;
                if (
                  raw === "USD" ||
                  raw === "EUR" ||
                  raw === "PLN" ||
                  raw === "RUB"
                ) {
                  void updatePreferredCurrency(raw);
                }
              }}
              options={CURRENCY_OPTIONS}
              optionValue={(option) => (option as CurrencyOption).value}
              optionTextValue={(option) => (option as CurrencyOption).label}
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {(props.item.rawValue as CurrencyOption).label}
                </SelectItem>
              )}
              disabled={currencySaving() || saving()}
            >
              <SelectLabel for="onboarding-currency">
                {t("student.onboarding.courses.currencyLabel")}
              </SelectLabel>
              <SelectHiddenSelect id="onboarding-currency" />
              <SelectTrigger aria-label={t("student.onboarding.courses.currencyLabel")}>
                <SelectValue<CurrencyOption>>
                  {(state) =>
                    (state?.selectedOption() as CurrencyOption | undefined)?.label || "USD"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <Show
            when={!loading()}
            fallback={
              <div class="grid gap-3 md:grid-cols-2">
                <Skeleton class="h-28 rounded-xl" />
                <Skeleton class="h-28 rounded-xl" />
                <Skeleton class="h-28 rounded-xl" />
                <Skeleton class="h-28 rounded-xl" />
              </div>
            }
          >
            <Show
              when={!loadError()}
              fallback={
                <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
                  <div>{loadError()}</div>
                  <div class="mt-3">
                    <Button variant="outline" onClick={() => void load({ force: true })}>
                      {t("student.onboarding.courses.retry")}
                    </Button>
                  </div>
                </div>
              }
            >
              <Show
                when={activeCourses().length > 0}
                fallback={
                  <div class="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
                    {t("student.onboarding.courses.empty")}
                  </div>
                }
              >
                <div class="space-y-3">
                  <For each={activeCourses()}>
                    {(course) => <CourseRow course={course} />}
                  </For>
                </div>
              </Show>
              <Show when={inactiveCourses().length > 0}>
                <div class="space-y-2">
                  <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("student.onboarding.courses.inactiveSectionTitle")}
                  </div>
                  <div class="space-y-3">
                    <For each={inactiveCourses()}>
                      {(course) => <CourseRow course={course} disabled />}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </Show>

          <div class="rounded-xl border border-border/70 bg-card p-4">
            <div class="w-full rounded-lg border border-primary bg-primary/5 p-4 text-left">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="font-medium">{t(COMMUNITY_CARD.titleKey)}</div>
                    <SmallStatBadge class="bg-background">
                      <span class="material-symbols-outlined text-[14px]">lock</span>
                      {t("student.onboarding.courses.communityRequiredBadge")}
                    </SmallStatBadge>
                  </div>
                  <div class="mt-1 text-sm text-muted-foreground">
                    {t(COMMUNITY_CARD.descKey)}
                  </div>
                </div>
                <div class="text-sm font-semibold">
                  {formatCents(communityPriceCents(), displayCurrency())}
                </div>
              </div>
              <div class="mt-3 text-xs text-muted-foreground">
                {t("student.onboarding.courses.communityIncludedByDefault")}
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div class="text-sm text-muted-foreground">
              {t("student.onboarding.courses.totalLabel")}
            </div>
            <div class="mt-1 text-xl font-semibold">
              {formatCents(totalPriceCents(), displayCurrency())}
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              as={A}
              href="/onboarding/goal"
              variant="outline"
              disabled={saving() || currencySaving()}
            >
              {t("student.onboarding.profile.back")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void save()}
              disabled={saving() || currencySaving()}
            >
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.profile.submit")}
            </Button>
            <Button
              onClick={() => void next()}
              disabled={
                saving() || currencySaving() || selectedActiveCourseIds().length === 0
              }
            >
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.profile.next")}
            </Button>
          </div>

          <Show when={saveError()}>
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {saveError()}
            </div>
          </Show>
          <Show when={currencyError()}>
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {currencyError()}
            </div>
          </Show>
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
