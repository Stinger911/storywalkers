import { render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentQuestions } from "../../src/routes/student/StudentQuestions";
import { I18nProvider } from "../../src/lib/i18n";
import { listCategories } from "../../src/lib/adminApi";
import { listQuestions } from "../../src/lib/questionsApi";

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

vi.mock("../../src/lib/questionsApi", () => ({
  listQuestions: vi.fn(),
}));

const listCategoriesMock = vi.mocked(listCategories);
const listQuestionsMock = vi.mocked(listQuestions);

describe("StudentQuestions", () => {
  beforeEach(() => {
    listCategoriesMock.mockResolvedValue({
      items: [{ id: "cat1", name: "Editing" }],
    });
    listQuestionsMock.mockResolvedValue({
      items: [
        { id: "q1", title: "How to trim?", categoryId: "cat1", status: "new" },
      ],
    });
  });

  it("renders questions list", async () => {
    render(() => (
      <I18nProvider>
        <StudentQuestions />
      </I18nProvider>
    ));
    expect(await screen.findByText("My Questions")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("How to trim?")).toBeInTheDocument();
      expect(screen.getAllByText("Editing").length).toBeGreaterThan(0);
    });
  });
});
