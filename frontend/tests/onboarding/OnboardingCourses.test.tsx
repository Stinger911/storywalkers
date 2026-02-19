import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingCourses } from "../../src/routes/onboarding/OnboardingCourses";
import { listCourses } from "../../src/lib/coursesApi";

const patchMeMock = vi.fn();
const navigateMock = vi.fn();

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
      selectedCourses: [],
      subscriptionSelected: null,
    }),
    patchMe: patchMeMock,
  }),
}));

vi.mock("../../src/lib/coursesApi", () => ({
  listCourses: vi.fn(),
}));

vi.mock("../../src/routes/onboarding/OnboardingLayout", () => ({
  OnboardingLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

describe("OnboardingCourses", () => {
  beforeEach(() => {
    vi.mocked(listCourses).mockReset();
    patchMeMock.mockReset();
    navigateMock.mockReset();
  });

  it("renders course cards and persists selected courses on Next", async () => {
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          shortDescription: "Desc one",
          price: 40,
          isActive: true,
        },
        {
          id: "course-2",
          title: "Course Two",
          shortDescription: "Desc two",
          price: 60,
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

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByText("Community"));
    expect(screen.getByText("$59")).toBeInTheDocument();

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
          price: 40,
          isActive: true,
        },
        {
          id: "course-2",
          title: "Course Two",
          shortDescription: "Desc two",
          price: 60,
          isActive: false,
        },
      ],
    });
    patchMeMock.mockResolvedValue({});

    render(() => (
      <I18nProvider>
        <OnboardingCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("Unavailable courses")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getByText("Course Two")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Course One"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        selectedCourses: ["course-1"],
        subscriptionSelected: undefined,
      });
    });
  });
});
