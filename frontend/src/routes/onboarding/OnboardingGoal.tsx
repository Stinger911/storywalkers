import { createSignal } from "solid-js";

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

export function OnboardingGoal() {
  const auth = useAuth();
  const { t } = useI18n();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [goalId, setGoalId] = createSignal(auth.me()?.selectedGoalId || "");

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await auth.patchMe({ selectedGoalId: goalId().trim() || null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout
      step="goal"
      title={t("student.onboarding.goal.title")}
      subtitle={t("student.onboarding.goal.subtitle")}
    >
      <SectionCard
        title={t("student.onboarding.goal.cardTitle")}
        description={t("student.onboarding.goal.cardDescription")}
      >
        <div class="space-y-4">
          <TextField class="grid gap-2">
            <TextFieldLabel for="onb-goal-id">
              {t("student.onboarding.goal.goalIdLabel")}
            </TextFieldLabel>
            <TextFieldInput
              id="onb-goal-id"
              value={goalId()}
              onInput={(event) => setGoalId(event.currentTarget.value)}
              placeholder={t("student.onboarding.goal.goalIdPlaceholder")}
            />
          </TextField>
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
