import { createEffect, createSignal, For, on, Show, type JSX } from "solid-js";

import { useI18n } from "../../lib/i18n";
import { START_STEPS, type StartDraft, type StartStep } from "./startDraft";
import "./startTheme.css";

type StartLayoutProps = {
  step: StepperStep;
  draft: StartDraft;
  title: string;
  subtitle?: string;
  children: JSX.Element;
};

export type StepperStep = StartStep | "payment";

const STEPPER_STEPS: StepperStep[] = [...START_STEPS, "payment"];

function formatCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat().format(value);
}

/* ---------- right column: channel summary ---------- */

function SummaryPanel(props: { draft: StartDraft }) {
  const { t } = useI18n();
  const empty = () => t("start.panel.empty");

  const rows = () => {
    const draft = props.draft;
    const monetization =
      draft.monetizationEnabled === null
        ? null
        : draft.monetizationEnabled
          ? t("start.panel.monetizationOn")
          : t("start.panel.monetizationOff");
    return [
      { label: t("start.panel.channelName"), value: draft.channel?.title || null },
      {
        label: t("start.panel.topic"),
        value: draft.topic ? t(`start.topics.${draft.topic}`) : null,
        upper: true,
      },
      { label: t("start.panel.subscribers"), value: formatCount(draft.channel?.subscriberCount) },
      { label: t("start.panel.videos"), value: formatCount(draft.channel?.videoCount) },
      { label: t("start.panel.views"), value: formatCount(draft.channel?.viewCount) },
      { label: t("start.panel.monetization"), value: monetization },
      {
        label: t("start.panel.currentGoal"),
        value: draft.targetMilestone ? t(`start.milestones.${draft.targetMilestone}`) : null,
      },
    ];
  };

  return (
    <aside class="st-card st-card-fill relative px-6 pb-4 pt-6" aria-label={t("start.summary.title")}>
      <svg
        aria-hidden="true"
        class="pointer-events-none absolute -top-5 right-2 z-10 h-[65px] w-[55px]"
        viewBox="0 0 55 65"
        fill="none"
      >
        <path d="M44 4l8 8-9 9-8-8z" fill="#fff" stroke="#111" stroke-width="2" />
        <path d="M40 16l-6 6 8 8 6-6z" fill="#fff" stroke="#111" stroke-width="2" />
        <path d="M33 26L12 62" stroke="#111" stroke-width="2" stroke-linecap="round" />
        <path d="M39 12l4 4" stroke="#d91a1c" stroke-width="3" stroke-linecap="round" />
      </svg>
      <div
        class="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px] opacity-30"
        aria-hidden="true"
      >
        <div class="absolute right-6 top-6 size-0 border-x-[9px] border-b-[15px] border-x-transparent border-b-[#ff7a2f]" />
        <div class="absolute bottom-6 right-6 size-10 bg-[#c81418]" />
        <div class="absolute bottom-14 right-10 size-8 rounded-full border border-white/40" />
      </div>

      <h2 class="st-display relative mb-5 text-sm uppercase tracking-[0.12em]">
        {t("start.summary.title")}
      </h2>
      <dl class="relative">
        <For each={rows()}>
          {(row) => (
            <div class="border-b border-white/70 py-2.5 first:pt-0 last:border-none">
              <dt class="st-summary-label">{row.label}</dt>
              <dd
                class="st-summary-value"
                data-upper={row.upper ? "true" : undefined}
                data-filled={row.value ? "true" : undefined}
              >
                {row.value ?? empty()}
              </dd>
            </div>
          )}
        </For>
      </dl>
    </aside>
  );
}

/* ---------- right column: quote ---------- */

function QuoteCard() {
  const { t } = useI18n();
  // The design has pagination dots for several quotes; only one is supplied so far.
  return (
    <figure class="st-card relative flex min-h-[250px] flex-col items-center justify-center px-8 py-10 text-center">
      <blockquote class="st-display text-base leading-8 text-[var(--st-red)]">
        «{t("start.quote.text")}»
      </blockquote>
      <figcaption class="mt-3 text-[0.65rem] uppercase tracking-[0.12em]">
        {t("start.quote.author")}
      </figcaption>
    </figure>
  );
}

/* ---------- stepper ---------- */

function Stepper(props: { step: StepperStep; draft: StartDraft }) {
  const { t } = useI18n();
  const currentIndex = () => STEPPER_STEPS.indexOf(props.step);
  const label = (step: StepperStep) =>
    step === "plan" && props.draft.hasChannel === true
      ? t("start.stepPlanExpert")
      : t(`start.steps.${step}`);

  return (
    <nav aria-label={t("start.stepperTitle")}>
      <ol class="flex items-center">
        <For each={STEPPER_STEPS}>
          {(step, index) => {
            const state = () =>
              index() < currentIndex() ? "done" : index() === currentIndex() ? "current" : "todo";
            return (
              <>
                <Show when={index() > 0}>
                  <li aria-hidden="true" class="st-step-link" data-done={index() <= currentIndex()} />
                </Show>
                <li
                  class="st-step"
                  data-state={state()}
                  aria-current={state() === "current" ? "step" : undefined}
                >
                  <span>{index() + 1}.</span>
                  <span>{label(step)}</span>
                </li>
              </>
            );
          }}
        </For>
      </ol>
    </nav>
  );
}

/* ---------- illustration: illN.mp4 once on entrance, then illN_2.mp4 in a loop ---------- */

const ILLUSTRATION_INDEX: Record<StepperStep, number> = {
  channel: 1,
  topic: 2,
  goal: 3,
  plan: 4,
  payment: 5,
};

export function Illustration(props: { step: StepperStep }) {
  const index = () => ILLUSTRATION_INDEX[props.step];
  const [looping, setLooping] = createSignal(false);
  const reduced = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  createEffect(on(index, () => setLooping(false)));

  return (
    <div class="mx-auto aspect-[788/342] w-full max-w-[788px] overflow-hidden" aria-hidden="true">
      <Show
        when={looping() || reduced()}
        fallback={
          <video
            class="size-full object-cover"
            src={`/start/anim/ill${index()}.mp4`}
            autoplay
            muted
            playsinline
            preload="auto"
            onEnded={() => setLooping(true)}
            onError={() => setLooping(true)}
          />
        }
      >
        <video
          class="size-full object-cover"
          src={`/start/anim/ill${index()}_2.mp4`}
          autoplay={!reduced()}
          loop
          muted
          playsinline
          preload="auto"
        />
      </Show>
    </div>
  );
}

/* ---------- page ---------- */

export function StartLayout(props: StartLayoutProps) {
  return (
    <div class="start-theme px-4 py-8 sm:px-6">
      <div class="mx-auto grid max-w-[1280px] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_372px]">
        <section class="st-card px-8 pb-10 pt-12 sm:px-16">
          <Stepper step={props.step} draft={props.draft} />
          <div class="mt-2">
            <Illustration step={props.step} />
          </div>
          <div class="st-enter mt-1 space-y-5" data-step={props.step}>
            <h1 class="st-heading">{props.title}</h1>
            <Show when={props.subtitle}>
              <p class="st-lead">{props.subtitle}</p>
            </Show>
            {props.children}
          </div>
        </section>

        <div class="space-y-7 lg:sticky lg:top-6">
          <SummaryPanel draft={props.draft} />
          <QuoteCard />
        </div>
      </div>
    </div>
  );
}
