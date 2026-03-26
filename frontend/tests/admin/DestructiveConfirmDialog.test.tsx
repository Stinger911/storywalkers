import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { DestructiveConfirmDialog } from "../../src/components/ui/destructive-confirm-dialog";

describe("DestructiveConfirmDialog", () => {
  it("keeps confirm disabled until acknowledge and keyword match", async () => {
    const onConfirm = vi.fn();

    render(() => (
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete item?"
        description="Danger."
        acknowledgeLabel="I understand"
        confirmKeyword="DELETE"
        confirmLabel="Confirm delete"
        onConfirm={onConfirm}
        testIdPrefix="destructive"
      />
    ));

    const confirmButton = await screen.findByTestId("destructive-confirm-button");
    expect(confirmButton).toBeDisabled();

    fireEvent.click(await screen.findByTestId("destructive-acknowledge"));
    expect(confirmButton).toBeDisabled();

    fireEvent.input(await screen.findByTestId("destructive-confirm-input"), {
      target: { value: "DELETE" },
    });
    expect(confirmButton).toBeEnabled();
  });

  it("disables actions while loading", async () => {
    render(() => (
      <DestructiveConfirmDialog
        open
        onOpenChange={() => {}}
        title="Delete item?"
        description="Danger."
        acknowledgeLabel="I understand"
        confirmKeyword="DELETE"
        confirmLabel="Confirm delete"
        loading
        onConfirm={() => {}}
        testIdPrefix="loading-dialog"
      />
    ));

    expect(await screen.findByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(
      await screen.findByTestId("loading-dialog-confirm-button"),
    ).toBeDisabled();
  });
});
