import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingGoal } from "../../src/routes/onboarding/OnboardingGoal";
import { listGoals } from "../../src/lib/adminApi";

const patchMeMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/adminApi", () => ({
  listGoals: vi.fn(),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => ({
      uid: "u1",
      email: "u1@example.com",
      displayName: "User One",
      role: "student",
      status: "active",
      selectedGoalId: null,
      profileForm: {
        telegram: null,
        socialUrl: null,
        experienceLevel: null,
        notes: null,
      },
      selectedCourses: [],
      subscriptionSelected: null,
    }),
    patchMe: patchMeMock,
  }),
}));

vi.mock("../../src/routes/onboarding/OnboardingLayout", () => ({
  OnboardingLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

describe("OnboardingGoal", () => {
  beforeEach(() => {
    vi.mocked(listGoals).mockReset();
    patchMeMock.mockReset();
  });

  it("loads goals and patches selectedGoalId on card click", async () => {
    vi.mocked(listGoals).mockResolvedValue({
      items: [
        { id: "goal-1", title: "Goal One", description: "Desc one" },
        { id: "goal-2", title: "Goal Two", description: "Desc two" },
      ],
    });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingGoal />
      </I18nProvider>
    ));

    expect(await screen.findByText("Goal One")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Goal One"));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({ selectedGoalId: "goal-1" });
    });
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("shows friendly load error text", async () => {
    vi.mocked(listGoals).mockRejectedValue(new Error("Request failed"));

    render(() => (
      <I18nProvider>
        <OnboardingGoal />
      </I18nProvider>
    ));

    expect(await screen.findByText("Could not load goals.")).toBeInTheDocument();
  });
});
