import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

import { useI18n } from "../../lib/i18n";

// Only the first quote has an author; the others are the product's own lines.
const QUOTES = [
  { text: "start.quotes.ford.text", author: "start.quotes.ford.author" },
  { text: "start.quotes.clearGoal", author: null },
  { text: "start.quotes.fromResult", author: null },
  { text: "start.quotes.yourAnswers", author: null },
] as const;

/** Horizontal distance after which releasing the pointer changes the quote. */
const SWIPE_DISTANCE_PX = 40;

const AUTO_CHANGE_MS = 5200;

export function QuoteCarousel() {
  const { t } = useI18n();
  const [index, setIndex] = createSignal(0);
  // The side the next quote slides in from; null until the first change.
  const [enterFrom, setEnterFrom] = createSignal<"left" | "right" | null>(null);
  const [dragStart, setDragStart] = createSignal<number | null>(null);
  const [dragOffset, setDragOffset] = createSignal(0);
  const [hovered, setHovered] = createSignal(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The quote stays put while the reader points at it or drags it.
  const rotating = () => !reducedMotion && !hovered() && dragStart() === null;

  createEffect(() => {
    index(); // every change, manual ones included, restarts the countdown
    if (!rotating()) return;
    const timer = window.setTimeout(() => step(1), AUTO_CHANGE_MS);
    onCleanup(() => window.clearTimeout(timer));
  });

  const show = (next: number, from: "left" | "right") => {
    if (next === index()) return;
    setEnterFrom(from);
    setIndex(next);
  };
  const step = (delta: 1 | -1) =>
    show((index() + delta + QUOTES.length) % QUOTES.length, delta > 0 ? "right" : "left");

  const endDrag = () => {
    setDragStart(null);
    setDragOffset(0);
  };

  const onPointerDown = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    if (event.button > 0) return;
    // Capturing the pointer would swallow the click on a dot.
    if ((event.target as Element).closest("button")) return;
    setDragStart(event.clientX);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    const start = dragStart();
    if (start !== null) setDragOffset(event.clientX - start);
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = dragStart();
    if (start === null) return;
    const distance = event.clientX - start;
    endDrag();
    if (Math.abs(distance) >= SWIPE_DISTANCE_PX) step(distance < 0 ? 1 : -1);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    step(event.key === "ArrowRight" ? 1 : -1);
  };

  return (
    <section
      class="st-card st-quote flex min-h-[250px] flex-col items-center justify-center px-8 py-10 text-center"
      aria-roledescription="carousel"
      aria-label={t("start.quotes.label")}
      data-dragging={dragStart() !== null}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={endDrag}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onKeyDown={onKeyDown}
    >
      {/* All quotes share one grid cell, so the card keeps the height of the longest. */}
      <div
        class="st-quote-track grid w-full"
        style={{ transform: `translateX(${dragOffset()}px)` }}
        aria-live={rotating() ? "off" : "polite"}
      >
        <For each={QUOTES}>
          {(quote, position) => (
            <figure
              class="st-quote-slide col-start-1 row-start-1 self-center"
              data-active={position() === index()}
              data-from={position() === index() ? (enterFrom() ?? undefined) : undefined}
              aria-hidden={position() !== index()}
            >
              <blockquote class="st-display text-base leading-8 text-[var(--st-red)]">
                «{t(quote.text)}»
              </blockquote>
              <Show when={quote.author}>
                {(author) => (
                  <figcaption class="mt-3 text-[0.65rem] uppercase tracking-[0.12em]">
                    {t(author())}
                  </figcaption>
                )}
              </Show>
            </figure>
          )}
        </For>
      </div>
      <div class="mt-1 flex justify-center">
        <For each={QUOTES}>
          {(_, position) => (
            <button
              type="button"
              class="st-quote-dot"
              aria-label={t("start.quotes.show", { number: position() + 1 })}
              aria-current={position() === index() ? "true" : undefined}
              onClick={() => show(position(), position() > index() ? "right" : "left")}
            />
          )}
        </For>
      </div>
    </section>
  );
}
