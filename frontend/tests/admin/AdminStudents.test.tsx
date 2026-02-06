import { render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { AdminStudents } from "../../src/routes/admin/AdminStudents";
import { listStudents } from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
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

    expect(
      await screen.findByRole("heading", { name: "Students" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Staff")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Student S")).toBeInTheDocument();
      expect(screen.getByText("Admin A")).toBeInTheDocument();
      expect(screen.getByText("Expert E")).toBeInTheDocument();
    });

    expect(listStudentsMock).toHaveBeenCalledWith({ q: undefined, role: "student" });
    expect(listStudentsMock).toHaveBeenCalledWith({ q: undefined, role: "staff" });
  });
});
