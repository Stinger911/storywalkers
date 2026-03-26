import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminGoals } from "../../src/routes/admin/AdminGoals";
import {
  deleteGoal,
  listAdminCourses,
  listGoals,
} from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/adminApi", () => ({
  listGoals: vi.fn(),
  listAdminCourses: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
}));

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

describe("AdminGoals", () => {
  beforeEach(() => {
    vi.mocked(listGoals).mockReset();
    vi.mocked(listAdminCourses).mockReset();
    vi.mocked(deleteGoal).mockReset();
  });

  it("requires typed confirmation before deleting a goal", async () => {
    vi.mocked(listGoals).mockResolvedValue({
      items: [
        {
          id: "goal-1",
          title: "Goal One",
          description: "Desc one",
        },
      ],
    });
    vi.mocked(listAdminCourses).mockResolvedValue({ items: [] });
    vi.mocked(deleteGoal).mockResolvedValue(undefined);

    render(() => <AdminGoals />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    const confirmButton = await screen.findByTestId("delete-goal-confirm-button");
    expect(confirmButton).toBeDisabled();

    fireEvent.click(await screen.findByTestId("delete-goal-acknowledge"));
    fireEvent.input(await screen.findByTestId("delete-goal-confirm-input"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteGoal).toHaveBeenCalledWith("goal-1");
    });
  });
});
