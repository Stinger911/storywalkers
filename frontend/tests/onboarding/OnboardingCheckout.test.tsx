import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { createCheckoutIntent } from "../../src/lib/checkoutApi";
import {
  listCourseLessons,
  listCourses,
  type CourseLesson,
} from "../../src/lib/coursesApi";
import { getFxRates } from "../../src/lib/fxApi";
import { OnboardingCheckout } from "../../src/routes/onboarding/OnboardingCheckout";

type MeState = {
  uid: string;
  email: string;
  displayName: string;
  role: "student";
  status: "active";
  selectedGoalId: string;
  selectedGoalTitle: string | null;
  profileForm: Record<string, unknown>;
  selectedCourses: string[];
  selectedLessons?: { courseId: string; lessonId: string }[];
  subscriptionSelected: boolean | null;
  isFirstHundred: boolean;
};

const refreshMeMock = vi.fn();

const baseMe = (): MeState => ({
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
});

let meState = baseMe();
let readMe: () => MeState | null = () => meState;

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => readMe(),
    patchMe: vi.fn(),
    refreshMe: refreshMeMock,
  }),
}));

vi.mock("../../src/lib/coursesApi", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/coursesApi")>(
    "../../src/lib/coursesApi",
  );
  return {
    ...actual,
    listCourses: vi.fn(),
    listCourseLessons: vi.fn(),
  };
});

vi.mock("../../src/lib/checkoutApi", () => ({
  createCheckoutIntent: vi.fn(),
}));

vi.mock("../../src/lib/fxApi", () => ({
  getFxRates: vi.fn(),
}));

vi.mock("../../src/routes/onboarding/OnboardingLayout", () => ({
  OnboardingLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

const courseOne = {
  id: "course-1",
  title: "Course One",
  shortDescription: "Desc one",
  priceUsdCents: 4000,
  trialLessonUrl: null,
  isActive: true,
  goalIds: ["goal-1"],
  lessonCount: 4,
};

describe("OnboardingCheckout", () => {
  beforeEach(() => {
    meState = baseMe();
    readMe = () => meState;
    refreshMeMock.mockReset();
    refreshMeMock.mockResolvedValue(undefined);
    vi.mocked(listCourses).mockReset();
    vi.mocked(listCourseLessons).mockReset();
    vi.mocked(createCheckoutIntent).mockReset();
    vi.mocked(getFxRates).mockReset();
    vi.mocked(getFxRates).mockResolvedValue({
      base: "USD",
      rates: { USD: 1, EUR: 0.9, RUB: 90 },
      updatedAt: null,
    });
  });

  it("loads lesson titles when the account arrives after mount", async () => {
    const [account, setAccount] = createSignal<MeState | null>(null);
    readMe = account;
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });
    vi.mocked(listCourseLessons).mockResolvedValue({
      items: [{ id: "lesson-1", title: "Lesson One" } as CourseLesson],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));
    setAccount({
      ...baseMe(),
      selectedCourses: [],
      selectedLessons: [{ courseId: "course-1", lessonId: "lesson-1" }],
    });

    expect(await screen.findByText("Course One · Lesson One")).toBeInTheDocument();
    expect(listCourseLessons).toHaveBeenCalledTimes(1);
  });

  it("reloads the account and opens the dashboard after a free checkout", async () => {
    meState = { ...baseMe(), isFirstHundred: true };
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });
    vi.mocked(createCheckoutIntent).mockResolvedValue({
      paymentId: "p1",
      redirectUrl: "https://boosty.example/pay",
      amount: 0,
      currency: "USD",
      activationCode: "SW-FREE1234",
      instructionsText: "No payment is required.",
    });
    let finishRefresh = () => {};
    refreshMeMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRefresh = resolve;
      }),
    );

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));
    fireEvent.click(
      screen.getByRole("button", { name: "Create payment instructions" }),
    );

    await waitFor(() => expect(refreshMeMock).toHaveBeenCalledTimes(1));
    // Not offered until the account is reloaded.
    expect(screen.queryByRole("link", { name: "Go to dashboard" })).toBeNull();
    finishRefresh();

    expect(
      await screen.findByRole("link", { name: "Go to dashboard" }),
    ).toHaveAttribute("href", "/student/home");
    expect(screen.getByRole("status")).toHaveTextContent("Your access is open.");
    expect(screen.queryByRole("link", { name: "Back" })).toBeNull();
    expect(screen.queryByText("No payment is required.")).toBeNull();
    // The community price stays on the screen, with the way to pay it.
    expect(screen.getAllByText("$22.22")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Go to Boosty" })).toHaveAttribute(
      "href",
      "https://boosty.example/pay",
    );
  });

  it("renders summary, total and creates a payment intent", async () => {
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });
    vi.mocked(createCheckoutIntent).mockResolvedValue({
      paymentId: "p1",
      redirectUrl: "https://boosty.example/pay",
      amount: 2222,
      currency: "USD",
      activationCode: "SW-TEST1234",
      instructionsText:
        "Complete payment on Boosty, then contact support with this activation code.",
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Video Creator")).toBeInTheDocument();
    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("StoryWalkers Community")).toBeInTheDocument();
    // Community subscription: 200000 RUB cents / 90 = $22.22, shown in the row and in the total.
    expect(screen.getAllByText("$22.22")).toHaveLength(2);
    expect(
      screen.getByText("Access is activated manually after review. Please wait for confirmation from the team."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Contact Support" }),
    ).toHaveAttribute("href", "https://t.me/storywalkers_support_bot");

    fireEvent.click(
      screen.getByRole("button", { name: "Create payment instructions" }),
    );

    await waitFor(() => {
      expect(createCheckoutIntent).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
      });
    });
    expect(await screen.findByText("SW-TEST1234")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Boosty" })).toHaveAttribute(
      "href",
      "https://boosty.example/pay",
    );
  });

  it("falls back to goal id when goals request fails", async () => {
    meState = { ...baseMe(), selectedGoalTitle: null };
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

  it("shows selected lessons with prices and includes them in the total", async () => {
    meState = {
      ...baseMe(),
      selectedCourses: [],
      selectedLessons: [{ courseId: "course-1", lessonId: "lesson-1" }],
    };
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });
    vi.mocked(listCourseLessons).mockResolvedValue({
      items: [
        {
          id: "lesson-1",
          title: "Lesson One",
          content: "Content",
          materialUrl: null,
          order: 0,
          isActive: true,
        },
      ],
    });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText(/Lesson One/)).toBeInTheDocument();
    // round(4000 / 4) = 1000 → $10.00 per lesson.
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    // Total: $22.22 community + $10.00 lesson = $32.22.
    expect(screen.getByText("$32.22")).toBeInTheDocument();
  });

  it("shows the congratulations card for first hundred students", async () => {
    meState = { ...baseMe(), isFirstHundred: true };
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("Congratulations!")).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are one of the first 100 students on our platform. All current and future courses will be free for you.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "You are among the first 100 students. Access opens automatically.",
      ),
    ).toBeInTheDocument();
    expect(
      screen
        .getByText("Congratulations!")
        .compareDocumentPosition(screen.getByText("Summary")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("still includes mandatory community when saved profile has it disabled", async () => {
    meState = { ...baseMe(), subscriptionSelected: false };
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });

    render(() => (
      <I18nProvider>
        <OnboardingCheckout />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("StoryWalkers Community")).toBeInTheDocument();
    expect(screen.getAllByText("$22.22")).toHaveLength(2);
  });
});
