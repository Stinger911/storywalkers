import { useNavigate } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { useI18n } from "../../lib/i18n";
import {
  lookupYoutubeChannel,
  PublicApiError,
  type ChannelStats,
} from "../../lib/publicOnboardingApi";
import { StartLayout } from "./StartLayout";
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
      title={t("start.channel.title")}
      subtitle={t("start.channel.subtitle")}
    >
      <SectionCard title={t("start.channel.question")}>
        <div class="space-y-5">
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              aria-pressed={hasChannel() === false}
              class={`rounded-xl border p-4 text-left transition-colors ${
                hasChannel() === false
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-card hover:border-primary/50"
              }`}
              onClick={() => pick(false)}
            >
              <span class="font-medium">{t("start.channel.answerNo")}</span>
            </button>
            <button
              type="button"
              aria-pressed={hasChannel() === true}
              class={`rounded-xl border p-4 text-left transition-colors ${
                hasChannel() === true
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-card hover:border-primary/50"
              }`}
              onClick={() => pick(true)}
            >
              <span class="font-medium">{t("start.channel.answerYes")}</span>
            </button>
          </div>

          <Show when={hasChannel() === true}>
            <div class="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
              <p class="text-sm leading-6 text-muted-foreground">
                {t("start.channel.linkHint")}
              </p>
              <TextField>
                <TextFieldLabel for="start-channel-url">
                  {t("start.channel.linkLabel")}
                </TextFieldLabel>
                <TextFieldInput
                  id="start-channel-url"
                  value={url()}
                  placeholder={t("start.channel.linkPlaceholder")}
                  onInput={(event) => setUrl(event.currentTarget.value)}
                  disabled={checking()}
                />
              </TextField>
              <Button
                variant="outline"
                onClick={() => void check()}
                disabled={checking() || !url().trim()}
              >
                {checking() ? t("start.channel.checking") : t("start.channel.check")}
              </Button>

              <Show when={channel()?.title}>
                <div class="rounded-md border border-border/70 bg-card px-3 py-2 text-sm">
                  <span class="text-muted-foreground">{t("start.channel.found")}: </span>
                  <span class="font-medium">{channel()?.title}</span>
                </div>
              </Show>

              <Show when={manualOpen() || needsSubscribers()}>
                <div class="space-y-3 rounded-md border border-border/70 bg-card p-3">
                  <div class="text-sm font-semibold">
                    {t("start.channel.manualTitle")}
                  </div>
                  <p class="text-sm text-muted-foreground">
                    {t("start.channel.manualHint")}
                  </p>
                  <TextField>
                    <TextFieldLabel for="start-manual-subscribers">
                      {t("start.channel.manualLabel")}
                    </TextFieldLabel>
                    <TextFieldInput
                      id="start-manual-subscribers"
                      type="number"
                      min="0"
                      value={manualCount()}
                      onInput={(event) => setManualCount(event.currentTarget.value)}
                    />
                  </TextField>
                  <Button variant="outline" onClick={applyManualCount}>
                    {t("start.channel.manualApply")}
                  </Button>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={error()}>
            <div class="rounded-md border border-error bg-error/10 p-3 text-sm text-error-foreground">
              {error()}
            </div>
          </Show>

          <Button onClick={next} disabled={hasChannel() === null || checking()}>
            {t("start.channel.next")}
          </Button>
        </div>
      </SectionCard>
    </StartLayout>
  );
}
