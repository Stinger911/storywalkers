import { render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentLibrary } from "../../src/routes/student/StudentLibrary";
import { listCategories } from "../../src/lib/adminApi";
import { listLibrary } from "../../src/lib/libraryApi";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/adminApi", () => ({
  listCategories: vi.fn(),
}));

vi.mock("../../src/lib/libraryApi", () => ({
  listLibrary: vi.fn(),
}));

const listCategoriesMock = vi.mocked(listCategories);
const listLibraryMock = vi.mocked(listLibrary);

describe("StudentLibrary", () => {
  beforeEach(() => {
    listCategoriesMock.mockResolvedValue({
      items: [{ id: "cat1", name: "Audio" }],
    });
    listLibraryMock.mockResolvedValue({
      items: [
        { id: "l1", title: "Noise reduction tips", categoryId: "cat1", status: "published" },
      ],
    });
  });

  it("renders library entries", async () => {
    render(() => <StudentLibrary />);
    expect(await screen.findByText("Library")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Noise reduction tips")).toBeInTheDocument();
      expect(screen.getAllByText("Audio").length).toBeGreaterThan(0);
    });
  });
});
