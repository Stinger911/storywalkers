import { render, screen, waitFor, fireEvent } from "@solidjs/testing-library";
import { vi } from "vitest";

import { AdminStudentProfile } from "../../src/routes/admin/AdminStudentProfile";
import { AppShell } from "../../src/components/AppShell";
import { I18nProvider } from "../../src/lib/i18n";
import {
  getStudent,
  getStudentPlan,
  getStudentPlanSteps,
  listGoals,
  listStepTemplates,
  previewResetFromGoal,
  updateStudent,
  assignPlan,
  deleteStudent,
  deleteStudentPlanStep,
} from "../../src/lib/adminApi";

const navigateMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ uid: "u1" }),
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => ({ role: "staff" }),
  }),
}));

vi.mock("../../src/components/ui/select", () => {
  return {
    Select: (props: {
      value?: { value: string; label: string } | null;
      onChange?: (value: { value: string; label: string } | null) => void;
      options?: { value: string; label: string }[];
      children?: unknown;
    }) => {
      const isRole =
        (props.options || []).some((option) => option.label === "Student") ?? false;
      const isStatus =
        (props.options || []).some((option) => option.label === "Active") ?? false;
      const testId = isRole
        ? "role-select"
        : isStatus
          ? "status-select"
          : "goal-select";
      const currentValue = props.value?.value ?? "";
      return (
        <select
          data-testid={testId}
          value={currentValue}
          onChange={(e) => {
            const next = (props.options || []).find(
              (option) => option.value === e.currentTarget.value,
            );
            props.onChange?.(next ?? null);
          }}
        >
          {(props.options || []).map((option) => (
            <option value={option.value}>{option.label}</option>
          ))}
          {props.children as never}
        </select>
      );
    },
    SelectContent: (props: { children?: unknown }) => <>{props.children}</>,
    SelectHiddenSelect: (props: { children?: unknown }) => <>{props.children}</>,
    SelectItem: (props: { children?: unknown }) => <>{props.children}</>,
    SelectLabel: (props: { children?: unknown }) => <>{props.children}</>,
    SelectTrigger: (props: { children?: unknown }) => <>{props.children}</>,
    SelectValue: (props: { children?: unknown }) => <>{props.children}</>,
  };
});

vi.mock("../../src/components/ui/editable-text", () => ({
  EditableText: (props: { value: string; onSave: (value: string) => Promise<void> }) => (
    <button onClick={() => void props.onSave("New Name")}>{props.value}</button>
  ),
}));

vi.mock("../../src/lib/adminApi", () => ({
  assignPlan: vi.fn(),
  bulkAddSteps: vi.fn(),
  deleteStudent: vi.fn(),
  deleteStudentPlanStep: vi.fn(),
  getStudent: vi.fn(),
  getStudentPlan: vi.fn(),
  getStudentPlanSteps: vi.fn(),
  listGoals: vi.fn(),
  listStepTemplates: vi.fn(),
  previewResetFromGoal: vi.fn(),
  reorderSteps: vi.fn(),
  updateStudent: vi.fn(),
}));

const getStudentMock = getStudent as unknown as ReturnType<typeof vi.fn>;
const getStudentPlanMock = getStudentPlan as unknown as ReturnType<typeof vi.fn>;
const getStudentPlanStepsMock = getStudentPlanSteps as unknown as ReturnType<typeof vi.fn>;
const listGoalsMock = listGoals as unknown as ReturnType<typeof vi.fn>;
const listStepTemplatesMock = listStepTemplates as unknown as ReturnType<typeof vi.fn>;
const updateStudentMock = updateStudent as unknown as ReturnType<typeof vi.fn>;
const previewResetMock = previewResetFromGoal as unknown as ReturnType<typeof vi.fn>;
const assignPlanMock = assignPlan as unknown as ReturnType<typeof vi.fn>;
const deleteStudentMock = deleteStudent as unknown as ReturnType<typeof vi.fn>;
const deleteStudentPlanStepMock = deleteStudentPlanStep as unknown as ReturnType<
  typeof vi.fn
>;

const renderWithShell = () =>
  render(() => (
    <I18nProvider>
      <AppShell title="Admin" roleLabel="Admin" onLogout={() => {}}>
        <AdminStudentProfile />
      </AppShell>
    </I18nProvider>
  ));

