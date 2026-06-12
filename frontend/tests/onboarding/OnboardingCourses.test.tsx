import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingCourses } from "../../src/routes/onboarding/OnboardingCourses";
import { listCourseLessons, listCourses } from "../../src/lib/coursesApi";

const patchMeMock = vi.fn();
const navigateMock = vi.fn();
type MeState = {
  uid: string;
  email: string;
  displayName: string;
  role: "student";
  status: "active";
  selectedGoalId: string | null;
  profileForm: Record<string, unknown>;
  selectedCourses: string[];
  selectedLessons?: { courseId: string; lessonId: string }[];
  subscriptionSelected: boolean | null;
  isFirstHundred: boolean;
};

const baseMe = (): MeState => ({
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
});

let meState = baseMe();

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
    listCourseLessons: vi.fn(),
  };
});

vi.mock("../../src/lib/adminApi", () => ({
  listGoals: vi.fn(async () => ({ items: [] })),
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
  lessonCount: 6,
};

const courseTwo = {
  id: "course-2",
  title: "Course Two",
  shortDescription: "Desc two",
  priceUsdCents: 6000,
  trialLessonUrl: null,
  isActive: true,
  goalIds: ["goal-1"],
  lessonCount: 3,
};

describe("OnboardingCourses", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    meState = baseMe();
    vi.mocked(listCourses).mockReset();
    vi.mocked(listCourseLessons).mockReset();
    patchMeMock.mockReset();
    navigateMock.mockReset();
  });

  it("renders course cards and persists selected courses on Next", async () => {
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne, courseTwo] });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("6 steps")).toBeInTheDocument();
    expect(listCourses).toHaveBeenCalledWith({ goalId: "goal-1" });

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        selectedLessons: [],
        subscriptionSelected: true,
      });
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/checkout");
    });
  });

  it("does not render inactive courses and keeps them out of the payload", async () => {
    vi.mocked(listCourses).mockResolvedValue({
      items: [courseOne, { ...courseTwo, isActive: false }],
    });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.queryByText("Course Two")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        selectedLessons: [],
        subscriptionSelected: true,
      });
    });
  });

  it("forces subscriptionSelected even when saved profile has it disabled", async () => {
    meState = { ...baseMe(), subscriptionSelected: false };
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        selectedLessons: [],
        subscriptionSelected: true,
      });
    });
  });

  it("supports picking individual lessons instead of the whole course", async () => {
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
        {
          id: "lesson-2",
          title: "Lesson Two",
          content: "Content",
          materialUrl: null,
          order: 1,
          isActive: true,
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

    fireEvent.click(screen.getByRole("button", { name: "Pick individual lessons" }));

    expect(await screen.findByText("Lesson One")).toBeInTheDocument();
    // round(4000 / 6) = 667 → $6.67 per lesson
    expect(screen.getAllByText(/\$6\.67/).length).toBeGreaterThan(0);

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: [],
        selectedLessons: [{ courseId: "course-1", lessonId: "lesson-1" }],
        subscriptionSelected: true,
      });
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/checkout");
    });
  });

  it("does not load courses when auth state has no selectedGoalId", async () => {
    meState = { ...baseMe(), selectedGoalId: null };
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    expect(listCourses).not.toHaveBeenCalled();
  });

  it("navigates back to profile step from courses", async () => {
    vi.mocked(listCourses).mockResolvedValue({ items: [] });

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/profile");
    });
  });

  it("keeps Next disabled until a course or lesson is selected", async () => {
    vi.mocked(listCourses).mockResolvedValue({ items: [courseOne] });

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByText("Course One"));
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();
  });
});
