import { useNavigate } from "@solidjs/router";
import { createSignal, For } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { OnboardingLayout } from "./OnboardingLayout";

export function OnboardingCheckout() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const me = () => auth.me();

  const complete = async () => {
    setSaving(true);
    setError(null);
    try {
      await auth.patchMe({ subscriptionSelected: true });
      void navigate("/student/home");
    } catch (err) {
      setError((err as Error).message);
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
      <SectionCard title={t("student.onboarding.checkout.cardTitle")}>
        <div class="space-y-3 text-sm">
          <div>
            <span class="text-muted-foreground">
              {t("student.onboarding.checkout.goalLabel")}
            </span>{" "}
            <span class="font-medium">{me()?.selectedGoalId || "-"}</span>
          </div>
          <div>
            <span class="text-muted-foreground">
              {t("student.onboarding.checkout.experienceLabel")}
            </span>{" "}
            <span class="font-medium">{me()?.profileForm?.experienceLevel || "-"}</span>
          </div>
          <div>
            <span class="text-muted-foreground">
              {t("student.onboarding.checkout.coursesLabel")}
            </span>
            <div class="mt-2 flex flex-wrap gap-2">
              <For each={me()?.selectedCourses || []}>
                {(courseId) => (
                  <span class="rounded-full border border-border bg-muted px-3 py-1 text-xs">
                    {courseId}
                  </span>
                )}
              </For>
              {(me()?.selectedCourses || []).length === 0 ? (
                <span class="text-muted-foreground">
                  {t("student.onboarding.checkout.coursesEmpty")}
                </span>
              ) : null}
            </div>
          </div>
          <div class="pt-2">
            <Button onClick={() => void complete()} disabled={saving()}>
              {saving()
                ? t("student.onboarding.common.saving")
                : t("student.onboarding.checkout.completeButton")}
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
