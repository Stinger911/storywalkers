import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingExpert } from "../../src/routes/onboarding/OnboardingExpert";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  Navigate: (props: { href: string }) => <span data-navigate={props.href} />,
  useNavigate: () => vi.fn(),
}));

vi.mock("../../src/routes/student/StudentLayout", () => ({
  StudentLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

const meMock = vi.fn();

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    loading: () => false,
    me: meMock,
  }),
}));

function renderPage() {
  return render(() => (
    <I18nProvider>
      <OnboardingExpert />
    </I18nProvider>
  ));
}

describe("OnboardingExpert", () => {
  it("explains the expert flow and offers the community subscription", () => {
    meMock.mockReturnValue({
      uid: "u1",
      role: "student",
      status: "active",
      youtubeOnboarding: { hasChannel: true, track: "expert" },
    });

    renderPage();

    expect(screen.getByText("An expert is building your path")).toBeInTheDocument();
    const cta = screen.getByText("Pay on Boosty").closest("a");
    expect(cta?.getAttribute("href")).toContain("boosty.to");
  });

  it("sends anonymous visitors to login", () => {
    meMock.mockReturnValue(null);

    const { container } = renderPage();

    expect(container.querySelector('[data-navigate="/login"]')).not.toBeNull();
  });
});
