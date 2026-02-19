import { A } from "@solidjs/router";
import { createSignal, For, onMount, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { listGoals, type Goal } from "../../lib/adminApi";
import { OnboardingLayout } from "./OnboardingLayout";

export function OnboardingGoal() {
  const auth = useAuth();
  const { t } = useI18n();
  const [loading, setLoading] = createSignal(true);
  const [goals, setGoals] = createSignal<Goal[]>([]);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = createSignal(
    auth.me()?.selectedGoalId || "",
  );

  const toHumanError = (err: unknown, fallbackKey: string) => {
    const msg = (err as Error).message?.trim();
    if (!msg || msg.toLowerCase() === "request failed") {
      return t(fallbackKey);
    }
    return `${t(fallbackKey)} ${msg}`;
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await listGoals();
      setGoals(response.items);
    } catch (err) {
      setLoadError(toHumanError(err, "student.onboarding.goal.loadError"));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void load();
  });

  const selectGoal = async (goalId: string) => {
    if (saving()) return;
    const prev = selectedGoalId();
    setSelectedGoalId(goalId);
    setSaveError(null);
    setSaving(true);
    try {
      await auth.patchMe({ selectedGoalId: goalId });
    } catch (err) {
      setSelectedGoalId(prev);
      setSaveError(toHumanError(err, "student.onboarding.goal.saveError"));
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
          <Show when={!loading()} fallback={<div class="text-sm text-muted-foreground">{t("common.loading")}</div>}>
            <Show
              when={!loadError()}
              fallback={
                <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
                  <div>{loadError()}</div>
                  <div class="mt-3">
                    <Button variant="outline" onClick={() => void load()}>
                      {t("student.onboarding.goal.retry")}
                    </Button>
                  </div>
                </div>
              }
            >
              <Show
                when={goals().length > 0}
                fallback={
                  <div class="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
                    {t("student.onboarding.goal.empty")}
                  </div>
                }
              >
                <div class="grid gap-3 md:grid-cols-2">
                  <For each={goals()}>
                    {(goal) => {
                      const selected = () => selectedGoalId() === goal.id;
                      return (
                        <button
                          class={`rounded-xl border p-4 text-left transition-colors ${
                            selected()
                              ? "border-primary bg-primary/5"
                              : "border-border/70 bg-card hover:border-primary/50"
                          }`}
                          onClick={() => void selectGoal(goal.id)}
                          disabled={saving()}
                        >
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <div class="font-medium">{goal.title}</div>
                              <div class="mt-1 text-sm text-muted-foreground">
                                {goal.description || t("student.onboarding.goal.noDescription")}
                              </div>
                            </div>
                            <Show when={selected()}>
                              <span class="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
                                {t("student.onboarding.goal.selectedBadge")}
                              </span>
                            </Show>
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </Show>
          </Show>

          <div class="flex gap-2">
            <Button
              as={A}
              href="/onboarding/profile"
              disabled={saving() || !selectedGoalId()}
            >
              {saving() ? t("student.onboarding.common.saving") : t("student.onboarding.goal.next")}
            </Button>
          </div>
          {saveError() ? (
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {saveError()}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </OnboardingLayout>
  );
}
