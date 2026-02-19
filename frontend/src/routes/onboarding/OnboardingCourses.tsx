import { createSignal, For, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

export function OnboardingCourses() {
  const auth = useAuth();
  const { t } = useI18n();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [newCourseId, setNewCourseId] = createSignal("");
  const [selectedCourses, setSelectedCourses] = createSignal<string[]>(
    auth.me()?.selectedCourses || [],
  );

  const addCourse = () => {
    const courseId = newCourseId().trim();
    if (!courseId) return;
    if (selectedCourses().includes(courseId)) return;
    setSelectedCourses((prev) => [...prev, courseId]);
    setNewCourseId("");
  };

  const removeCourse = (id: string) => {
    setSelectedCourses((prev) => prev.filter((value) => value !== id));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await auth.patchMe({ selectedCourses: selectedCourses() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      step="courses"
      title={t("student.onboarding.courses.title")}
      subtitle={t("student.onboarding.courses.subtitle")}
    >
      <SectionCard title={t("student.onboarding.courses.cardTitle")}>
        <div class="space-y-4">
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-course-id">
              {t("student.onboarding.courses.courseIdLabel")}
            </TextFieldLabel>
            <div class="flex gap-2">
              <TextFieldInput
                id="onb-course-id"
                value={newCourseId()}
                onInput={(event) => setNewCourseId(event.currentTarget.value)}
                placeholder={t("student.onboarding.courses.courseIdPlaceholder")}
              />
              <Button variant="outline" onClick={addCourse}>
                {t("student.onboarding.courses.addButton")}
              </Button>
            </div>
          </TextField>

          <div class="rounded-md border border-border/70 p-3">
            <Show
              when={selectedCourses().length > 0}
              fallback={
                <div class="text-sm text-muted-foreground">
                  {t("student.onboarding.courses.empty")}
                </div>
              }
            >
              <div class="flex flex-wrap gap-2">
                <For each={selectedCourses()}>
                  {(courseId) => (
                    <button
                      class="rounded-full border border-border bg-muted px-3 py-1 text-xs hover:bg-accent"
                      onClick={() => removeCourse(courseId)}
                      title={t("student.onboarding.courses.removeTitle")}
                    >
                      {courseId} ×
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="flex gap-2">
            <Button onClick={() => void save()} disabled={saving()}>
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.common.saveAndContinue")}
            </Button>
          </div>

          {error() ? (
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {error()}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
