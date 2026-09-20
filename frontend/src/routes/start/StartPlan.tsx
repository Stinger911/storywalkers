import { useNavigate } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { Skeleton } from "../../components/ui/skeleton";
import { useI18n } from "../../lib/i18n";
import { getOnboardingPlan } from "../../lib/publicOnboardingApi";
import { StartLayout } from "./StartLayout";
import { canAccessStep, readDraft, startPath, type StartDraft } from "./startDraft";

export function StartPlan() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const initial = readDraft();
  if (!canAccessStep(initial, "plan")) {
    navigate(startPath(initial.hasChannel === null ? "channel" : "goal"), {
      replace: true,
    });
  }

  const [draft] = createSignal<StartDraft>(initial);
  const isExpertTrack = () => draft().hasChannel === true;

  const [plan, { refetch }] = createResource(
    () => (isExpertTrack() ? null : { goal: draft().goalSlug, format: draft().format }),
    (params) => (params ? getOnboardingPlan(params) : null),
  );

  return (
    <StartLayout
      step="plan"
      draft={draft()}
      title={isExpertTrack() ? t("start.plan.expertTitle") : t("start.plan.title")}
      subtitle={isExpertTrack() ? undefined : t("start.plan.subtitle")}
    >
      <Show
        when={!isExpertTrack()}
        fallback={
          <SectionCard title={t("start.plan.expertTitle")}>
            <p class="text-sm leading-6 text-muted-foreground">
              {t("start.plan.expertBody")}
            </p>
          </SectionCard>
        }
      >
        <Show
          when={!plan.loading}
          fallback={
            <div class="space-y-3">
              <Skeleton class="h-24 rounded-xl" />
              <Skeleton class="h-24 rounded-xl" />
            </div>
          }
        >
          <Show
            when={!plan.error}
            fallback={
              <SectionCard title={t("start.plan.loadError")}>
                <Button variant="outline" onClick={() => void refetch()}>
                  {t("start.plan.retry")}
                </Button>
              </SectionCard>
            }
          >
            <Show
              when={(plan()?.courses.length ?? 0) > 0}
              fallback={
                <SectionCard title={t("start.plan.empty")}>
                  <span />
                </SectionCard>
              }
            >
              <For each={plan()?.courses ?? []}>
                {(course) => (
                  <SectionCard
                    title={course.title}
                    description={`${course.lessonCount} ${t("start.plan.lessonsSuffix")}`}
                  >
                    <ol class="space-y-2">
                      <For each={course.lessons}>
                        {(lesson, index) => (
                          <li class="flex items-center gap-3 rounded-[var(--radius-md)] bg-muted/30 px-3 py-2 text-sm">
                            <span class="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-card text-[11px] font-bold text-primary">
                              {index() + 1}
                            </span>
                            <span class="min-w-0 flex-1">{lesson.title}</span>
                          </li>
                        )}
                      </For>
                    </ol>
                  </SectionCard>
                )}
              </For>
              <Show when={(plan()?.excludedTags.length ?? 0) > 0}>
                <p class="text-sm text-muted-foreground">
                  {t("start.plan.excludedNote")}
                </p>
              </Show>
            </Show>
          </Show>
        </Show>
      </Show>

      <div class="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate(startPath("goal"))}>
          {t("start.plan.back")}
        </Button>
        <Button onClick={() => navigate("/login")}>{t("start.plan.register")}</Button>
      </div>
    </StartLayout>
  );
}
