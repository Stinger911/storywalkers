import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { AdminStepCompletions } from "../../src/routes/admin/AdminStepCompletions";
import {
  listStepCompletions,
  patchStepCompletion,
  revokeStepCompletion,
} from "../../src/lib/adminApi";
import { showToast } from "../../src/components/ui/toast";

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

vi.mock("../../src/lib/adminApi", () => ({
  listStepCompletions: vi.fn(),
  patchStepCompletion: vi.fn(),
  revokeStepCompletion: vi.fn(),
}));

vi.mock("../../src/components/ui/toast", () => ({
  showToast: vi.fn(),
}));

const listStepCompletionsMock = listStepCompletions as unknown as ReturnType<
  typeof vi.fn
>;
const patchStepCompletionMock = patchStepCompletion as unknown as ReturnType<
  typeof vi.fn
>;
const revokeStepCompletionMock = revokeStepCompletion as unknown as ReturnType<
  typeof vi.fn
>;
const showToastMock = showToast as unknown as ReturnType<typeof vi.fn>;

describe("AdminStepCompletions", () => {
  beforeEach(() => {
    listStepCompletionsMock.mockReset();
    patchStepCompletionMock.mockReset();
    revokeStepCompletionMock.mockReset();
    showToastMock.mockReset();
  });

  it("edits a row inline and saves via patch", async () => {
    listStepCompletionsMock.mockResolvedValue({
      items: [
        {
          id: "c1",
          stepId: "s1",
          studentUid: "u1",
          studentDisplayName: "Student One",
          stepTitle: "Step One",
          comment: "Old comment",
          link: "https://old.example",
          status: "completed",
          completedAt: "2026-02-11T10:00:00Z",
        },
      ],
    });
    patchStepCompletionMock.mockResolvedValue({ status: "updated", id: "c1" });

    render(() => <AdminStepCompletions />);

    expect(await screen.findByText("Old comment")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Edit completion c1"));

    const commentInput = await screen.findByTestId("edit-comment-c1");
    const linkInput = screen.getByTestId("edit-link-c1");

    fireEvent.input(commentInput, { target: { value: "Updated comment" } });
    fireEvent.input(linkInput, { target: { value: "https://new.example" } });

    fireEvent.click(screen.getByLabelText("Save edit c1"));

    await waitFor(() => {
      expect(patchStepCompletionMock).toHaveBeenCalledWith("c1", {
        comment: "Updated comment",
        link: "https://new.example",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Updated comment")).toBeInTheDocument();
      expect(screen.getByText("https://new.example")).toBeInTheDocument();
    });

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
      }),
    );
  });

  it("revokes a completion via confirm dialog", async () => {
    listStepCompletionsMock.mockResolvedValue({
      items: [
        {
          id: "c2",
          stepId: "s2",
          studentUid: "u2",
          studentDisplayName: "Student Two",
          stepTitle: "Step Two",
          comment: "Ready",
          link: "https://proof.example",
          status: "completed",
          completedAt: "2026-02-11T11:00:00Z",
        },
      ],
    });
    revokeStepCompletionMock.mockResolvedValue({ status: "ok" });

    render(() => <AdminStepCompletions />);

    expect(await screen.findByText("completed")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Revoke completion c2"));
    expect(await screen.findByText("Revoke completion?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("revoke-confirm-button"));

    await waitFor(() => {
      expect(revokeStepCompletionMock).toHaveBeenCalledWith("c2");
    });

    await waitFor(() => {
      expect(screen.getByText("revoked")).toBeInTheDocument();
    });

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
      }),
    );
  });
});
