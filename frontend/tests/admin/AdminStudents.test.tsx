import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStudents } from "../../src/routes/admin/AdminStudents";
import { listStudents } from "../../src/lib/adminApi";

const setSearchParamsMock = vi.fn();
let searchParamsState: Record<string, string> = {};

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useSearchParams: () => [searchParamsState, setSearchParamsMock],
}));

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

vi.mock("../../src/lib/adminApi", () => ({
  listStudents: vi.fn(),
}));

const listStudentsMock = listStudents as unknown as ReturnType<typeof vi.fn>;

describe("AdminStudents", () => {
  beforeEach(() => {
    searchParamsState = {};
    setSearchParamsMock.mockReset();
    listStudentsMock.mockReset();
  });

  it("renders separate student and staff lists", async () => {
    listStudentsMock.mockImplementation(({ role }: { role?: string }) => {
      if (role === "staff") {
        return Promise.resolve({
          items: [
            { uid: "a1", displayName: "Admin A", email: "a@x.com", role: "admin" },
            { uid: "e1", displayName: "Expert E", email: "e@x.com", role: "expert" },
          ],
        });
      }
      return Promise.resolve({
        items: [
          { uid: "s1", displayName: "Student S", email: "s@x.com", role: "student" },
        ],
      });
    });

    render(() => <AdminStudents />);

    expect(await screen.findByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(await screen.findByText("Staff")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Student S")).toBeInTheDocument();
      expect(screen.getByText("Admin A")).toBeInTheDocument();
      expect(screen.getByText("Expert E")).toBeInTheDocument();
    });

    expect(listStudentsMock).toHaveBeenCalledWith({
      q: undefined,
      status: undefined,
      role: "student",
      sortBy: "createdAt",
      sortDir: "desc",
    });
    expect(listStudentsMock).toHaveBeenCalledWith({
      q: undefined,
      status: undefined,
      role: "staff",
      sortBy: "createdAt",
      sortDir: "desc",
    });
  });

  it("applies status filter to both student queries and URL state", async () => {
    listStudentsMock.mockResolvedValue({ items: [] });

    render(() => <AdminStudents />);

    fireEvent.change(await screen.findByTestId("student-status-filter"), {
      target: { value: "disabled" },
    });

    await waitFor(() => {
      expect(listStudentsMock).toHaveBeenLastCalledWith({
        q: undefined,
        status: "disabled",
        role: "staff",
        sortBy: "createdAt",
        sortDir: "desc",
      });
    });

    expect(setSearchParamsMock).toHaveBeenCalledWith({
      q: undefined,
      status: "disabled",
      sortBy: undefined,
      sortDir: undefined,
    });
  });

  it("applies sort controls to both student queries and URL state", async () => {
    listStudentsMock.mockResolvedValue({ items: [] });

    render(() => <AdminStudents />);

    fireEvent.change(await screen.findByTestId("student-sort-by"), {
      target: { value: "progress" },
    });
    fireEvent.change(screen.getByTestId("student-sort-dir"), {
      target: { value: "asc" },
    });

    await waitFor(() => {
      expect(listStudentsMock).toHaveBeenLastCalledWith({
        q: undefined,
        status: undefined,
        role: "staff",
        sortBy: "progress",
        sortDir: "asc",
      });
    });

    expect(setSearchParamsMock).toHaveBeenLastCalledWith({
      q: undefined,
      status: undefined,
      sortBy: "progress",
      sortDir: "asc",
    });
  });

  it("shows filtered empty states when both sections are empty", async () => {
    searchParamsState = { status: "disabled" };
    listStudentsMock.mockResolvedValue({ items: [] });

    render(() => <AdminStudents />);

    expect(
      await screen.findByText("No students match the current filters."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No staff members match the current filters."),
    ).toBeInTheDocument();
  });
});
