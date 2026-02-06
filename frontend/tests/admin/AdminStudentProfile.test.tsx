import { render, screen, waitFor, fireEvent } from "@solidjs/testing-library";
import { vi } from "vitest";

import { AdminStudentProfile } from "../../src/routes/admin/AdminStudentProfile";
import {
  getStudent,
  getStudentPlan,
  getStudentPlanSteps,
  listGoals,
  listStepTemplates,
  updateStudent,
} from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ uid: "u1" }),
}));

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
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
      const testId = isRole ? "role-select" : "goal-select";
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

vi.mock("../../src/lib/adminApi", () => ({
  assignPlan: vi.fn(),
  bulkAddSteps: vi.fn(),
  getStudent: vi.fn(),
  getStudentPlan: vi.fn(),
  getStudentPlanSteps: vi.fn(),
  listGoals: vi.fn(),
  listStepTemplates: vi.fn(),
  reorderSteps: vi.fn(),
  updateStudent: vi.fn(),
}));

const getStudentMock = getStudent as unknown as ReturnType<typeof vi.fn>;
const getStudentPlanMock = getStudentPlan as unknown as ReturnType<typeof vi.fn>;
const getStudentPlanStepsMock = getStudentPlanSteps as unknown as ReturnType<typeof vi.fn>;
const listGoalsMock = listGoals as unknown as ReturnType<typeof vi.fn>;
const listStepTemplatesMock = listStepTemplates as unknown as ReturnType<typeof vi.fn>;
const updateStudentMock = updateStudent as unknown as ReturnType<typeof vi.fn>;

describe("AdminStudentProfile", () => {
  beforeEach(() => {
    getStudentMock.mockReset();
    getStudentPlanMock.mockReset();
    getStudentPlanStepsMock.mockReset();
    listGoalsMock.mockReset();
    listStepTemplatesMock.mockReset();
    updateStudentMock.mockReset();
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

    render(() => <AdminStudentProfile />);

    expect(await screen.findByText("Student profile")).toBeInTheDocument();

    const roleSelect = await screen.findByTestId("role-select");
    fireEvent.change(roleSelect, { target: { value: "expert" } });

    const saveButton = screen.getByText("Save access");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateStudentMock).toHaveBeenCalledWith("u1", { role: "expert" });
    });
  });
});
