import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentHome } from "../../src/routes/student/StudentHome";
import { I18nProvider } from "../../src/lib/i18n";
import { useMe } from "../../src/lib/useMe";
import { useMyPlan } from "../../src/routes/student/studentPlanContext";
import { showToast } from "../../src/components/ui/toast";

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

vi.mock("../../src/components/ui/toast", () => ({
  showToast: vi.fn(),
}));

const useMeMock = vi.mocked(useMe);
const useMyPlanMock = vi.mocked(useMyPlan);
const showToastMock = vi.mocked(showToast);

describe("StudentHome", () => {
  let markStepDoneMock: ReturnType<typeof vi.fn>;
  let completeStepMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    markStepDoneMock = vi.fn();
    completeStepMock = vi.fn();
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
      markStepDone: markStepDoneMock,
      completeStep: completeStepMock,
      openMaterial: vi.fn(),
    });
    showToastMock.mockReset();
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
      completeStep: vi.fn(),
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
      completeStep: vi.fn(),
      openMaterial: vi.fn(),
    });
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));
    expect(screen.getByText("fallback@example.com")).toBeInTheDocument();
  });

  it("opens complete modal and cancels without changing state", async () => {
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByText("Mark done"));
    expect(screen.getByText("Comment (optional)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Cancel"));

    expect(completeStepMock).not.toHaveBeenCalled();
    expect(markStepDoneMock).not.toHaveBeenCalled();
  });

  it("submits completion payload and shows loading state", async () => {
    let resolveComplete: () => void = () => {};
    completeStepMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve;
        }),
    );
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByText("Mark done"));
    fireEvent.input(screen.getByLabelText("Comment (optional)"), {
      target: { value: "comment" },
    });
    fireEvent.input(screen.getByLabelText("Link (optional)"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete step" }));

    expect(completeStepMock).toHaveBeenCalledWith("s1", {
      comment: "comment",
      link: "https://example.com",
    });
    expect(screen.getByText("Cancel")).toBeDisabled();

    resolveComplete();
  });

  it("shows toast when completion request fails", async () => {
    completeStepMock.mockRejectedValue(new Error("Backend failed"));
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    fireEvent.click(screen.getByText("Mark done"));
    fireEvent.click(screen.getByRole("button", { name: "Complete step" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          description: "Backend failed",
        }),
      );
    });
  });

  it("renders done comment and link only when values exist", () => {
    useMyPlanMock.mockReturnValue({
      plan: () => ({ studentUid: "u1", goalId: "g1" }),
      goal: () => ({ title: "Video Editing Basics", description: "Learn the workflow." }),
      steps: () => [
        {
          id: "s1",
          title: "Import footage",
          description: "Bring clips into the editor",
          isDone: true,
          doneComment: "Готово",
          doneLink: "https://example.com/work",
        },
        {
          id: "s2",
          title: "Export",
          description: "Export final video",
          isDone: true,
          doneComment: null,
          doneLink: null,
        },
      ],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 2, done: 2, percent: 100 }),
      markStepDone: markStepDoneMock,
      completeStep: completeStepMock,
      openMaterial: vi.fn(),
    });
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    expect(screen.getByText("Комментарий:")).toBeInTheDocument();
    expect(screen.getByText("Готово")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "https://example.com/work" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");

    const commentLabels = screen.getAllByText("Комментарий:");
    const linkLabels = screen.getAllByText("Ссылка:");
    expect(commentLabels).toHaveLength(1);
    expect(linkLabels).toHaveLength(1);
  });
});
