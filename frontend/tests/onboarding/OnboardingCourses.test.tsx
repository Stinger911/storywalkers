import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingCourses } from "../../src/routes/onboarding/OnboardingCourses";
import { listCourses } from "../../src/lib/coursesApi";
import { getFxRates } from "../../src/lib/fxApi";

const patchMeMock = vi.fn();
const navigateMock = vi.fn();
let meState = {
  uid: "u1",
  email: "u1@example.com",
  displayName: "User One",
  role: "student" as const,
  status: "active" as const,
  selectedGoalId: "goal-1",
  profileForm: {
    aboutMe: "About me",
    telegram: "@alice",
    socialUrl: null,
    experienceLevel: "beginner" as const,
    notes: null,
  },
  selectedCourses: [],
  subscriptionSelected: null,
  isFirstHundred: false,
};

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => meState,
    patchMe: patchMeMock,
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

describe("OnboardingCourses", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    meState = {
      uid: "u1",
      email: "u1@example.com",
      displayName: "User One",
      role: "student",
      status: "active",
      selectedGoalId: "goal-1",
      profileForm: {
        aboutMe: "About me",
        telegram: "@alice",
        socialUrl: null,
        experienceLevel: "beginner",
        notes: null,
      },
      selectedCourses: [],
      subscriptionSelected: null,
      isFirstHundred: false,
    };
    vi.mocked(listCourses).mockReset();
    vi.mocked(getFxRates).mockReset();
    patchMeMock.mockReset();
    navigateMock.mockReset();
    vi.mocked(getFxRates).mockResolvedValue({
      base: "USD",
      rates: { USD: 1, EUR: 0.9, PLN: 4.0, RUB: 90 },
      updatedAt: null,
    });
  });

  it("renders course cards and persists selected courses on Next", async () => {
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          priceUsdCents: 4000,
          isActive: true,
          goalIds: ["goal-1"],
          lessonCount: 6,
        },
        {
          id: "course-2",
          title: "Course Two",
          shortDescription: "Desc two",
          priceUsdCents: 6000,
          isActive: true,
          goalIds: ["goal-1"],
          lessonCount: 3,
        },
      ],
    });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("Mandatory")).toBeInTheDocument();
    expect(screen.getByText("Included by default")).toBeInTheDocument();
    expect(screen.getByText("6 steps")).toBeInTheDocument();
    expect(listCourses).toHaveBeenCalledWith({ goalId: "goal-1" });

    fireEvent.click(screen.getByText("Course One"));
    await waitFor(() => {
      expect(screen.getByText("$62.22")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        subscriptionSelected: true,
      });
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/checkout");
    });
  });

  it("shows inactive courses separately and does not include them in payload", async () => {
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          priceUsdCents: 4000,
          isActive: true,
          goalIds: ["goal-1"],
          lessonCount: 6,
        },
        {
          id: "course-2",
          title: "Course Two",
          shortDescription: "Desc two",
          priceUsdCents: 6000,
          isActive: false,
          goalIds: ["goal-1"],
          lessonCount: 4,
        },
      ],
    });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Unavailable paths")).toBeInTheDocument();
    expect(listCourses).toHaveBeenCalledWith({ goalId: "goal-1" });
    expect(screen.getByText("Course Two")).toBeInTheDocument();
    expect(screen.getByText("4 steps")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        subscriptionSelected: true,
      });
    });
  });

  it("keeps community paid for first hundred students", async () => {
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
          lessonCount: 6,
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toHaveClass("line-through");
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$22.22")).toHaveLength(2);
    expect(screen.getAllByText("$22.22")[0]).not.toHaveClass("line-through");

    fireEvent.click(screen.getByText("Course One"));
    await waitFor(() => {
      expect(screen.getAllByText("$22.22")).toHaveLength(2);
    });
  });

  it("forces community to stay selected even when saved profile has it disabled", async () => {
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
          lessonCount: 6,
        },
      ],
    });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("StoryWalkers Community")).toBeInTheDocument();
    expect(screen.getAllByText("$22.22").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        subscriptionSelected: true,
      });
    });
  });

  it("does not load courses when auth state has no selectedGoalId", async () => {
    meState = {
      ...meState,
      selectedGoalId: null,
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
          lessonCount: 6,
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    expect(listCourses).not.toHaveBeenCalled();
  });

  it("navigates back to goal step from courses", async () => {
    vi.mocked(listCourses).mockResolvedValue({ items: [] });

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/goal");
    });
  });

  it("allows continuing to checkout with community access only", async () => {
    vi.mocked(listCourses).mockResolvedValue({ items: [] });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: [],
        subscriptionSelected: true,
      });
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/checkout");
    });
  });
});
