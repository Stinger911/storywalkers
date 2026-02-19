import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StudentHomeRoute } from "../../src/routes/student/StudentHomeRoute";

type AuthMe = {
  role: "student" | "staff";
  selectedGoalId?: string | null;
  profileForm?: {
    telegram?: string | null;
    socialUrl?: string | null;
    experienceLevel?: "beginner" | "intermediate" | "advanced" | null;
    notes?: string | null;
  };
  selectedCourses?: string[];
};

let loadingState = false;
let meState: AuthMe | null = null;

vi.mock("@solidjs/router", () => ({
  Navigate: (props: { href: string }) => <div data-testid="navigate">{props.href}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    loading: () => loadingState,
    me: () => meState,
  }),
}));

vi.mock("../../src/routes/student/StudentLayout", () => ({
  StudentLayout: (props: { children?: unknown }) => (
    <div data-testid="student-layout">{props.children}</div>
  ),
}));

vi.mock("../../src/routes/student/StudentProfile", () => ({
  StudentProfile: () => <div data-testid="student-profile">Student profile</div>,
  StudentProfileRail: () => <div data-testid="student-profile-rail">Rail</div>,
}));

const completedStudent = (): AuthMe => ({
  role: "student",
  selectedGoalId: "goal-1",
  profileForm: {
    telegram: "@user",
    socialUrl: null,
    experienceLevel: null,
    notes: null,
  },
  selectedCourses: ["course-1"],
});

describe("StudentHomeRoute", () => {
  beforeEach(() => {
    loadingState = false;
    meState = null;
  });

  it("redirects to login when not authenticated", () => {
    render(() => <StudentHomeRoute />);
    expect(screen.getByTestId("navigate")).toHaveTextContent("/login");
  });

  it("redirects staff to admin home", () => {
    meState = { role: "staff" };
    render(() => <StudentHomeRoute />);
    expect(screen.getByTestId("navigate")).toHaveTextContent("/admin/home");
  });

  it("redirects to onboarding step when onboarding is incomplete", () => {
    meState = { role: "student", selectedGoalId: null, profileForm: {}, selectedCourses: [] };
    render(() => <StudentHomeRoute />);
    expect(screen.getByTestId("navigate")).toHaveTextContent("/onboarding/goal");
  });

  it("renders student home shell when onboarding is complete", () => {
    meState = completedStudent();
    render(() => <StudentHomeRoute />);
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    expect(screen.getByTestId("student-layout")).toBeInTheDocument();
    expect(screen.getByTestId("student-profile")).toBeInTheDocument();
  });
});
