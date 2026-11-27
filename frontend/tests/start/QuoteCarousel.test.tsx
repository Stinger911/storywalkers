import { fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { QuoteCarousel } from "../../src/routes/start/QuoteCarousel";

function renderCarousel() {
  const view = render(() => (
    <I18nProvider>
      <QuoteCarousel />
    </I18nProvider>
  ));
  const card = screen.getByRole("region", { name: "Quotes" });
  const active = () => view.container.querySelector('[data-active="true"]')?.textContent;
  return { card, active };
}

// jsdom may lack PointerEvent, so the coordinates travel on a MouseEvent.
function pointer(target: Element, type: string, clientX: number) {
  fireEvent(target, new MouseEvent(type, { bubbles: true, clientX }));
}

function swipe(target: Element, from: number, to: number) {
  pointer(target, "pointerdown", from);
  pointer(target, "pointermove", to);
  pointer(target, "pointerup", to);
}

describe("QuoteCarousel", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("changes the quote by itself, restarting the countdown after a manual change", () => {
    vi.useFakeTimers();
    const { card, active } = renderCarousel();

    vi.advanceTimersByTime(5200);
    expect(active()).toContain("A clear goal");

    vi.advanceTimersByTime(4000);
    swipe(card, 200, 100);
    vi.advanceTimersByTime(5199);
    expect(active()).toContain("The path works best");
    vi.advanceTimersByTime(1);
    expect(active()).toContain("Your answers help us remove noise");

    vi.advanceTimersByTime(5200);
    expect(active()).toContain("Henry Ford");
  });

  it("waits while the pointer is over the card", () => {
    vi.useFakeTimers();
    const { card, active } = renderCarousel();

    pointer(card, "pointerenter", 0);
    vi.advanceTimersByTime(20000);
    expect(active()).toContain("Henry Ford");

    pointer(card, "pointerleave", 0);
    vi.advanceTimersByTime(5200);
    expect(active()).toContain("A clear goal");
  });

  it("does not change by itself when reduced motion is requested", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { active } = renderCarousel();

    vi.advanceTimersByTime(20000);
    expect(active()).toContain("Henry Ford");
  });

  it("moves forward and back with a swipe, wrapping around", () => {
    const { card, active } = renderCarousel();
    expect(active()).toContain("Henry Ford");

    swipe(card, 200, 100);
    expect(active()).toContain("A clear goal turns learning into a route");

    swipe(card, 100, 200);
    expect(active()).toContain("Henry Ford");

    swipe(card, 100, 200);
    expect(active()).toContain("Your answers help us remove noise");
  });

  it("ignores a short movement and a cancelled gesture", () => {
    const { card, active } = renderCarousel();

    swipe(card, 200, 180);
    expect(active()).toContain("Henry Ford");

    pointer(card, "pointerdown", 200);
    pointer(card, "pointercancel", 200);
    pointer(card, "pointerup", 50);
    expect(active()).toContain("Henry Ford");
  });

  it("switches with the dots and the arrow keys", () => {
    const { card, active } = renderCarousel();
    const third = screen.getByRole("button", { name: "Show quote 3" });

    fireEvent.click(third);
    expect(active()).toContain("The path works best");
    expect(third).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(active()).toContain("A clear goal");

    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(active()).toContain("The path works best");
  });
});
