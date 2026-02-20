import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../../src/lib/api";
import { listCourses, resetCoursesCacheForTests } from "../../src/lib/coursesApi";

vi.mock("../../src/lib/api", () => ({
  apiFetch: vi.fn(),
}));

describe("coursesApi", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    resetCoursesCacheForTests();
  });

  it("caches courses in memory", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "course-1",
              title: "Course One",
              shortDescription: "Desc",
              priceUsdCents: 5000,
              isActive: true,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const first = await listCourses();
    const second = await listCourses();

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache with force option", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "course-1", title: "Course One", price: 50, isActive: true }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "course-2", title: "Course Two", price: 60, isActive: true }],
          }),
          { status: 200 },
        ),
      );

    const first = await listCourses();
    const second = await listCourses({ force: true });

    expect(first.items[0]?.id).toBe("course-1");
    expect(second.items[0]?.id).toBe("course-2");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("uses goalId query and caches by goalId", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "goal-1-course", title: "Goal 1 Course", priceUsdCents: 1000 }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "goal-2-course", title: "Goal 2 Course", priceUsdCents: 2000 }],
          }),
          { status: 200 },
        ),
      );

    const first = await listCourses({ goalId: "goal-1" });
    const second = await listCourses({ goalId: "goal-1" });
    const third = await listCourses({ goalId: "goal-2" });

    expect(first.items[0]?.id).toBe("goal-1-course");
    expect(second.items[0]?.id).toBe("goal-1-course");
    expect(third.items[0]?.id).toBe("goal-2-course");
    expect(apiFetch).toHaveBeenNthCalledWith(1, "/api/courses?goalId=goal-1");
    expect(apiFetch).toHaveBeenNthCalledWith(2, "/api/courses?goalId=goal-2");
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
});
