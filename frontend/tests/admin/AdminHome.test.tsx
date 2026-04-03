import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { AdminHome } from "../../src/routes/admin/AdminHome";

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

describe("AdminHome", () => {
  it("shows lesson completions entry label", () => {
    render(() => <AdminHome />);

    expect(screen.getByText("Lesson Completions")).toBeInTheDocument();
  });
});
