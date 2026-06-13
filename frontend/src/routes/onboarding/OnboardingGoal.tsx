import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Match, onCleanup, onMount, Show, Switch } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { useAuth, type GoalIntakeAnswer } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { listGoals, type Goal, type GoalIntakeQuestion } from "../../lib/adminApi";
import { OnboardingLayout } from "./OnboardingLayout";
import { writeCachedOnboardingGoal } from "./onboardingState";

type AnswerValue = string | string[];

function answerIsFilled(value: AnswerValue | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

function formatAnswer(question: GoalIntakeQuestion, value: AnswerValue | undefined): GoalIntakeAnswer | null {
  if (!answerIsFilled(value)) return null;
  return {
    questionId: question.id,
    type: question.type,
    value: Array.isArray(value) ? value : value?.trim() || "",
  };
}

export function OnboardingGoal() {
  const auth = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = createSignal(true);
  const [goals, setGoals] = createSignal<Goal[]>([]);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [saveError, setSaveError] = createSignal<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = createSignal(
    auth.me()?.selectedGoalId || "",
  );
  const [answers, setAnswers] = createSignal<Record<string, AnswerValue>>({});
  const [quoteIndex, setQuoteIndex] = createSignal(0);

  const quotes = createMemo(() => [
    t("student.onboarding.goal.quote1"),
    t("student.onboarding.goal.quote2"),
    t("student.onboarding.goal.quote3"),
  ]);

  const selectedGoal = createMemo(() =>
    goals().find((goal) => goal.id === selectedGoalId()) || null,
  );

  const questions = createMemo(() =>
    [...(selectedGoal()?.intakeQuestions ?? [])]
      .filter((question) => question.isActive !== false)
      .sort((a, b) => a.order - b.order),
  );

  const toHumanError = (err: unknown, fallbackKey: string) => {
    const msg = (err as Error).message?.trim();
    if (!msg || msg.toLowerCase() === "request failed") {
      return t(fallbackKey);
    }
    return `${t(fallbackKey)} ${msg}`;
  };

  const hydrateAnswers = (goalId: string) => {
    const stored = auth.me()?.goalIntakeAnswers;
    if (!stored || stored.goalId !== goalId) {
      setAnswers({});
      return;
    }
    const next: Record<string, AnswerValue> = {};
    for (const answer of stored.answers || []) {
      next[answer.questionId] = answer.value;
    }
    setAnswers(next);
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await listGoals();
      setGoals(response.items);
      const currentGoalId = selectedGoalId();
      if (currentGoalId) hydrateAnswers(currentGoalId);
    } catch (err) {
      setLoadError(toHumanError(err, "student.onboarding.goal.loadError"));
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void load();
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % quotes().length);
    }, 5200);
    onCleanup(() => window.clearInterval(timer));
  });

  const selectGoal = (goalId: string) => {
    if (saving()) return;
    setSelectedGoalId(goalId);
    setSaveError(null);
    hydrateAnswers(goalId);
  };

  const setTextAnswer = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const toggleOption = (questionId: string, option: string) => {
    setAnswers((current) => {
      const raw = current[questionId];
      const list = Array.isArray(raw) ? raw : [];
      return {
        ...current,
        [questionId]: list.includes(option)
          ? list.filter((item) => item !== option)
          : [...list, option],
      };
    });
  };

  const saveAndContinue = async () => {
    const goal = selectedGoal();
    if (!goal) return;
    const missing = questions().find(
      (question) => question.required && !answerIsFilled(answers()[question.id]),
    );
    if (missing) {
      setSaveError(t("student.onboarding.goal.requiredError"));
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const answerList = questions()
        .map((question) => formatAnswer(question, answers()[question.id]))
        .filter((item): item is GoalIntakeAnswer => Boolean(item));
      await auth.patchMe({
        selectedGoalId: goal.id,
        goalIntakeAnswers: { goalId: goal.id, answers: answerList },
      });
      writeCachedOnboardingGoal({ goalId: goal.id, goalTitle: goal.title || null });
      void navigate("/onboarding/profile");
    } catch (err) {
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
        <div class="space-y-5">
          <div class="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm italic leading-6 text-muted-foreground transition-opacity duration-500">
            {quotes()[quoteIndex()]}
          </div>

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
                          type="button"
                          class={`rounded-xl border p-4 text-left transition-colors ${
                            selected()
                              ? "border-primary bg-primary/5"
                              : "border-border/70 bg-card hover:border-primary/50"
                          }`}
                          onClick={() => selectGoal(goal.id)}
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

          <Show when={selectedGoal() && questions().length > 0}>
            <div class="space-y-4 rounded-xl border border-border/70 bg-card p-4">
              <div>
                <div class="text-sm font-semibold text-foreground">
                  {t("student.onboarding.goal.questionsTitle")}
                </div>
                <div class="mt-1 text-sm text-muted-foreground">
                  {t("student.onboarding.goal.questionsDescription")}
                </div>
              </div>
              <For each={questions()}>
                {(question) => (
                  <div class="grid gap-2">
                    <Switch>
                      <Match when={question.type === "single_select"}>
                        <div class="text-sm font-medium">
                          {question.label}{question.required ? " *" : ""}
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <For each={question.options ?? []}>
                            {(option) => {
                              const selected = () => answers()[question.id] === option;
                              return (
                                <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-sm">
                                  <input
                                    type="radio"
                                    name={`goal-question-${question.id}`}
                                    checked={selected()}
                                    onChange={() => setTextAnswer(question.id, option)}
                                    disabled={saving()}
                                  />
                                  <span>{option}</span>
                                </label>
                              );
                            }}
                          </For>
                        </div>
                      </Match>
                      <Match when={question.type === "multi_select"}>
                        <div class="text-sm font-medium">
                          {question.label}{question.required ? " *" : ""}
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <For each={question.options ?? []}>
                            {(option) => {
                              const selected = () => Array.isArray(answers()[question.id]) && (answers()[question.id] as string[]).includes(option);
                              return (
                                <label class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={selected()}
                                    onChange={() => toggleOption(question.id, option)}
                                    disabled={saving()}
                                  />
                                  <span>{option}</span>
                                </label>
                              );
                            }}
                          </For>
                        </div>
                      </Match>
                      <Match when={true}>
                        <TextField>
                          <TextFieldLabel for={`goal-question-${question.id}`}>
                            {question.label}{question.required ? " *" : ""}
                          </TextFieldLabel>
                          <TextFieldInput
                            id={`goal-question-${question.id}`}
                            value={typeof answers()[question.id] === "string" ? answers()[question.id] as string : ""}
                            onInput={(event) => setTextAnswer(question.id, event.currentTarget.value)}
                            disabled={saving()}
                          />
                        </TextField>
                      </Match>
                    </Switch>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="flex gap-2">
            <Button onClick={() => void saveAndContinue()} disabled={saving() || !selectedGoal()}>
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
