import { useNavigate } from "@solidjs/router";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useI18n } from "../../lib/i18n";
import { StartLayout } from "./StartLayout";
import { ButtonRow, StartButton, StartError, StartOption } from "./StartUi";
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

  const isNewChannel = () => draft().hasChannel === false;

  return (
    <StartLayout
      step="goal"
      draft={draft()}
      title={t("start.goal.title")}
      subtitle={
        isNewChannel() ? t("start.goal.purposeQuestion") : t("start.goal.subtitle")
      }
    >
      <Show when={isNewChannel()}>
        <div class="grid gap-4 sm:grid-cols-2">
          <For each={PURPOSES}>
            {(purpose) => (
              <StartOption
                selected={draft().purpose === purpose}
                onClick={() => pickPurpose(purpose)}
              >
                {t(`start.purposes.${purpose}`)}
              </StartOption>
            )}
          </For>
        </div>
      </Show>

      <Show when={draft().hasChannel === true}>
        <Show when={asksMonetization()}>
          <p class="st-lead">{t("start.goal.monetizationQuestion")}</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <StartOption
              selected={draft().monetizationEnabled === true}
              onClick={() => pickMonetization(true)}
            >
              {t("start.goal.monetizationYes")}
            </StartOption>
            <StartOption
              selected={draft().monetizationEnabled === false}
              onClick={() => pickMonetization(false)}
            >
              {t("start.goal.monetizationNo")}
            </StartOption>
          </div>
        </Show>

        <Show when={!asksMonetization()}>
          <p class="st-lead">{t("start.goal.milestoneBelowThousand")}</p>
        </Show>

        <Show when={milestones().length > 0}>
          <p class="st-lead">{t("start.goal.milestoneQuestion")}</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <For each={milestones()}>
              {(milestone, index) => (
                <StartOption
                  selected={draft().targetMilestone === milestone}
                  onClick={() => {
                    setError(null);
                    update({ targetMilestone: milestone });
                  }}
                >
                  <span>{t(`start.milestones.${milestone}`)}</span>
                  <Show when={index() === 0}>
                    <span class="ml-2 rounded-full bg-[var(--st-red)] px-2 py-0.5 text-[0.6rem] font-semibold text-white">
                      {t("start.goal.recommended")}
                    </span>
                  </Show>
                </StartOption>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={error()}>
        <StartError>{error()}</StartError>
      </Show>

      <ButtonRow>
        <StartButton variant="secondary" onClick={() => navigate(startPath("topic"))}>
          {t("start.goal.back")}
        </StartButton>
        <StartButton onClick={next}>{t("start.goal.next")}</StartButton>
      </ButtonRow>
    </StartLayout>
  );
}
