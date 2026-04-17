import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingProfile } from "../../src/routes/onboarding/OnboardingProfile";

const patchMeMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown; class?: string }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => ({
      uid: "u1",
      email: "u1@example.com",
      displayName: "User One",
      role: "student",
      status: "active",
      selectedGoalId: "goal-1",
      profileForm: {
        aboutMe: null,
        telegram: null,
        socialLinks: [],
        socialUrl: null,
        notes: null,
      },
      selectedCourses: [],
      subscriptionSelected: null,
    }),
    patchMe: patchMeMock,
  }),
}));

vi.mock("../../src/routes/onboarding/OnboardingLayout", () => ({
  OnboardingLayout: (props: { children?: unknown }) => <>{props.children}</>,
}));

describe("OnboardingProfile", () => {
  beforeEach(() => {
    patchMeMock.mockReset();
    navigateMock.mockReset();
  });

  it("submits profile form via PATCH /me", async () => {
    patchMeMock.mockResolvedValue({});
    render(() => (
      <I18nProvider>
        <OnboardingProfile />
      </I18nProvider>
    ));

    fireEvent.input(screen.getByLabelText("About me"), {
      target: { value: "I want to become a better storyteller." },
    });
    fireEvent.input(screen.getByLabelText("Telegram"), {
      target: { value: "@alice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    fireEvent.input(screen.getByPlaceholderText("https://instagram.com/yourname"), {
      target: { value: "https://example.com/alice" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        profileForm: {
          aboutMe: "I want to become a better storyteller.",
          notes: "I want to become a better storyteller.",
          telegram: "@alice",
          socialLinks: ["https://example.com/alice"],
          socialUrl: "https://example.com/alice",
        },
      });
    });
  });

  it("navigates to courses on Next after successful save and shows disclaimer", async () => {
    patchMeMock.mockResolvedValue({});
    render(() => (
      <I18nProvider>
        <OnboardingProfile />
      </I18nProvider>
    ));

    expect(
      screen.getByText(
        "Your profile will be reviewed by a human. Activation is manual after review.",
      ),
    ).toBeInTheDocument();

    fireEvent.input(screen.getByLabelText("About me"), {
      target: { value: "I want to become a better storyteller." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/goal");
    });
  });
});
