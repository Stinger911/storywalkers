import { For, Show, createEffect, createMemo, createSignal } from "solid-js";

import { Button, buttonVariants } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Markdown } from "../../components/ui/markdown";
import { getYouTubeEmbedUrl } from "../../lib/youtube";
import { cn } from "../../lib/utils";
import type { StudentPathStep } from "./studentPathTypes";

type StudentPathVisualizationProps = {
  steps: StudentPathStep[];
  initialStepId?: string | null;
  ariaLabel: string;
  openLabel: string;
  markDoneLabel: string;
  markNotDoneLabel: string;
  lockedLabel: string;
  doneCommentLabel: string;
  doneLinkLabel: string;
  materialLabel: string;
  onOpenMaterial: (url?: string | null) => void;
  onToggleStep: (step: StudentPathStep) => void;
};

type PathPoint = {
  step: StudentPathStep;
  x: number;
  y: number;
};

const X_POSITIONS = [120, 332, 560, 286];
const Y_GAP = 138;
const START_Y = 84;
const WIDTH = 680;

function buildSegmentPath(from: PathPoint, to: PathPoint) {
  const midY = (from.y + to.y) / 2;
  const dx = (to.x - from.x) * 0.38;
  return `M ${from.x} ${from.y} C ${from.x + dx} ${midY - 30}, ${to.x - dx} ${midY + 30}, ${to.x} ${to.y}`;
}

