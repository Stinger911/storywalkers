import { render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentLibraryDetail } from "../../src/routes/student/StudentLibraryDetail";
import { getLibraryEntry } from "../../src/lib/libraryApi";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "l1" }),
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/libraryApi", () => ({
  getLibraryEntry: vi.fn(),
}));

const getLibraryEntryMock = vi.mocked(getLibraryEntry);

describe("StudentLibraryDetail", () => {
  it("renders entry content", async () => {
    getLibraryEntryMock.mockResolvedValue({
      id: "l1",
      title: "Noise reduction tips",
      categoryId: "cat1",
      status: "published",
      content: "Use a high-pass filter.",
    });

    render(() => <StudentLibraryDetail />);
    expect(await screen.findByText("Library entry")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Noise reduction tips")).toBeInTheDocument();
      expect(screen.getByText("Use a high-pass filter.")).toBeInTheDocument();
    });
  });
});
