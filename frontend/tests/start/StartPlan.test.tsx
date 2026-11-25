import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { getOnboardingPlan } from "../../src/lib/publicOnboardingApi";
import { clearDraft, readDraft, writeDraft } from "../../src/routes/start/startDraft";
import { StartPlan } from "../../src/routes/start/StartPlan";

const navigateMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({ me: () => null }),
}));

vi.mock("../../src/lib/publicOnboardingApi", () => ({
  getOnboardingPlan: vi.fn(),
}));

function renderPlan() {
  return render(() => (
    <I18nProvider>
      <StartPlan />
    </I18nProvider>
  ));
}

describe("StartPlan", () => {
  beforeEach(() => {
    clearDraft();
    navigateMock.mockReset();
    vi.mocked(getOnboardingPlan).mockReset();
    vi.mocked(getOnboardingPlan).mockResolvedValue({
      goal: { id: "goal-1", title: "YouTube", slug: "youtube" },
      excludedTags: [],
      courses: [
        {
          id: "c1",
          title: "Editing",
          description: null,
          tags: [],
          lessonCount: 2,
          priceUsdCents: 1000,
          lessons: [
            { id: "l1", title: "Timeline", order: 0 },
            { id: "l2", title: "Export", order: 1 },
          ],
        },
      ],
    });
    writeDraft({
      hasChannel: false,
      topic: "games",
      format: "voiceover",
      purpose: "earn",
      targetMilestone: "subs_1k_hours_4k",
    });
  });

  it("selects single lessons without reloading the plan", async () => {
    renderPlan();

    await waitFor(() => {
      expect(readDraft().selectedCourses).toEqual(["c1"]);
    });

    fireEvent.click(screen.getByRole("button", { name: "Pick individual lessons" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Timeline" }));

    expect(readDraft().selectedCourses).toEqual([]);
    expect(readDraft().selectedLessons).toEqual([{ courseId: "c1", lessonId: "l1" }]);
    expect(screen.getByRole("checkbox", { name: "Export" })).toBeInTheDocument();
    expect(getOnboardingPlan).toHaveBeenCalledTimes(1);
  });

  it("asks for a selection before registration", async () => {
    renderPlan();

    fireEvent.click(await screen.findByRole("checkbox", { name: "Editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
