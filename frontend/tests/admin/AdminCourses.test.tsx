import { render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminCourses } from "../../src/routes/admin/AdminCourses";
import { listAdminCourses, listGoals } from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
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
      "/admin/courses/course-1/lessons",
    );
    await waitFor(() => {
      expect(listAdminCourses).toHaveBeenCalledWith({ q: undefined, limit: 200 });
    });
  });
});
