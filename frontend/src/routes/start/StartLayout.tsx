import { For, Show, type JSX } from "solid-js";

import { useI18n } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { START_STEPS, type StartDraft, type StartStep } from "./startDraft";

type StartLayoutProps = {
  step: StartStep;
  draft: StartDraft;
  title: string;
  subtitle?: string;
  children: JSX.Element;
};

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat().format(value);
}

function ChannelPanel(props: { draft: StartDraft }) {
  const { t } = useI18n();
  const empty = () => t("start.panel.empty");

  const rows = () => {
    const draft = props.draft;
    const monetization =
      draft.monetizationEnabled === null
        ? empty()
        : draft.monetizationEnabled
          ? t("start.panel.monetizationOn")
          : t("start.panel.monetizationOff");
    return [
      { label: t("start.panel.channelName"), value: draft.channel?.title || empty() },
      {
        label: t("start.panel.topic"),
        value: draft.topic ? t(`start.topics.${draft.topic}`) : empty(),
      },
      {
        label: t("start.panel.subscribers"),
        value: formatCount(draft.channel?.subscriberCount) ?? empty(),
      },
      {
        label: t("start.panel.videos"),
        value: formatCount(draft.channel?.videoCount) ?? empty(),
      },
      {
        label: t("start.panel.views"),
        value: formatCount(draft.channel?.viewCount) ?? empty(),
      },
      { label: t("start.panel.monetization"), value: monetization },
      {
        label: t("start.panel.currentGoal"),
        value: draft.targetMilestone
          ? t(`start.milestones.${draft.targetMilestone}`)
          : empty(),
      },
    ];
  };

  return (
    <aside class="rounded-[calc(var(--radius-lg)+6px)] border border-border/70 bg-card p-5 shadow-card lg:sticky lg:top-6">
      <div class="mb-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-secondary">
        {t("start.panel.title")}
      </div>
      <dl class="space-y-3">
        <For each={rows()}>
          {(row) => (
            <div class="border-b border-border/50 pb-3 last:border-none last:pb-0">
              <dt class="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                {row.label}
              </dt>
              <dd class="mt-1 text-sm font-semibold text-foreground">{row.value}</dd>
            </div>
          )}
        </For>
      </dl>
    </aside>
  );
}

function StartStepper(props: { step: StartStep; draft: StartDraft }) {
  const { t } = useI18n();
  const label = (step: StartStep) =>
    step === "plan" && props.draft.hasChannel === true
      ? t("start.stepPlanExpert")
      : t(`start.steps.${step}`);

  return (
    <div class="rounded-[calc(var(--radius-lg)+6px)] border border-border/70 bg-muted/30 p-4">
      <div class="mb-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-secondary">
        {t("start.stepperTitle")}
      </div>
      <ol class="grid gap-2 sm:grid-cols-4">
        <For each={START_STEPS}>
          {(step, index) => {
            const current = () => step === props.step;
            return (
              <li
                aria-current={current() ? "step" : undefined}
                class={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]",
                  current()
                    ? "bg-card text-primary shadow-rail"
                    : "bg-background/60 text-muted-foreground",
                )}
              >
                <span
                  class={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                    current()
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground",
                  )}
                >
                  {index() + 1}
                </span>
                <span>{label(step)}</span>
              </li>
            );
          }}
        </For>
      </ol>
    </div>
  );
}

export function StartLayout(props: StartLayoutProps) {
  const { t } = useI18n();

  return (
    <div class="min-h-screen bg-background px-4 py-8 sm:px-6">
      <section class="mx-auto max-w-6xl space-y-6">
        <header class="space-y-2 rounded-[calc(var(--radius-lg)+8px)] border border-border/70 bg-card px-6 py-6 shadow-card sm:px-8">
          <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">
            {t("start.eyebrow")}
          </div>
          <h1 class="text-2xl font-extrabold tracking-[-0.03em] text-foreground sm:text-3xl">
            {props.title}
          </h1>
          <Show when={props.subtitle}>
            <p class="max-w-3xl text-sm leading-6 text-muted-foreground">
              {props.subtitle}
            </p>
          </Show>
        </header>

        <StartStepper step={props.step} draft={props.draft} />

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_2fr]">
          <ChannelPanel draft={props.draft} />
          <main class="space-y-5">{props.children}</main>
        </div>
      </section>
    </div>
  );
}
