import { useNavigate } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import { useI18n } from "../../lib/i18n";
import { StartLayout } from "./StartLayout";
import {
  canAccessStep,
  readDraft,
  startPath,
  writeDraft,
  type StartDraft,
} from "./startDraft";
import {
  fixedFormatForTopic,
  TOPICS,
  VIDEO_FORMATS,
  type TopicSlug,
  type VideoFormat,
} from "./startRules";

export function StartTopic() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const initial = readDraft();
  if (!canAccessStep(initial, "topic")) {
    navigate(startPath("channel"), { replace: true });
  }

  const [draft, setDraft] = createSignal<StartDraft>(initial);
  const [error, setError] = createSignal<string | null>(null);
  const [voiceoverOpen, setVoiceoverOpen] = createSignal(false);

  const update = (patch: Partial<StartDraft>) => setDraft(writeDraft(patch));
  const lockedFormat = () => (draft().topic ? fixedFormatForTopic(draft().topic!) : null);

  const pickTopic = (topic: TopicSlug) => {
    setError(null);
    const locked = fixedFormatForTopic(topic);
    update({ topic, format: locked ?? draft().format });
    if (locked === "live") setVoiceoverOpen(false);
  };

  const pickFormat = (format: VideoFormat) => {
    if (lockedFormat() && format !== lockedFormat()) return;
    setError(null);
    update({ format });
    if (format === "voiceover") setVoiceoverOpen(true);
  };

  const next = () => {
    if (!draft().topic || !draft().format) {
      setError(t("start.topic.errorTopicRequired"));
      return;
    }
    navigate(startPath("goal"));
  };

  return (
    <StartLayout
      step="topic"
      draft={draft()}
      title={t("start.topic.title")}
      subtitle={t("start.topic.subtitle")}
    >
      <SectionCard title={t("start.topic.question")} description={t("start.topic.hint")}>
        <div class="flex flex-wrap gap-2">
          <For each={TOPICS}>
            {(topic) => {
              const selected = () => draft().topic === topic;
              return (
                <button
                  type="button"
                  aria-pressed={selected()}
                  class={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    selected()
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border/70 bg-card hover:border-primary/50"
                  }`}
                  onClick={() => pickTopic(topic)}
                >
                  {t(`start.topics.${topic}`)}
                </button>
              );
            }}
          </For>
        </div>
      </SectionCard>

      <SectionCard title={t("start.topic.formatQuestion")}>
        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <For each={VIDEO_FORMATS}>
              {(format) => {
                const selected = () => draft().format === format;
                const disabled = () => Boolean(lockedFormat()) && lockedFormat() !== format;
                return (
                  <button
                    type="button"
                    aria-pressed={selected()}
                    disabled={disabled()}
                    class={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      selected()
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border/70 bg-card hover:border-primary/50"
                    } ${disabled() ? "cursor-not-allowed opacity-50" : ""}`}
                    onClick={() => pickFormat(format)}
                  >
                    {t(`start.formats.${format}`)}
                  </button>
                );
              }}
            </For>
          </div>

          <Show when={lockedFormat()}>
            <p class="text-sm text-muted-foreground">{t("start.topic.lifestyleLocked")}</p>
          </Show>

          <Show when={voiceoverOpen()}>
            <div
              role="dialog"
              aria-label={t("start.topic.voiceoverTitle")}
              class="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
            >
              <div class="text-sm font-semibold">{t("start.topic.voiceoverTitle")}</div>
              <p class="text-sm leading-6 text-muted-foreground">
                {t("start.topic.voiceoverBody")}
              </p>
              <Button variant="outline" onClick={() => setVoiceoverOpen(false)}>
                {t("start.topic.voiceoverOk")}
              </Button>
            </div>
          </Show>

          <Show when={error()}>
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {error()}
            </div>
          </Show>

          <div class="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(startPath("channel"))}>
              {t("start.topic.back")}
            </Button>
            <Button onClick={next}>{t("start.topic.next")}</Button>
          </div>
        </div>
      </SectionCard>
    </StartLayout>
  );
}
