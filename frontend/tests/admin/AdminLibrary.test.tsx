import { render, screen } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminLibrary } from "../../src/routes/admin/AdminLibrary";
import { listCategories } from "../../src/lib/adminApi";
import { listLibrary } from "../../src/lib/libraryApi";

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
  listCategories: vi.fn(),
}));

vi.mock("../../src/lib/libraryApi", () => ({
  listLibrary: vi.fn(),
}));

describe("AdminLibrary", () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockReset();
    vi.mocked(listLibrary).mockReset();
  });

  it("shows manage row action for library entries", async () => {
    vi.mocked(listCategories).mockResolvedValue({ items: [] });
    vi.mocked(listLibrary).mockResolvedValue({
      items: [
        {
          id: "entry-1",
          title: "Workflow notes",
          status: "draft",
          categoryId: "general",
        },
      ],
    });

    render(() => <AdminLibrary />);

    expect(await screen.findByRole("link", { name: "Open entry" })).toHaveAttribute(
      "href",
      "/admin/library/entry-1",
    );
  });
});
