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
    expect(screen.getByText("Welcome back, Alex")).toBeInTheDocument();
    expect(screen.getByText("Morning, Student")).toBeInTheDocument();
    expect(screen.getByText("Current lesson")).toBeInTheDocument();
    expect(screen.getByText("Lessons")).toBeInTheDocument();
    expect(
      screen.getByText("Your narrative path is waiting. You've completed 0% of your weekly goal."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Import footage").length).toBeGreaterThan(0);
  });

  it("embeds official youtube lesson links in the current lesson card", () => {
    useMyPlanMock.mockReturnValue({
      plan: () => ({ studentUid: "u1", goalId: "g1" }),
      goal: () => ({ title: "Video Editing Basics", description: "Learn the workflow." }),
      steps: () => [
        {
          id: "s1",
          title: "Import footage",
          description: "Bring clips into the editor",
          isDone: false,
          materialUrl: "https://youtu.be/dQw4w9WgXcQ",
        },
      ],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 1, done: 0, percent: 0 }),
      markStepDone: markStepDoneMock,
      completeStep: completeStepMock,
      openMaterial: vi.fn(),
    });

    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    const frame = screen.getByTitle("Import footage");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    );
  });

  it("renders lesson descriptions as markdown", () => {
    useMyPlanMock.mockReturnValue({
      plan: () => ({ studentUid: "u1", goalId: "g1" }),
      goal: () => ({ title: "Video Editing Basics", description: "Learn the workflow." }),
      steps: () => [
        {
          id: "s1",
          title: "Import footage",
          description: "**Bold** with [link](https://example.com)",
          isDone: false,
          materialUrl: "",
        },
      ],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 1, done: 0, percent: 0 }),
      markStepDone: markStepDoneMock,
      completeStep: completeStepMock,
      openMaterial: vi.fn(),
    });

    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    expect(screen.getAllByText("Bold")[0].tagName).toBe("STRONG");
    expect(
      screen.getAllByRole("link", { name: "link" }).every((link) =>
        link.getAttribute("href") === "https://example.com",
      ),
    ).toBe(true);
  });

  it("does not embed non-youtube lesson links", () => {
    useMyPlanMock.mockReturnValue({
      plan: () => ({ studentUid: "u1", goalId: "g1" }),
      goal: () => ({ title: "Video Editing Basics", description: "Learn the workflow." }),
      steps: () => [
        {
          id: "s1",
          title: "Import footage",
          description: "Bring clips into the editor",
          isDone: false,
          materialUrl: "https://example.com/lesson",
        },
      ],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 1, done: 0, percent: 0 }),
      markStepDone: markStepDoneMock,
      completeStep: completeStepMock,
      openMaterial: vi.fn(),
    });

    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    expect(screen.queryByTitle("Import footage")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open" }).length).toBeGreaterThan(0);
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
    expect(screen.getByText("Welcome back, there")).toBeInTheDocument();
  });

  it("opens complete modal and cancels without changing state", async () => {
    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    fireEvent.click(screen.getAllByRole("button", { name: "Mark done" })[0]);
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

    fireEvent.click(screen.getAllByRole("button", { name: "Mark done" })[0]);
    fireEvent.input(screen.getByLabelText("Comment (optional)"), {
      target: { value: "comment" },
    });
    fireEvent.input(screen.getByLabelText("Link (optional)"), {
      target: { value: "https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));

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

    fireEvent.click(screen.getAllByRole("button", { name: "Mark done" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Complete lesson" }));

    await waitFor(() => {
      expect(showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          description: "Backend failed",
        }),
      );
    });
  });

  it("renders locked lesson state and disables lesson actions", () => {
    useMyPlanMock.mockReturnValue({
      plan: () => ({ studentUid: "u1", goalId: "g1" }),
      goal: () => ({ title: "Video Editing Basics", description: "Learn the workflow." }),
      steps: () => [
        {
          id: "s1",
          title: "Locked lesson",
          description: "Finish previous work first",
          isDone: false,
          isLocked: true,
          materialUrl: "https://example.com/lesson",
        },
      ],
      loading: () => false,
      error: () => null,
      progress: () => ({ total: 1, done: 0, percent: 0 }),
      markStepDone: markStepDoneMock,
      completeStep: completeStepMock,
      openMaterial: vi.fn(),
    });

    render(() => (
      <I18nProvider>
        <StudentHome />
      </I18nProvider>
    ));

    expect(screen.getAllByText("Complete previous lessons first").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Open" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.getAllByRole("button", { name: "Mark done" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
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

    expect(screen.getByText("Comment:")).toBeInTheDocument();
    expect(screen.getAllByText("Готово").length).toBeGreaterThan(0);
    const link = screen.getByRole("link", { name: "https://example.com/work" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");

    const commentLabels = screen.getAllByText("Comment:");
    const linkLabels = screen.getAllByText("Link:");
    expect(commentLabels).toHaveLength(1);
    expect(linkLabels).toHaveLength(1);
  });
});
