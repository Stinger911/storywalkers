import { useNavigate } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  Show,
} from "solid-js";

import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../../lib/auth";
import { formatCents } from "../../lib/coursesApi";
import { useI18n } from "../../lib/i18n";
import {
  getOnboardingPlan,
  type PlanCourse,
} from "../../lib/publicOnboardingApi";
import { StartLayout } from "./StartLayout";
import { ButtonRow, StartButton, StartCheckbox, StartError, StartOption } from "./StartUi";
import {
  canAccessStep,
  readDraft,
  startPath,
  writeDraft,
  type DraftLesson,
  type StartDraft,
} from "./startDraft";

type PathTab = "courses" | "path";

function perLessonCents(course: PlanCourse): number | null {
  if (course.priceUsdCents === null || course.lessonCount <= 0) return null;
  return Math.round(course.priceUsdCents / course.lessonCount);
}

export function StartPlan() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const auth = useAuth();

  const initial = readDraft();
  if (!canAccessStep(initial, "plan")) {
    navigate(startPath(initial.hasChannel === null ? "channel" : "goal"), {
      replace: true,
    });
  }

  const [draft, setDraft] = createSignal<StartDraft>(initial);
  const isExpertTrack = () => draft().hasChannel === true;
  const update = (patch: Partial<StartDraft>) => setDraft(writeDraft(patch));

  // Selecting courses rewrites the draft; the plan is refetched only when the
  // parameters it depends on change.
  const planParams = createMemo(
    () => (isExpertTrack() ? null : { goal: draft().goalSlug, format: draft().format }),
    undefined,
    { equals: (a, b) => a?.goal === b?.goal && a?.format === b?.format },
  );
  const [plan, { refetch }] = createResource(planParams, getOnboardingPlan);

  const [tab, setTab] = createSignal<PathTab>("courses");
  const [openCourse, setOpenCourse] = createSignal<string | null>(null);
  const [individual, setIndividual] = createSignal<Record<string, boolean>>(
    Object.fromEntries(initial.selectedLessons.map((item) => [item.courseId, true])),
  );
  const [error, setError] = createSignal<string | null>(null);

  // Reading a failed resource throws in Solid, so every read goes through here.
  const loadedPlan = () => (plan.error ? undefined : plan());
  const courses = () => loadedPlan()?.courses ?? [];

  // The whole path is preselected when the plan arrives. `on` keeps the effect
  // from tracking the selection, so clearing it stays cleared.
  createEffect(
    on(loadedPlan, (loaded) => {
      if (!loaded || isExpertTrack()) return;
      const current = draft();
      if (current.selectedCourses.length > 0 || current.selectedLessons.length > 0) return;
      update({ selectedCourses: loaded.courses.map((course) => course.id) });
    }),
  );

  const isCourseSelected = (id: string) => draft().selectedCourses.includes(id);
  const lessonIds = (courseId: string) =>
    draft()
      .selectedLessons.filter((item) => item.courseId === courseId)
      .map((item) => item.lessonId);

  const toggleCourse = (courseId: string) => {
    setError(null);
    const selected = isCourseSelected(courseId);
    update({
      selectedCourses: selected
        ? draft().selectedCourses.filter((id) => id !== courseId)
        : [...draft().selectedCourses, courseId],
      selectedLessons: draft().selectedLessons.filter((item) => item.courseId !== courseId),
    });
    setIndividual((current) => ({ ...current, [courseId]: false }));
  };

  const toggleIndividual = (courseId: string) => {
    setError(null);
    const next = !individual()[courseId];
    setIndividual((current) => ({ ...current, [courseId]: next }));
    if (next) {
      setOpenCourse(courseId);
      update({ selectedCourses: draft().selectedCourses.filter((id) => id !== courseId) });
    } else {
      update({
        selectedLessons: draft().selectedLessons.filter((item) => item.courseId !== courseId),
      });
    }
  };

  const toggleLesson = (courseId: string, lessonId: string) => {
    setError(null);
    const exists = lessonIds(courseId).includes(lessonId);
    const nextLessons: DraftLesson[] = exists
      ? draft().selectedLessons.filter(
          (item) => item.courseId !== courseId || item.lessonId !== lessonId,
        )
      : [...draft().selectedLessons, { courseId, lessonId }];
    update({
      selectedLessons: nextLessons,
      selectedCourses: draft().selectedCourses.filter((id) => id !== courseId),
    });
  };

  const hasSelection = () =>
    draft().selectedCourses.length > 0 || draft().selectedLessons.length > 0;

  const totalCents = createMemo(() => {
    let sum = 0;
    for (const course of courses()) {
      if (isCourseSelected(course.id)) sum += course.priceUsdCents ?? 0;
      else sum += (perLessonCents(course) ?? 0) * lessonIds(course.id).length;
    }
    return sum;
  });

  const pathItems = createMemo(() =>
    courses()
      .map((course) => ({
        course,
        whole: isCourseSelected(course.id),
        lessons: course.lessons.filter((lesson) => lessonIds(course.id).includes(lesson.id)),
      }))
      .filter((item) => item.whole || item.lessons.length > 0),
  );

  const register = () => {
    if (!isExpertTrack() && !hasSelection()) {
      setError(t("start.plan.selectAtLeastOne"));
      return;
    }
    navigate("/login");
  };

  const price = (cents: number | null) => (cents === null ? "" : formatCents(cents, "USD"));

  return (
    <StartLayout
      step="plan"
      draft={draft()}
      title={isExpertTrack() ? t("start.plan.expertTitle") : t("start.plan.title")}
      subtitle={isExpertTrack() ? t("start.plan.expertBody") : t("start.plan.subtitle")}
    >
      <Show when={!isExpertTrack()}>
        <div class="st-card st-card-fill flex items-center justify-between gap-4 px-8 py-5">
          <span class="st-display text-lg">{t("start.plan.goalLabel")}</span>
          <span class="text-sm font-bold">{t("start.plan.goalValue")}</span>
        </div>

        <div class="grid grid-cols-2 gap-3" role="tablist">
          <StartOption
            role="tab"
            aria-selected={tab() === "courses"}
            selected={tab() === "courses"}
            onClick={() => setTab("courses")}
          >
            {t("start.plan.tabCourses")}
          </StartOption>
          <StartOption
            role="tab"
            aria-selected={tab() === "path"}
            selected={tab() === "path"}
            onClick={() => setTab("path")}
          >
            {t("start.plan.tabPath")}
          </StartOption>
        </div>

        <Show
          when={!plan.loading}
          fallback={
            <div class="space-y-3">
              <Skeleton class="h-24 rounded-md" />
              <Skeleton class="h-24 rounded-md" />
            </div>
          }
        >
          <Show
            when={!plan.error}
            fallback={
              <div class="space-y-3 text-center">
                <p class="st-lead">{t("start.plan.loadError")}</p>
                <StartButton variant="secondary" onClick={() => void refetch()}>
                  {t("start.plan.retry")}
                </StartButton>
              </div>
            }
          >
            <Show
              when={courses().length > 0}
              fallback={<p class="st-lead">{t("start.plan.empty")}</p>}
            >
              <Show
                when={tab() === "courses"}
                fallback={
                  <Show
                    when={pathItems().length > 0}
                    fallback={<p class="st-lead">{t("start.plan.pathEmpty")}</p>}
                  >
                    <ol class="st-path">
                      <For each={pathItems()}>
                        {(item) => (
                          <li class="st-path-node">
                            <div class="text-sm font-bold">{item.course.title}</div>
                            <ul class="mt-2 space-y-1 text-xs">
                              <For each={item.whole ? item.course.lessons : item.lessons}>
                                {(lesson) => <li>{lesson.title}</li>}
                              </For>
                            </ul>
                          </li>
                        )}
                      </For>
                    </ol>
                  </Show>
                }
              >
                <div class="space-y-3">
                  <For each={courses()}>
                    {(course) => {
                      const open = () => openCourse() === course.id;
                      const isIndividual = () => individual()[course.id] === true;
                      const unit = perLessonCents(course);
                      return (
                        <section
                          class="st-course"
                          data-selected={isCourseSelected(course.id) || lessonIds(course.id).length > 0}
                        >
                          <div class="flex flex-wrap items-center gap-3 px-6 py-4">
                            {/* The title takes its own row: real course names are long. */}
                            <label class="flex w-full cursor-pointer items-center gap-3">
                              <StartCheckbox
                                checked={isCourseSelected(course.id)}
                                onChange={() => toggleCourse(course.id)}
                                aria-label={course.title}
                              />
                              <h2 class="min-w-0 break-words text-sm font-bold">{course.title}</h2>
                            </label>
                            <span class="rounded-full border border-[var(--st-line)] bg-[#f4f4f4] px-3 py-1 text-[0.65rem]">
                              {t("start.plan.lessonsCount", { count: course.lessonCount })}
                            </span>
                            <Show when={course.priceUsdCents !== null}>
                              <span class="text-xs font-bold">{price(course.priceUsdCents)}</span>
                            </Show>
                            <Show when={unit !== null}>
                              <StartButton
                                variant="small"
                                aria-pressed={isIndividual()}
                                onClick={() => toggleIndividual(course.id)}
                              >
                                {isIndividual()
                                  ? t("start.plan.wholeCourse")
                                  : t("start.plan.individualLessons")}
                              </StartButton>
                            </Show>
                            <StartButton
                              variant="small"
                              aria-pressed={open()}
                              aria-expanded={open()}
                              onClick={() => setOpenCourse(open() ? null : course.id)}
                            >
                              {open() ? t("start.plan.hidePath") : t("start.plan.showPath")}
                            </StartButton>
                          </div>
                          <Show when={open() || isIndividual()}>
                            <ol class="st-enter divide-y divide-[var(--st-line)] border-t border-[var(--st-line)] bg-[var(--st-surface)] px-10 py-1">
                              <For each={course.lessons}>
                                {(lesson, index) => (
                                  <li class="flex items-center gap-3 py-3 text-xs">
                                    <Show when={isIndividual()}>
                                      <StartCheckbox
                                        checked={lessonIds(course.id).includes(lesson.id)}
                                        onChange={() => toggleLesson(course.id, lesson.id)}
                                        aria-label={lesson.title}
                                      />
                                    </Show>
                                    <span class="inline-flex size-5 flex-none items-center justify-center rounded-full border border-[var(--st-line)] text-[0.6rem] text-[var(--st-muted)]">
                                      {index() + 1}
                                    </span>
                                    <span class="min-w-0 flex-1">{lesson.title}</span>
                                    <Show when={isIndividual() && unit !== null}>
                                      <span class="flex-none text-[var(--st-muted)]">
                                        {price(unit)} {t("start.plan.perLesson")}
                                      </span>
                                    </Show>
                                  </li>
                                )}
                              </For>
                            </ol>
                          </Show>
                        </section>
                      );
                    }}
                  </For>
                </div>
                <Show when={(loadedPlan()?.excludedTags.length ?? 0) > 0}>
                  <p class="st-lead text-[var(--st-muted)]">{t("start.plan.excludedNote")}</p>
                </Show>
              </Show>

              <div class="flex items-center justify-between rounded-md border border-[var(--st-line)] bg-[var(--st-surface)] px-6 py-4">
                <span class="text-xs uppercase tracking-[0.1em]">{t("start.plan.total")}</span>
                <span class="st-display text-lg text-[var(--st-red)]">{price(totalCents())}</span>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>

      <Show when={error()}>
        <StartError>{error()}</StartError>
      </Show>

      <ButtonRow>
        <StartButton variant="secondary" onClick={() => navigate(startPath("goal"))}>
          {t("start.plan.back")}
        </StartButton>
        {/* /login saves the answers; a signed-in student passes straight through. */}
        <StartButton onClick={register}>
          {auth.me() ? t("start.plan.continue") : t("start.plan.register")}
        </StartButton>
      </ButtonRow>
    </StartLayout>
  );
}
