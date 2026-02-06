import { render, screen } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentQuestionNew } from "../../src/routes/student/StudentQuestionNew";
import { I18nProvider } from "../../src/lib/i18n";
import { listCategories } from "../../src/lib/adminApi";

vi.mock("@solidjs/router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../src/lib/adminApi", () => ({
  listCategories: vi.fn(),
}));

const listCategoriesMock = vi.mocked(listCategories);

describe("StudentQuestionNew", () => {
  it("renders form fields", async () => {
    listCategoriesMock.mockResolvedValue({ items: [{ id: "cat1", name: "Audio" }] });
    render(() => (
      <I18nProvider>
        <StudentQuestionNew />
      </I18nProvider>
    ));
    expect(await screen.findByText("Ask a question")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
  });
});
