import { render, screen, waitFor } from "@solidjs/testing-library";
import { vi } from "vitest";

import { StudentQuestionDetail } from "../../src/routes/student/StudentQuestionDetail";
import { I18nProvider } from "../../src/lib/i18n";
import { getQuestion } from "../../src/lib/questionsApi";

vi.mock("@solidjs/router", () => ({
  useParams: () => ({ id: "q1" }),
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

vi.mock("../../src/lib/questionsApi", () => ({
  getQuestion: vi.fn(),
}));

const getQuestionMock = vi.mocked(getQuestion);

describe("StudentQuestionDetail", () => {
  it("renders question and answer", async () => {
    getQuestionMock.mockResolvedValue({
      id: "q1",
      title: "How to trim?",
      categoryId: "cat1",
      status: "answered",
      answer: { text: "Use the razor tool." },
    });

    render(() => (
      <I18nProvider>
        <StudentQuestionDetail />
      </I18nProvider>
    ));

    expect(await screen.findByText("Question detail")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("How to trim?")).toBeInTheDocument();
      expect(screen.getByText("Use the razor tool.")).toBeInTheDocument();
    });
  });
});
