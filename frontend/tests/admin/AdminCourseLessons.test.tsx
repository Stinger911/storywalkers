import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminCourseLessons } from "../../src/routes/admin/AdminCourseLessons";
import {
  listAdminCourseLessons,
  reorderAdminCourseLessons,
} from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useParams: () => ({ courseId: "course-1" }),
  useSearchParams: () => [{}, () => {}],
}));

vi.mock("../../src/lib/adminApi", () => ({
  listAdminCourseLessons: vi.fn(),
  reorderAdminCourseLessons: vi.fn(),
  createAdminCourseLesson: vi.fn(),
  patchAdminCourseLesson: vi.fn(),
  deleteAdminCourseLesson: vi.fn(),
}));

vi.mock("../../src/components/ui/toast", () => ({
  showToast: vi.fn(),
}));

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

describe("AdminCourseLessons", () => {
  beforeEach(() => {
    vi.mocked(listAdminCourseLessons).mockReset();
    vi.mocked(reorderAdminCourseLessons).mockReset();
  });

  it("triggers reorder request via fallback move control", async () => {
    vi.mocked(listAdminCourseLessons).mockResolvedValue({
      items: [
        {
          id: "l1",
          title: "Lesson One",
          type: "video",
          content: "A",
          order: 0,
          isActive: true,
        },
        {
          id: "l2",
          title: "Lesson Two",
          type: "text",
          content: "B",
          order: 1,
          isActive: true,
        },
      ],
    });
    vi.mocked(reorderAdminCourseLessons).mockResolvedValue({ updated: 2 });

    render(() => <AdminCourseLessons />);

    expect(await screen.findByDisplayValue("Lesson One")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Lesson Two")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move lesson l1 down" }));

    await waitFor(() => {
      expect(reorderAdminCourseLessons).toHaveBeenCalledWith("course-1", {
        items: [
          { lessonId: "l2", order: 0 },
          { lessonId: "l1", order: 1 },
        ],
      });
    });
  });
});