describe("AdminStudentProfile", () => {
  beforeEach(() => {
    getStudentMock.mockReset();
    getStudentPlanMock.mockReset();
    getStudentPlanStepsMock.mockReset();
    listGoalsMock.mockReset();
    listStepTemplatesMock.mockReset();
    updateStudentMock.mockReset();
    previewResetMock.mockReset();
    assignPlanMock.mockReset();
    deleteStudentMock.mockReset();
    deleteStudentPlanStepMock.mockReset();
    navigateMock.mockReset();
  });

  it("updates role via access controls", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      displayName: "Student One",
      email: "s1@x.com",
      role: "student",
    });
    getStudentPlanMock.mockRejectedValue(new Error("no plan"));
    getStudentPlanStepsMock.mockResolvedValue({ items: [] });
    listGoalsMock.mockResolvedValue({ items: [] });
    listStepTemplatesMock.mockResolvedValue({ items: [] });
    updateStudentMock.mockResolvedValue({ role: "expert" });

    renderWithShell();

    expect(await screen.findByText("Student profile")).toBeInTheDocument();

    const roleSelect = await screen.findByTestId("role-select");
    fireEvent.change(roleSelect, { target: { value: "expert" } });

    const saveButton = screen.getByText("Save access");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateStudentMock).toHaveBeenCalledWith("u1", {
        role: "expert",
        status: "active",
      });
    });
  });

  it("updates status via access controls", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      displayName: "Student One",
      email: "s1@x.com",
      role: "student",
      status: "active",
    });
    getStudentPlanMock.mockRejectedValue(new Error("no plan"));
    getStudentPlanStepsMock.mockResolvedValue({ items: [] });
    listGoalsMock.mockResolvedValue({ items: [] });
    listStepTemplatesMock.mockResolvedValue({ items: [] });
    updateStudentMock.mockResolvedValue({ role: "student", status: "disabled" });

    renderWithShell();

    const statusSelect = await screen.findByTestId("status-select");
    fireEvent.change(statusSelect, { target: { value: "disabled" } });

    const saveButton = screen.getByText("Save access");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateStudentMock).toHaveBeenCalledWith("u1", {
        role: "student",
        status: "disabled",
      });
    });
  });

  it("updates display name inline", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      displayName: "Student One",
      email: "s1@x.com",
      role: "student",
    });
    getStudentPlanMock.mockRejectedValue(new Error("no plan"));
    getStudentPlanStepsMock.mockResolvedValue({ items: [] });
    listGoalsMock.mockResolvedValue({ items: [] });
    listStepTemplatesMock.mockResolvedValue({ items: [] });
    updateStudentMock.mockResolvedValue({ displayName: "New Name" });

    renderWithShell();

    const nameButton = await screen.findByText("Student One");
    fireEvent.click(nameButton);

    await waitFor(() => {
      expect(updateStudentMock).toHaveBeenCalledWith("u1", {
        displayName: "New Name",
      });
    });
  });

  it("previews and confirms reset from goal template", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      displayName: "Student One",
      email: "s1@x.com",
      role: "student",
    });
    getStudentPlanMock.mockResolvedValue({ goalId: "" });
    getStudentPlanStepsMock.mockResolvedValue({ items: [] });
    listGoalsMock.mockResolvedValue({ items: [{ id: "g1", title: "Goal 1" }] });
    listStepTemplatesMock.mockResolvedValue({ items: [] });
    previewResetMock.mockResolvedValue({
      existingSteps: 3,
      willCreateSteps: 4,
      willLoseProgressStepsDone: 1,
      sampleTitles: ["Step A", "Step B"],
    });
    assignPlanMock.mockResolvedValue({ planId: "u1", goalId: "g1" });

    renderWithShell();

    await screen.findByText("Goal 1");
    const goalSelects = await screen.findAllByTestId("goal-select");
    const goalSelect = goalSelects.find((select) =>
      Array.from((select as HTMLSelectElement).options).some(
        (option) => option.value === "g1",
      ),
    );
    if (!goalSelect) {
      throw new Error("Goal select not found");
    }
    fireEvent.change(goalSelect, { target: { value: "g1" } });

    const resetButton = await screen.findByText(
      "Assign goal + Replace steps from template",
    );
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(previewResetMock).toHaveBeenCalledWith("u1", "g1");
    });

    expect(
      await screen.findByText(
        "This will delete 3 steps including 1 done. Irreversible.",
      ),
    ).toBeInTheDocument();

    const acknowledge = screen.getByTestId("reset-acknowledge");
    fireEvent.click(acknowledge);

    const confirmInput = screen.getByTestId("reset-confirm-input");
    fireEvent.input(confirmInput, { target: { value: "RESET_STEPS" } });

    const confirmButton = screen.getByTestId("reset-confirm-button");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(assignPlanMock).toHaveBeenCalledWith("u1", "g1", {
        resetStepsFromGoalTemplate: true,
        confirm: "RESET_STEPS",
      });
    });
  });

  it("deletes a step from the plan", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      displayName: "Student One",
      email: "s1@x.com",
      role: "student",
    });
    getStudentPlanMock.mockResolvedValue({ goalId: "g1" });
    getStudentPlanStepsMock.mockResolvedValue({
      items: [
        {
          stepId: "s1",
          title: "Step One",
          description: "Do it",
          materialUrl: "",
          order: 0,
          isDone: false,
        },
      ],
    });
    listGoalsMock.mockResolvedValue({ items: [] });
    listStepTemplatesMock.mockResolvedValue({ items: [] });
    deleteStudentPlanStepMock.mockResolvedValue({ deleted: "s1" });

    renderWithShell();

    await screen.findByText("Step One");

    const deleteButton = await screen.findByLabelText("Delete step");
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteStudentPlanStepMock).toHaveBeenCalledWith("u1", "s1");
    });
  });

  it("deletes a student with double confirmation", async () => {
    getStudentMock.mockResolvedValue({
      uid: "u1",
      displayName: "Student One",
      email: "s1@x.com",
      role: "student",
    });
    getStudentPlanMock.mockResolvedValue({ goalId: "g1" });
    getStudentPlanStepsMock.mockResolvedValue({ items: [] });
    listGoalsMock.mockResolvedValue({ items: [] });
    listStepTemplatesMock.mockResolvedValue({ items: [] });
    deleteStudentMock.mockResolvedValue({
      deleted: "u1",
      deletedSteps: 0,
      deletedCompletions: 0,
    });

    renderWithShell();

    const openDelete = await screen.findByTestId("open-delete-student");
    fireEvent.click(openDelete);

    const acknowledge = await screen.findByTestId("delete-student-acknowledge");
    fireEvent.click(acknowledge);
    const confirmInput = screen.getByTestId("delete-student-confirm-input");
    fireEvent.input(confirmInput, { target: { value: "DELETE" } });

    const confirmButton = screen.getByTestId("delete-student-confirm-button");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteStudentMock).toHaveBeenCalledWith("u1");
      expect(navigateMock).toHaveBeenCalledWith("/admin/students", {
        replace: true,
      });
    });
  });
});
