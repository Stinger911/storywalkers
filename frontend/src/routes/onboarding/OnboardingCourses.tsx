import { useNavigate } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";

import { Button, buttonVariants } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { SectionCard } from "../../components/ui/section-card";
import { SmallStatBadge } from "../../components/ui/small-stat-badge";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../../lib/auth";
import {
  listCourseLessons,
  listCourses,
  type CourseLesson,
  type Course,
} from "../../lib/coursesApi";
import { listGoals, type Goal } from "../../lib/adminApi";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";
import { writeCachedOnboardingGoal } from "./onboardingState";

type PathTab = "courses" | "path";

function answerToText(value: string | string[]) {
  return Array.isArray(value) ? value.join(", ") : value;
}

export function OnboardingCourses() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [courses, setCourses] = createSignal<Course[]>([]);
  const [goals, setGoals] = createSignal<Goal[]>([]);
  const [activeTab, setActiveTab] = createSignal<PathTab>("courses");
  const [expandedCourseId, setExpandedCourseId] = createSignal<string | null>(null);
  const [lessonsByCourse, setLessonsByCourse] = createSignal<Record<string, CourseLesson[]>>({});
  const [lessonLoadingByCourse, setLessonLoadingByCourse] = createSignal<Record<string, boolean>>({});
  const [lessonErrorByCourse, setLessonErrorByCourse] = createSignal<Record<string, string | null>>({});
  const selectedGoalId = createMemo(() => auth.me()?.selectedGoalId || null);

  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [selectedCourses, setSelectedCourses] = createSignal<string[]>(
    auth.me()?.selectedCourses || [],
  );

  const selectedGoal = createMemo(() =>
    goals().find((goal) => goal.id === selectedGoalId()) || null,
  );

  const activeCourses = createMemo(() => courses().filter((course) => course.isActive));
  const selectedActiveCourseIds = createMemo(() => {
    const activeIds = new Set(activeCourses().map((course) => course.id));
    return selectedCourses().filter((id) => activeIds.has(id));
  });
  const selectedCourseItems = createMemo(() => {
    const selected = new Set(selectedActiveCourseIds());
    return activeCourses().filter((course) => selected.has(course.id));
  });

  const answerSummary = createMemo(() => {
    const stored = auth.me()?.goalIntakeAnswers;
    const goal = selectedGoal();
    if (!stored || stored.goalId !== selectedGoalId()) return [];
    return stored.answers
      .map((answer) => {
        const question = goal?.intakeQuestions?.find((item) => item.id === answer.questionId);
        return {
          label: question?.label || answer.questionId,
          value: answerToText(answer.value),
        };
      })
      .filter((item) => item.value.trim().length > 0);
  });

  const toggleCourse = (courseId: string, isActive: boolean) => {
    if (saving() || !isActive) return;
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

  const formatError = (err: unknown, fallback: string) => {
    const message = (err as Error).message?.trim();
    if (!message || message.toLowerCase() === "request failed") return fallback;
    return `${fallback} ${message}`;
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

  const load = async (options?: { force?: boolean }) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [courseResponse, goalResponse] = await Promise.all([
        listCourses({ ...options, goalId: selectedGoalId() }),
        listGoals(),
      ]);
      setCourses(courseResponse.items);
      setGoals(goalResponse.items);
    } catch (err) {
      setLoadError(formatError(err, t("student.onboarding.courses.loadError")));
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const currentGoalId = auth.me()?.selectedGoalId;
    if (currentGoalId) {
      writeCachedOnboardingGoal({
        goalId: currentGoalId,
        goalTitle: auth.me()?.selectedGoalTitle || null,
      });
    }
  });

  createEffect(() => {
    if (!selectedGoalId()) return;
    void load();
  });

  const save = async (): Promise<boolean> => {
    if (!selectedGoalId()) {
      setSaveError(t("student.onboarding.courses.goalMissing"));
      return false;
    }
    if (selectedActiveCourseIds().length === 0) {
      setSaveError(t("student.onboarding.courses.selectAtLeastOne"));
      return false;
    }
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

  const next = async () => {
    const ok = await save();
    if (ok) void navigate("/onboarding/checkout");
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
            disabled={saving() || props.disabled}
          >
            <span
              class={`mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border ${
                selected()
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent"
              }`}
            >
              <Icon name="check" class="text-[16px]" />
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

          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <Show when={props.course.trialLessonUrl}>
              <a
                class={buttonVariants({ variant: "outline", size: "sm" })}
                href={props.course.trialLessonUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {t("student.onboarding.courses.trialLesson")}
              </a>
            </Show>
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
        <div class="space-y-5">
          <div class="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div class="text-sm text-muted-foreground">
              {t("student.onboarding.courses.goalSummaryTitle")}
            </div>
            <div class="mt-1 text-lg font-semibold text-foreground">
              {selectedGoal()?.title || auth.me()?.selectedGoalTitle || selectedGoalId() || t("student.onboarding.checkout.goalEmpty")}
            </div>
            <Show when={answerSummary().length > 0}>
              <div class="mt-3 grid gap-2 text-sm">
                <For each={answerSummary()}>
                  {(item) => (
                    <div class="rounded-md border border-border/70 bg-card px-3 py-2">
                      <span class="text-muted-foreground">{item.label}: </span>
                      <span>{item.value}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="inline-flex rounded-full border border-border/70 bg-muted/30 p-1 text-sm">
            <button
              type="button"
              class={`rounded-full px-4 py-2 ${activeTab() === "courses" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("courses")}
            >
              {t("student.onboarding.courses.tabCourses")}
            </button>
            <button
              type="button"
              class={`rounded-full px-4 py-2 ${activeTab() === "path" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setActiveTab("path")}
            >
              {t("student.onboarding.courses.tabPath")}
            </button>
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
                when={activeTab() === "courses"}
                fallback={
                  <Show
                    when={selectedCourseItems().length > 0}
                    fallback={<div class="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">{t("student.onboarding.courses.selectAtLeastOne")}</div>}
                  >
                    <div class="space-y-3">
                      <For each={selectedCourseItems()}>
                        {(course) => <CourseRow course={course} />}
                      </For>
                    </div>
                  </Show>
                }
              >
                <Show
                  when={activeCourses().length > 0}
                  fallback={
                    <div class="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
                      {selectedGoalId()
                        ? t("student.onboarding.courses.empty")
                        : t("student.onboarding.courses.goalMissing")}
                    </div>
                  }
                >
                  <div class="space-y-3">
                    <For each={activeCourses()}>
                      {(course) => <CourseRow course={course} />}
                    </For>
                  </div>
                </Show>
              </Show>
            </Show>
          </Show>

          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saving()}
              onClick={() => void navigate("/onboarding/profile")}
            >
              {t("student.onboarding.profile.back")}
            </Button>
            <Button
              variant="outline"
              onClick={() => void save()}
              disabled={saving() || !selectedGoalId() || selectedActiveCourseIds().length === 0}
            >
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.profile.submit")}
            </Button>
            <Button
              onClick={() => void next()}
              disabled={saving() || !selectedGoalId() || selectedActiveCourseIds().length === 0}
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
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
