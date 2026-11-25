import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import { useI18n } from "../../lib/i18n";
import {
  lookupYoutubeChannel,
  PublicApiError,
  type ChannelStats,
} from "../../lib/publicOnboardingApi";
import { StartLayout } from "./StartLayout";
import {
  ButtonRow,
  StartButton,
  StartError,
  StartInput,
  StartOption,
} from "./StartUi";
import { readDraft, startPath, writeDraft, type StartDraft } from "./startDraft";

const ERROR_KEYS: Record<string, string> = {
  youtube_link_unsupported: "start.channel.errorUnsupported",
  youtube_channel_not_found: "start.channel.errorNotFound",
  rate_limited: "start.channel.errorRateLimited",
};

export function StartChannel() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [draft, setDraft] = createSignal<StartDraft>(readDraft());
  const [url, setUrl] = createSignal(draft().channel?.url ?? "");
  const [checking, setChecking] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [manualOpen, setManualOpen] = createSignal(false);
  const [manualCount, setManualCount] = createSignal("");

  const hasChannel = () => draft().hasChannel;
  const channel = () => draft().channel;
  const needsSubscribers = () =>
    hasChannel() === true && typeof channel()?.subscriberCount !== "number";

  const update = (patch: Partial<StartDraft>) => setDraft(writeDraft(patch));

  const pick = (value: boolean) => {
    setError(null);
    if (value) {
      update({ hasChannel: true });
      return;
    }
    update({
      hasChannel: false,
      channel: null,
      monetizationEnabled: null,
      targetMilestone: null,
    });
  };

  const check = async () => {
    setChecking(true);
    setError(null);
    setManualOpen(false);
    try {
      const result = await lookupYoutubeChannel(url());
      const found: ChannelStats = { ...result.channel, url: result.channel.url ?? url() };
      update({ hasChannel: true, channel: found, targetMilestone: null });
      if (found.subscriberCount === null) {
        setManualOpen(true);
        setError(t("start.channel.manualHint"));
      }
    } catch (err) {
      const code = err instanceof PublicApiError ? err.code : "youtube_lookup_failed";
      const key = ERROR_KEYS[code];
      if (key) {
        setError(t(key));
      } else {
        setError(t("start.channel.errorFailed"));
        setManualOpen(true);
        update({
          hasChannel: true,
          channel: {
            channelId: null,
            title: null,
            url: url().trim() || null,
            subscriberCount: null,
            hiddenSubscriberCount: true,
            videoCount: null,
            viewCount: null,
          },
        });
      }
    } finally {
      setChecking(false);
    }
  };

  const applyManualCount = () => {
    const parsed = Number.parseInt(manualCount().trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(t("start.channel.errorManualRequired"));
      return;
    }
    const current = channel();
    update({
      channel: {
        channelId: current?.channelId ?? null,
        title: current?.title ?? null,
        url: current?.url ?? url().trim() ?? null,
        subscriberCount: parsed,
        hiddenSubscriberCount: true,
        videoCount: current?.videoCount ?? null,
        viewCount: current?.viewCount ?? null,
      },
      targetMilestone: null,
    });
    setManualOpen(false);
    setError(null);
  };

  const next = () => {
    if (hasChannel() === null) return;
    if (needsSubscribers()) {
      setManualOpen(true);
      setError(t("start.channel.errorManualRequired"));
      return;
    }
    navigate(startPath("topic"));
  };

  return (
    <StartLayout
      step="channel"
      draft={draft()}
      title={t("start.channel.question")}
      subtitle={t("start.channel.subtitle")}
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <StartOption selected={hasChannel() === false} onClick={() => pick(false)}>
          {t("start.channel.answerNo")}
        </StartOption>
        <StartOption selected={hasChannel() === true} onClick={() => pick(true)}>
          {t("start.channel.answerYes")}
        </StartOption>
      </div>

      <Show when={hasChannel() === true}>
        <div class="st-enter space-y-4">
          <p class="st-lead">{t("start.channel.linkHint")}</p>
          <label class="sr-only" for="start-channel-url">
            {t("start.channel.linkLabel")}
          </label>
          <StartInput
            id="start-channel-url"
            value={url()}
            placeholder={t("start.channel.linkPlaceholder")}
            aria-invalid={error() && !manualOpen() ? "true" : undefined}
            onInput={(event) => setUrl(event.currentTarget.value)}
            disabled={checking()}
          />
          <div class="flex justify-center">
            <StartButton
              variant="small"
              onClick={() => void check()}
              disabled={checking() || !url().trim()}
            >
              {checking() ? t("start.channel.checking") : t("start.channel.check")}
            </StartButton>
          </div>

          <Show when={channel()?.title}>
            <p class="st-lead">
              <span class="text-[var(--st-muted)]">{t("start.channel.found")}: </span>
              <span class="font-bold">{channel()?.title}</span>
            </p>
          </Show>

          <Show when={manualOpen() || needsSubscribers()}>
            <div class="space-y-3 rounded-md border border-[var(--st-line)] bg-[var(--st-surface)] p-4">
              <div class="text-sm font-bold">{t("start.channel.manualTitle")}</div>
              <p class="text-xs leading-5">{t("start.channel.manualHint")}</p>
              <label class="text-xs font-semibold" for="start-manual-subscribers">
                {t("start.channel.manualLabel")}
              </label>
              <StartInput
                id="start-manual-subscribers"
                type="number"
                min="0"
                value={manualCount()}
                onInput={(event) => setManualCount(event.currentTarget.value)}
              />
              <StartButton variant="small" onClick={applyManualCount}>
                {t("start.channel.manualApply")}
              </StartButton>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <StartError>{error()}</StartError>
      </Show>

      <ButtonRow>
        <StartButton onClick={next} disabled={hasChannel() === null || checking()}>
          {t("start.channel.next")}
        </StartButton>
      </ButtonRow>
    </StartLayout>
  );
}
