import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useI18n } from "../../lib/i18n";
import { StartLayout } from "./StartLayout";
import {
  canAccessStep,
  draftAsksMonetization,
  draftSubscriberCount,
  readDraft,
  startPath,
  writeDraft,
  type StartDraft,
} from "./startDraft";
import {
  allowedMilestones,
  milestoneForPurpose,
  PURPOSES,
  recommendedMilestone,
  type Purpose,
} from "./startRules";

export function StartGoal() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const initial = readDraft();
  if (!canAccessStep(initial, "goal")) {
    navigate(startPath(initial.hasChannel === null ? "channel" : "topic"), {
      replace: true,
    });
  }

  const [draft, setDraft] = createSignal<StartDraft>(initial);
  const [error, setError] = createSignal<string | null>(null);

  const update = (patch: Partial<StartDraft>) => setDraft(writeDraft(patch));

  const asksMonetization = createMemo(() => draftAsksMonetization(draft()));
  const subscriberCount = createMemo(() => draftSubscriberCount(draft()) ?? 0);

  const milestones = createMemo(() => {
    if (draft().hasChannel !== true) return [];
    if (asksMonetization() && draft().monetizationEnabled === null) return [];
    return allowedMilestones({
      subscriberCount: subscriberCount(),
      monetizationEnabled: draft().monetizationEnabled,
    });
  });

  const pickPurpose = (purpose: Purpose) => {
    setError(null);
    update({ purpose, targetMilestone: milestoneForPurpose(purpose) });
  };

  const pickMonetization = (enabled: boolean) => {
    setError(null);
    update({
      monetizationEnabled: enabled,
      targetMilestone: recommendedMilestone({
        subscriberCount: subscriberCount(),
        monetizationEnabled: enabled,
      }),
    });
  };

  const next = () => {
    const current = draft();
    if (current.hasChannel === false) {
      if (!current.purpose) {
        setError(t("start.goal.errorPurposeRequired"));
        return;
      }
    } else {
      if (asksMonetization() && current.monetizationEnabled === null) {
        setError(t("start.goal.errorMonetizationRequired"));
        return;
      }
      if (!current.targetMilestone) {
        setError(t("start.goal.errorMilestoneRequired"));
        return;
      }
    }
    navigate(startPath("plan"));
  };

  return (
    <StartLayout
      step="goal"
      draft={draft()}
      title={t("start.goal.title")}
      subtitle={t("start.goal.subtitle")}
    >
      <Show when={draft().hasChannel === false}>
        <SectionCard title={t("start.goal.purposeQuestion")}>
          <div class="grid gap-3 sm:grid-cols-2">
            <For each={PURPOSES}>
              {(purpose) => {
                const selected = () => draft().purpose === purpose;
                return (
                  <button
                    type="button"
                    aria-pressed={selected()}
                    class={`rounded-xl border p-4 text-left transition-colors ${
                      selected()
                        ? "border-primary bg-primary/5"
                        : "border-border/70 bg-card hover:border-primary/50"
                    }`}
                    onClick={() => pickPurpose(purpose)}
                  >
                    <div class="font-medium">{t(`start.purposes.${purpose}`)}</div>
                    <div class="mt-1 text-sm text-muted-foreground">
                      {t(`start.milestones.${milestoneForPurpose(purpose)}`)}
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </SectionCard>
      </Show>

      <Show when={draft().hasChannel === true}>
        <Show when={asksMonetization()}>
          <SectionCard title={t("start.goal.monetizationQuestion")}>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={draft().monetizationEnabled === true}
                class={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  draft().monetizationEnabled === true
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border/70 bg-card hover:border-primary/50"
                }`}
                onClick={() => pickMonetization(true)}
              >
                {t("start.goal.monetizationYes")}
              </button>
              <button
                type="button"
                aria-pressed={draft().monetizationEnabled === false}
                class={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  draft().monetizationEnabled === false
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border/70 bg-card hover:border-primary/50"
                }`}
                onClick={() => pickMonetization(false)}
              >
                {t("start.goal.monetizationNo")}
              </button>
            </div>
          </SectionCard>
        </Show>

        <Show when={!asksMonetization()}>
          <SectionCard title={t("start.goal.milestoneQuestion")}>
            <p class="text-sm text-muted-foreground">
              {t("start.goal.milestoneBelowThousand")}
            </p>
          </SectionCard>
        </Show>

        <Show when={milestones().length > 0}>
          <SectionCard title={t("start.goal.milestoneQuestion")}>
            <div class="grid gap-2">
              <For each={milestones()}>
                {(milestone, index) => {
                  const selected = () => draft().targetMilestone === milestone;
                  return (
                    <button
                      type="button"
                      aria-pressed={selected()}
                      class={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                        selected()
                          ? "border-primary bg-primary/5"
                          : "border-border/70 bg-card hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setError(null);
                        update({ targetMilestone: milestone });
                      }}
                    >
                      <span class="font-medium">{t(`start.milestones.${milestone}`)}</span>
                      <Show when={index() === 0}>
                        <span class="rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
                          {t("start.goal.recommended")}
                        </span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </SectionCard>
        </Show>
      </Show>

      <Show when={error()}>
        <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate(startPath("topic"))}>
          {t("start.goal.back")}
        </Button>
        <Button onClick={next}>{t("start.goal.next")}</Button>
      </div>
    </StartLayout>
  );
}