export function StudentPathVisualization(props: StudentPathVisualizationProps) {
  const [selectedStepId, setSelectedStepId] = createSignal<string | null>(props.initialStepId ?? null);
  const [detailsOpen, setDetailsOpen] = createSignal(false);

  const selectedStep = createMemo(
    () => props.steps.find((step) => step.id === selectedStepId()) ?? props.steps[0] ?? null,
  );
  const selectedStepEmbedUrl = createMemo(() => getYouTubeEmbedUrl(selectedStep()?.materialUrl));

  createEffect(() => {
    const nextSelected =
      props.steps.find((step) => step.id === selectedStepId())?.id ??
      props.steps.find((step) => step.id === props.initialStepId)?.id ??
      props.steps.find((step) => !step.isDone)?.id ??
      props.steps[0]?.id ??
      null;

    if (nextSelected !== selectedStepId()) {
      setSelectedStepId(nextSelected);
    }
  });

  const points = createMemo<PathPoint[]>(() =>
    props.steps.map((step, index) => ({
      step,
      x: X_POSITIONS[index % X_POSITIONS.length],
      y: START_Y + index * Y_GAP + (index % 2 === 0 ? 0 : 14),
    })),
  );

  const svgHeight = createMemo(() => {
    const lastPoint = points().at(-1);
    return lastPoint ? lastPoint.y + 98 : 220;
  });

  const backgroundSegments = createMemo(() =>
    points()
      .slice(1)
      .map((point, index) => buildSegmentPath(points()[index]!, point)),
  );

  const completedSegments = createMemo(() =>
    points()
      .slice(1)
      .map((point, index) =>
        props.steps[index]?.isDone ? buildSegmentPath(points()[index]!, point) : null,
      )
      .filter((value): value is string => Boolean(value)),
  );

  return (
    <>
      <div class="space-y-6">
        <div class="overflow-hidden rounded-[calc(var(--radius-lg)+4px)] bg-[linear-gradient(180deg,rgba(237,244,255,0.96)_0%,rgba(255,255,255,1)_100%)] p-4 sm:p-6">
          <div class="overflow-x-auto pb-2">
            <div class="relative min-w-[680px]" style={{ height: `${svgHeight()}px` }}>
              <svg
                viewBox={`0 0 ${WIDTH} ${svgHeight()}`}
                class="absolute inset-0 h-full w-full"
                role="img"
                aria-label={props.ariaLabel}
              >
              <defs>
                <linearGradient id="student-path-track" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="rgba(74,120,167,0.18)" />
                  <stop offset="100%" stop-color="rgba(42,104,58,0.16)" />
                </linearGradient>
                <linearGradient id="student-path-progress" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#4a78a7" />
                  <stop offset="100%" stop-color="#2a683a" />
                </linearGradient>
                <filter id="student-path-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="10" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <For each={backgroundSegments()}>
                {(segment) => (
                  <path
                    d={segment}
                    fill="none"
                    stroke="url(#student-path-track)"
                    stroke-linecap="round"
                    stroke-width="18"
                  />
                )}
              </For>

              <For each={completedSegments()}>
                {(segment) => (
                  <path
                    d={segment}
                    fill="none"
                    stroke="url(#student-path-progress)"
                    stroke-linecap="round"
                    stroke-width="10"
                  />
                )}
              </For>

              <For each={points()}>
                {(point) => {
                  const isSelected = () => selectedStep()?.id === point.step.id;
                  const isLocked = () => point.step.isLocked;
                  const isDone = () => point.step.isDone;
                  const fill = () =>
                    isDone() ? "#2a683a" : isLocked() ? "#9aa3b2" : "#4a78a7";

                  return (
                    <g>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={isSelected() ? "28" : "22"}
                        fill="rgba(74,120,167,0.08)"
                        filter={isSelected() ? "url(#student-path-glow)" : undefined}
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="14"
                        fill={fill()}
                        stroke="white"
                        stroke-width="4"
                      />
                      <Show when={isDone()}>
                        <path
                          d={`M ${point.x - 5} ${point.y} L ${point.x - 1} ${point.y + 5} L ${point.x + 7} ${point.y - 4}`}
                          fill="none"
                          stroke="white"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2.5"
                        />
                      </Show>
                    </g>
                  );
                }}
              </For>
              </svg>

              <For each={points()}>
                {(point, index) => {
                  const isSelected = () => selectedStep()?.id === point.step.id;

                  return (
                    <button
                      type="button"
                      class={cn(
                        "student-path-node-card absolute w-[196px] -translate-x-1/2 -translate-y-1/2 rounded-[calc(var(--radius-md)+4px)] bg-white/95 p-4 text-left shadow-[0px_20px_40px_rgba(18,29,38,0.06)] transition-all duration-300",
                        isSelected() && "ring-2 ring-primary ring-offset-4 ring-offset-[rgba(237,244,255,0.92)]",
                        point.step.isLocked && "opacity-70",
                      )}
                      style={{
                        left: `${point.x}px`,
                        top: `${point.y}px`,
                      }}
                      aria-pressed={isSelected()}
                      aria-current={isSelected() ? "true" : undefined}
                      onClick={() => {
                        setSelectedStepId(point.step.id);
                        setDetailsOpen(true);
                      }}
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                            #{String((point.step.order ?? index()) + 1).padStart(2, "0")}
                          </p>
                          <p class="mt-2 line-clamp-2 text-sm font-bold text-foreground">
                            {point.step.title}
                          </p>
                        </div>
                        <span
                          class={cn(
                            "mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full",
                            point.step.isDone
                              ? "bg-[#2a683a]"
                              : point.step.isLocked
                                ? "bg-[#9aa3b2]"
                                : "bg-primary",
                          )}
                        />
                      </div>
                      <p class="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {point.step.description}
                      </p>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={detailsOpen()} onOpenChange={setDetailsOpen}>
        <DialogContent class="h-[100dvh] max-h-[100dvh] max-w-[min(96vw,1100px)] overflow-hidden rounded-none border-0 p-0 sm:h-[min(92dvh,960px)] sm:max-h-[92dvh] sm:rounded-[calc(var(--radius-lg)+8px)]">
          <Show when={selectedStep()}>
            {(step) => (
              <div class="flex h-full min-h-0 flex-col bg-background">
                <DialogHeader class="border-b border-border/70 px-6 py-5 pr-14 sm:px-8">
                  <DialogTitle class="text-2xl font-bold tracking-[-0.03em] text-foreground">
                    {step().title}
                  </DialogTitle>
                  <DialogDescription class="text-sm leading-6">
                    {step().isLocked
                      ? props.lockedLabel
                      : `#${String((step().order ?? 0) + 1).padStart(2, "0")}`}
                  </DialogDescription>
                </DialogHeader>

                <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 sm:px-8 sm:py-8">
                  <div class={cn("space-y-5", step().isLocked && "opacity-60")}>
                    <Markdown
                      class="text-sm leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:m-0 [&_p+*]:mt-4 [&_ul]:ml-5 [&_ul]:list-disc"
                      content={step().description}
                    />
                    <Show when={step().isLocked}>
                      <div class="text-xs font-medium text-muted-foreground">
                        {props.lockedLabel}
                      </div>
                    </Show>
                    <Show when={selectedStepEmbedUrl() && !step().isLocked}>
                      <div class="overflow-hidden rounded-[calc(var(--radius-md)+2px)] border border-border/70 bg-muted/30">
                        <div class="aspect-video">
                          <iframe
                            class="h-full w-full"
                            src={selectedStepEmbedUrl() ?? undefined}
                            title={step().title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        </div>
                      </div>
                    </Show>
                    <Show when={step().isDone && step().doneComment}>
                      <div class="text-xs">
                        <span class="font-semibold">{props.doneCommentLabel} </span>
                        <span class="text-muted-foreground">{step().doneComment}</span>
                      </div>
                    </Show>
                    <Show when={step().isDone && step().doneLink}>
                      <div class="text-xs">
                        <span class="font-semibold">{props.doneLinkLabel} </span>
                        <a
                          href={step().doneLink ?? "#"}
                          target="_blank"
                          rel="noopener"
                          class="text-primary underline"
                        >
                          {step().doneLink}
                        </a>
                      </div>
                    </Show>
                    <Show when={step().materialUrl}>
                      <button
                        class="inline-flex items-center gap-2 text-sm font-semibold text-primary"
                        onClick={() => props.onOpenMaterial(step().materialUrl)}
                        disabled={step().isLocked}
                      >
                        <span class="material-symbols-outlined text-[18px]">open_in_new</span>
                        {props.materialLabel}
                      </button>
                    </Show>
                    <div class="flex flex-wrap gap-2 border-t border-border/70 pt-5">
                      {step().materialUrl ? (
                        <button
                          class={buttonVariants({ size: "sm" })}
                          onClick={() => props.onOpenMaterial(step().materialUrl)}
                          disabled={step().isLocked}
                        >
                          {props.openLabel}
                        </button>
                      ) : (
                        <Button size="sm" disabled>
                          {props.openLabel}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => props.onToggleStep(step())}
                        disabled={step().isLocked}
                      >
                        {step().isDone ? props.markNotDoneLabel : props.markDoneLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </DialogContent>
      </Dialog>
    </>
  );
}
