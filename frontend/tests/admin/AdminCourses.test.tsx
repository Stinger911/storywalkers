import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminCourses } from "../../src/routes/admin/AdminCourses";
import {
  deleteAdminCourse,
  listAdminCourses,
  listGoals,
} from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useSearchParams: () => [{}, () => {}],
}));

vi.mock("../../src/lib/adminApi", () => ({
  listAdminCourses: vi.fn(),
  listGoals: vi.fn(),
  createAdminCourse: vi.fn(),
  patchAdminCourse: vi.fn(),
  deleteAdminCourse: vi.fn(),
}));

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

describe("AdminCourses", () => {
  beforeEach(() => {
    vi.mocked(listGoals).mockReset();
    vi.mocked(listAdminCourses).mockReset();
    vi.mocked(deleteAdminCourse).mockReset();
  });

  it("renders admin courses from API", async () => {
    vi.mocked(listGoals).mockResolvedValue({ items: [] });
    vi.mocked(listAdminCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          description: "Desc one",
          goalIds: ["goal-1"],
          priceUsdCents: 12900,
          isActive: true,
        },
      ],
    });

    render(() => <AdminCourses />);

    expect(await screen.findByText("Course One")).toBeInTheDocument();
    expect(screen.getByText("Desc one")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lessons" })).toHaveAttribute(
      "href",
      "/admin/courses/course-1/lessons?title=Course%20One",
    );
    expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listAdminCourses).toHaveBeenCalledWith({ q: undefined, limit: 200 });
    });
  });

  it("requires typed confirmation before deactivating a course", async () => {
    vi.mocked(listGoals).mockResolvedValue({ items: [] });
    vi.mocked(listAdminCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Course One",
          description: "Desc one",
          goalIds: ["goal-1"],
          priceUsdCents: 12900,
          isActive: true,
        },
      ],
    });
    vi.mocked(deleteAdminCourse).mockResolvedValue(undefined);

    render(() => <AdminCourses />);

    fireEvent.click(await screen.findByRole("button", { name: "Soft delete" }));

    const confirmButton = await screen.findByTestId("delete-course-confirm-button");
    expect(confirmButton).toBeDisabled();

    fireEvent.click(await screen.findByTestId("delete-course-acknowledge"));
    fireEvent.input(await screen.findByTestId("delete-course-confirm-input"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteAdminCourse).toHaveBeenCalledWith("course-1");
    });
  });
});
