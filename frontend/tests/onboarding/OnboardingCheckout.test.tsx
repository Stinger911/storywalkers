import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { listCourses } from "../../src/lib/coursesApi";
import { getFxRates } from "../../src/lib/fxApi";
import { OnboardingCheckout } from "../../src/routes/onboarding/OnboardingCheckout";

let meState = {
  uid: "u1",
  email: "u1@example.com",
  displayName: "User One",
  role: "student" as const,
  status: "active" as const,
  selectedGoalId: "goal-1",
  selectedGoalTitle: "Video Creator",
  profileForm: {
    telegram: "@alice",
    socialUrl: null,
    experienceLevel: "beginner" as const,
    notes: null,
  },
  selectedCourses: ["course-1"],
  subscriptionSelected: true,
  isFirstHundred: false,
};

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => meState,
  }),
}));

vi.mock("../../src/lib/coursesApi", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/coursesApi")>(
    "../../src/lib/coursesApi",
  );
  return {
    ...actual,
    listCourses: vi.fn(),
  };
});

vi.mock("../../src/lib/fxApi", () => ({
  getFxRates: vi.fn(),
}));

vi.mock("../../src/routes/onboarding/OnboardingLayout", () => ({
  OnboardingLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

describe("OnboardingCheckout", () => {
  beforeEach(() => {
    meState = {
      uid: "u1",
      email: "u1@example.com",
      displayName: "User One",
      role: "student",
      status: "active",
      selectedGoalId: "goal-1",
      selectedGoalTitle: "Video Creator",
      profileForm: {
        telegram: "@alice",
        socialUrl: null,
        experienceLevel: "beginner",
        notes: null,
      },
      selectedCourses: ["course-1"],
      subscriptionSelected: true,
      isFirstHundred: false,
    };
    vi.mocked(listCourses).mockReset();
    vi.mocked(getFxRates).mockReset();
    vi.mocked(getFxRates).mockResolvedValue({
      base: "USD",
      rates: { USD: 1, EUR: 0.9, RUB: 90 },
      updatedAt: null,
    });
  });

  it("renders summary, total and payment instructions", async () => {
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          priceUsdCents: 4000,
          isActive: true,
          goalIds: ["goal-1"],
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Video Creator")).toBeInTheDocument();
    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("StoryWalkers Community")).toBeInTheDocument();
    expect(screen.getByText("$62.22")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Boosty" })).toBeInTheDocument();
    expect(
      screen.getByText("Access is activated manually after review. Please wait for confirmation from the team."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Contact Support" }),
    ).toHaveAttribute("href", "https://t.me/storywalkers_support_bot");
  });

  it("falls back to goal id when goals request fails", async () => {
    meState = {
      ...meState,
      selectedGoalTitle: null,
    };
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

  it("shows crossed out prices and zero total for first hundred students", async () => {
    meState = {
      ...meState,
      isFirstHundred: true,
    };
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          priceUsdCents: 4000,
          isActive: true,
          goalIds: ["goal-1"],
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getAllByText("$40.00")[0]).toHaveClass("line-through");
    expect(screen.getAllByText("$0.00")).toHaveLength(1);
    expect(screen.getAllByText("$22.22")).toHaveLength(2);
    expect(screen.getAllByText("$22.22")[0]).not.toHaveClass("line-through");
    expect(screen.getByRole("link", { name: "Go to Boosty" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are in the first 100 students cohort. No payment is required. The team will confirm your access manually.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Congratulations!")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are one of the first 100 students on our platform. All current and future courses will be free for you.",
      ),
    ).toBeInTheDocument();
  });

  it("still includes mandatory community when saved profile has it disabled", async () => {
    meState = {
      ...meState,
      subscriptionSelected: false,
    };
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          priceUsdCents: 4000,
          isActive: true,
          goalIds: ["goal-1"],
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("StoryWalkers Community")).toBeInTheDocument();
    expect(screen.getByText("$62.22")).toBeInTheDocument();
  });
});
