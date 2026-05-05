import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../../src/components/AppShell";
import { I18nProvider } from "../../src/lib/i18n";
import { ThemeProvider } from "../../src/lib/theme";
import { AdminStudentDashboardPreview } from "../../src/routes/admin/AdminStudentDashboardPreview";
import { getStudent, getStudentPlan, getStudentPlanSteps, listGoals } from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children?: unknown }) => <a href={props.href}>{props.children}</a>,
  useParams: () => ({ uid: "u1" }),
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => ({ displayName: "Admin User", role: "staff" }),
    loading: () => false,
    logout: async () => {},
  }),
}));

vi.mock("../../src/lib/adminApi", () => ({
  getStudent: vi.fn(),
  getStudentPlan: vi.fn(),
  getStudentPlanSteps: vi.fn(),
  listGoals: vi.fn(),
}));

const getStudentMock = getStudent as unknown as ReturnType<typeof vi.fn>;
const getStudentPlanMock = getStudentPlan as unknown as ReturnType<typeof vi.fn>;
const getStudentPlanStepsMock = getStudentPlanSteps as unknown as ReturnType<typeof vi.fn>;
const listGoalsMock = listGoals as unknown as ReturnType<typeof vi.fn>;

const renderWithShell = () =>
  render(() => (
    <ThemeProvider>
      <I18nProvider>
        <AppShell title="Admin" roleLabel="Admin" onLogout={() => {}}>
          <AdminStudentDashboardPreview />
        </AppShell>
      </I18nProvider>
    </ThemeProvider>
  ));

describe("AdminStudentDashboardPreview", () => {
  beforeEach(() => {
    getStudentMock.mockReset();
    getStudentPlanMock.mockReset();
    getStudentPlanStepsMock.mockReset();
    listGoalsMock.mockReset();
  });

  it("renders a read-only student dashboard preview", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      email: "alex@example.com",
      displayName: "Alex Rivera",
      role: "student",
      status: "active",
      roleRaw: "student",
      selectedGoalId: "g1",
      profileForm: {
        aboutMe: "About me",
        telegram: "@alex",
      },
      selectedCourses: ["course-1"],
    });
    getStudentPlanMock.mockResolvedValue({ studentUid: "u1", goalId: "g1" });
    getStudentPlanStepsMock.mockResolvedValue({
      items: [
        {
          stepId: "s1",
          title: "Import footage",
          description: "Bring clips into the editor",
          materialUrl: "",
          order: 0,
          isDone: false,
        },
      ],
    });
    listGoalsMock.mockResolvedValue({
      items: [{ id: "g1", title: "Video Editing Basics", description: "Goal" }],
    });

    renderWithShell();

    expect(await screen.findByText("Student dashboard preview")).toBeInTheDocument();
    expect(await screen.findByText("Preview mode. This dashboard is read-only for admins.")).toBeInTheDocument();
    expect(await screen.findByText("Welcome back, Alex")).toBeInTheDocument();
    expect(await screen.findByText("Previewing")).toBeInTheDocument();
    expect(await screen.findByText("Alex Rivera")).toBeInTheDocument();
    expect(await screen.findByText("alex@example.com")).toBeInTheDocument();
    expect(await screen.findByText("Path steps")).toBeInTheDocument();
    expect(await screen.findAllByText("Import footage")).not.toHaveLength(0);
  });
});
