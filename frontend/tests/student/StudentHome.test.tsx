import { render, screen } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentHome } from "../../src/routes/student/StudentHome";
import { I18nProvider } from "../../src/lib/i18n";
import { useMe } from "../../src/lib/useMe";
import { useMyPlan } from "../../src/routes/student/studentPlanContext";

vi.mock("../../src/components/ui/editable-display-name", () => ({
  EditableDisplayName: (props: { displayName?: string; email?: string }) => (
    <span>{props.displayName || props.email}</span>
  ),
}));

vi.mock("../../src/lib/useMe", () => ({
  useMe: vi.fn(),
}));

vi.mock("../../src/routes/student/studentPlanContext", () => ({
  useMyPlan: vi.fn(),
}));

const useMeMock = vi.mocked(useMe);
const useMyPlanMock = vi.mocked(useMyPlan);

describe("StudentHome", () => {
  beforeEach(() => {
    useMeMock.mockReturnValue({
      me: () => ({
        displayName: "Alex Rivera",
        email: "alex@example.com",
        roleRaw: "student",
      }),
    });
    useMyPlanMock.mockReturnValue({
      plan: () => ({ studentUid: "u1", goalId: "g1" }),
      goal: () => ({ title: "Video Editing Basics", description: "Learn the workflow." }),
      steps: () => [
        { id: "s1", title: "Import footage", description: "Bring clips into the editor", isDone: false },
      ],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 1, done: 0, percent: 0 }),
      markStepDone: vi.fn(),
      openMaterial: vi.fn(),
    });
  });

  it("renders greeting and steps", () => {
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));
    expect(screen.getByText("Hi, Alex!")).toBeInTheDocument();
    expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Current step")).toBeInTheDocument();
    expect(screen.getAllByText("Import footage").length).toBeGreaterThan(0);
  });

  it("shows empty goal state when no plan", () => {
    useMyPlanMock.mockReturnValue({
      plan: () => null,
      goal: () => null,
      steps: () => [],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 0, done: 0, percent: 0 }),
      markStepDone: vi.fn(),
      openMaterial: vi.fn(),
    });
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));
    expect(screen.getByText("No goal assigned")).toBeInTheDocument();
  });

  it("falls back to email when display name missing", () => {
    useMeMock.mockReturnValue({
      me: () => ({ displayName: "", email: "fallback@example.com", roleRaw: "student" }),
    });
    useMyPlanMock.mockReturnValue({
      plan: () => null,
      goal: () => null,
      steps: () => [],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 0, done: 0, percent: 0 }),
      markStepDone: vi.fn(),
      openMaterial: vi.fn(),
    });
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));
    expect(screen.getByText("fallback@example.com")).toBeInTheDocument();
  });
});
