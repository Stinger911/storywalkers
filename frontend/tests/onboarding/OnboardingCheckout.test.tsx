import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { listGoals } from "../../src/lib/adminApi";
import { listCourses } from "../../src/lib/coursesApi";
import { OnboardingCheckout } from "../../src/routes/onboarding/OnboardingCheckout";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => ({
      uid: "u1",
      email: "u1@example.com",
      displayName: "User One",
      role: "student",
      status: "active",
      selectedGoalId: "goal-1",
      profileForm: {
        telegram: "@alice",
        socialUrl: null,
        experienceLevel: "beginner",
        notes: null,
      },
      selectedCourses: ["course-1"],
      subscriptionSelected: true,
    }),
  }),
}));

vi.mock("../../src/lib/adminApi", () => ({
  listGoals: vi.fn(),
}));

vi.mock("../../src/lib/coursesApi", () => ({
  listCourses: vi.fn(),
}));

vi.mock("../../src/routes/onboarding/OnboardingLayout", () => ({
  OnboardingLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

describe("OnboardingCheckout", () => {
  beforeEach(() => {
    vi.mocked(listGoals).mockReset();
    vi.mocked(listCourses).mockReset();
  });

  it("renders summary, total and payment instructions", async () => {
    vi.mocked(listGoals).mockResolvedValue({
      items: [{ id: "goal-1", title: "Video Creator", description: "desc" }],
    });
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          price: 40,
          isActive: true,
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Video Creator")).toBeInTheDocument();
    expect(screen.getByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("$59")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Boosty" })).toBeInTheDocument();
    expect(
      screen.getByText("Activation is manual after human review. Please wait for confirmation from the team."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@storywalkers_support" })).toBeInTheDocument();
  });

  it("falls back to goal id when goals request fails", async () => {
    vi.mocked(listGoals).mockRejectedValue(new Error("Request failed"));
    vi.mocked(listCourses).mockResolvedValue({ items: [] });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    await waitFor(() => {
      expect(screen.getByText("goal-1")).toBeInTheDocument();
    });
  });
});
