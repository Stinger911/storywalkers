import { A, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { Skeleton } from "../../components/ui/skeleton";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { listCourses, type Course } from "../../lib/coursesApi";
import { OnboardingLayout } from "./OnboardingLayout";

const COMMUNITY_CARD = {
  id: "community",
  titleKey: "student.onboarding.courses.communityTitle",
  descKey: "student.onboarding.courses.communityDescription",
  price: 19,
} as const;

export function OnboardingCourses() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [courses, setCourses] = createSignal<Course[]>([]);

  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);

  const [selectedCourses, setSelectedCourses] = createSignal<string[]>(
    auth.me()?.selectedCourses || [],
  );
  const [communitySelected, setCommunitySelected] = createSignal(
    Boolean(auth.me()?.subscriptionSelected),
  );

  const totalPrice = createMemo(() => {
    const selected = new Set(selectedCourses());
    const coursesTotal = courses()
      .filter((course) => course.isActive)
      .filter((course) => selected.has(course.id))
      .reduce((sum, course) => sum + course.price, 0);
    return coursesTotal + (communitySelected() ? COMMUNITY_CARD.price : 0);
  });

  const activeCourses = createMemo(() => courses().filter((course) => course.isActive));
  const inactiveCourses = createMemo(() =>
    courses().filter((course) => !course.isActive),
  );
  const selectedActiveCourseIds = createMemo(() => {
    const activeIds = new Set(activeCourses().map((course) => course.id));
    return selectedCourses().filter((id) => activeIds.has(id));
  });

  const toggleCourse = (courseId: string, isActive: boolean) => {
    if (saving()) return;
    if (!isActive) return;
    setSelectedCourses((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId],
    );
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
      const response = await listCourses(options);
      setCourses(response.items);
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
        subscriptionSelected: communitySelected() || undefined,
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
    if (ok) {
      void navigate("/onboarding/checkout");
    }
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
                <div class="grid gap-3 md:grid-cols-2">
                  <For each={activeCourses()}>
                    {(course) => {
                      const selected = () => selectedCourses().includes(course.id);
                      return (
                        <button
                          class={`rounded-xl border p-4 text-left transition-colors ${
                            selected()
                              ? "border-primary bg-primary/5"
                              : "border-border/70 bg-card hover:border-primary/50"
                          }`}
                          onClick={() => toggleCourse(course.id, course.isActive)}
                          disabled={saving()}
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <div class="font-medium">{course.title}</div>
                              <div class="mt-1 text-sm text-muted-foreground">
                                {course.shortDescription}
                              </div>
                            </div>
                            <div class="text-sm font-semibold">
                              ${course.price}
                            </div>
                          </div>
                          <div class="mt-3 text-xs text-muted-foreground">
                            {selected()
                              ? t("student.onboarding.courses.selected")
                              : t("student.onboarding.courses.clickToSelect")}
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
              <Show when={inactiveCourses().length > 0}>
                <div class="space-y-2">
                  <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("student.onboarding.courses.inactiveSectionTitle")}
                  </div>
                  <div class="grid gap-3 md:grid-cols-2">
                    <For each={inactiveCourses()}>
                      {(course) => (
                        <div class="rounded-xl border border-border/60 bg-muted/30 p-4 opacity-80">
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <div class="font-medium">{course.title}</div>
                              <div class="mt-1 text-sm text-muted-foreground">
                                {course.shortDescription}
                              </div>
                            </div>
                            <div class="text-sm font-semibold">${course.price}</div>
                          </div>
                          <div class="mt-3 text-xs text-muted-foreground">
                            {t("student.onboarding.courses.inactiveBadge")}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </Show>

          <div class="rounded-xl border border-border/70 bg-card p-4">
            <button
              class={`w-full rounded-lg border p-4 text-left transition-colors ${
                communitySelected()
                  ? "border-primary bg-primary/5"
                  : "border-border/70 hover:border-primary/50"
              }`}
              onClick={() => setCommunitySelected((prev) => !prev)}
              disabled={saving()}
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-medium">{t(COMMUNITY_CARD.titleKey)}</div>
                  <div class="mt-1 text-sm text-muted-foreground">
                    {t(COMMUNITY_CARD.descKey)}
                  </div>
                </div>
                <div class="text-sm font-semibold">${COMMUNITY_CARD.price}</div>
              </div>
              <div class="mt-3 text-xs text-muted-foreground">
                {communitySelected()
                  ? t("student.onboarding.courses.selected")
                  : t("student.onboarding.courses.clickToSelect")}
              </div>
            </button>
          </div>

          <div class="rounded-xl border border-border/70 bg-muted/30 p-4">
            <div class="text-sm text-muted-foreground">
              {t("student.onboarding.courses.totalLabel")}
            </div>
            <div class="mt-1 text-xl font-semibold">${totalPrice()}</div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button as={A} href="/onboarding/profile" variant="outline" disabled={saving()}>
              {t("student.onboarding.profile.back")}
            </Button>
            <Button variant="outline" onClick={() => void save()} disabled={saving()}>
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.profile.submit")}
            </Button>
            <Button onClick={() => void next()} disabled={saving() || selectedActiveCourseIds().length === 0}>
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
