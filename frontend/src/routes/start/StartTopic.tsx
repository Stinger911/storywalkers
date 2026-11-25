import { useNavigate } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";

import { useI18n } from "../../lib/i18n";
import { StartLayout } from "./StartLayout";
import {
  ButtonRow,
  StartButton,
  StartError,
  StartOption,
  StartSelect,
  type StartSelectOption,
} from "./StartUi";
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

// Emoji stand in for the topic icons from the Figma "иконки" frame until the
// SVGs are exported to public/start/icons/<slug>.svg.
const TOPIC_ICONS: Record<TopicSlug, string> = {
  movies_anime: "🎬",
  games: "🎮",
  education: "🎓",
  business: "💼",
  tech_ai: "🤖",
  lifestyle: "🌿",
  beauty: "💄",
  health: "🏋️",
  food: "🍳",
  travel: "✈️",
  family: "👨‍👩‍👧",
  psychology: "🧠",
  news: "📰",
  music: "🎵",
  sport: "⚽",
  humor: "😄",
  true_crime: "🔍",
};

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

  const topicOptions = (): StartSelectOption[] =>
    TOPICS.map((topic) => ({
      value: topic,
      label: t(`start.topics.${topic}`),
      icon: <span aria-hidden="true">{TOPIC_ICONS[topic]}</span>,
    }));

  return (
    <StartLayout
      step="topic"
      draft={draft()}
      title={t("start.topic.title")}
      subtitle={t("start.topic.question")}
    >
      <StartSelect
        options={topicOptions()}
        value={draft().topic}
        placeholder={t("start.topic.hint")}
        ariaLabel={t("start.topic.title")}
        onChange={(value) => pickTopic(value as TopicSlug)}
      />

      <p class="st-lead">{t("start.topic.formatQuestion")}</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <For each={VIDEO_FORMATS}>
          {(format) => {
            const disabled = () => Boolean(lockedFormat()) && lockedFormat() !== format;
            return (
              <StartOption
                selected={draft().format === format}
                disabled={disabled()}
                onClick={() => pickFormat(format)}
              >
                {t(`start.formats.${format}`)}
              </StartOption>
            );
          }}
        </For>
      </div>

      <Show when={lockedFormat()}>
        <p class="st-lead text-[var(--st-muted)]">{t("start.topic.lifestyleLocked")}</p>
      </Show>

      <Show when={voiceoverOpen()}>
        <div
          role="dialog"
          aria-label={t("start.topic.voiceoverTitle")}
          class="st-enter space-y-3 rounded-md border border-[var(--st-red-border)] bg-[var(--st-red-soft)] p-4 text-center"
        >
          <div class="text-sm font-bold">{t("start.topic.voiceoverTitle")}</div>
          <p class="text-xs leading-5">{t("start.topic.voiceoverBody")}</p>
          <StartButton variant="small" onClick={() => setVoiceoverOpen(false)}>
            {t("start.topic.voiceoverOk")}
          </StartButton>
        </div>
      </Show>

      <Show when={error()}>
        <StartError>{error()}</StartError>
      </Show>

      <ButtonRow>
        <StartButton variant="secondary" onClick={() => navigate(startPath("channel"))}>
          {t("start.topic.back")}
        </StartButton>
        <StartButton onClick={next}>{t("start.topic.next")}</StartButton>
      </ButtonRow>
    </StartLayout>
  );
}
