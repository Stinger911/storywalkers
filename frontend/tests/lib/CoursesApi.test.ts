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
              price: 50,
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
});
