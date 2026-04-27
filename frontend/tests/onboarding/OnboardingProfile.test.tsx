import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../src/lib/i18n";
import { OnboardingProfile } from "../../src/routes/onboarding/OnboardingProfile";

const patchMeMock = vi.fn();
const navigateMock = vi.fn();
const [meState, setMeState] = createSignal<{
  uid: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  selectedGoalId: string | null;
  profileForm: {
    firstName: string | null;
    lastName: string | null;
    aboutMe: string | null;
    telegram: string | null;
    socialLinks: string[];
    socialUrl: string | null;
    notes: string | null;
  };
  selectedCourses: string[];
  subscriptionSelected: boolean | null;
} | null>(null);

function makeMe(overrides: Record<string, unknown> = {}) {
  return {
    uid: "u1",
    email: "u1@example.com",
    displayName: "User One",
    role: "student",
    status: "active",
    selectedGoalId: "goal-1",
    profileForm: {
      firstName: null,
      lastName: null,
      aboutMe: null,
      telegram: null,
      socialLinks: [],
      socialUrl: null,
      notes: null,
    },
    selectedCourses: [],
    subscriptionSelected: null,
    ...overrides,
  };
}

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
    me: meState,
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
    setMeState(makeMe());
  });

  it("submits profile form via PATCH /me", async () => {
    patchMeMock.mockResolvedValue({});
    render(() => (
      <I18nProvider>
        <OnboardingProfile />
      </I18nProvider>
    ));

    fireEvent.input(screen.getByLabelText("First name"), {
      target: { value: "Alice" },
    });
    fireEvent.input(screen.getByLabelText("Last name"), {
      target: { value: "Rivera" },
    });
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
          firstName: "Alice",
          lastName: "Rivera",
          aboutMe: "I want to become a better storyteller.",
          telegram: "@alice",
          socialLinks: ["https://example.com/alice"],
          socialUrl: "https://example.com/alice",
        },
      });
    });
  });

  it("navigates to courses on Next after successful save", async () => {
    patchMeMock.mockResolvedValue({});
    render(() => (
      <I18nProvider>
        <OnboardingProfile />
      </I18nProvider>
    ));

    expect(screen.getByLabelText("Email")).toHaveValue("u1@example.com");

    fireEvent.input(screen.getByLabelText("About me"), {
      target: { value: "I want to become a better storyteller." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/goal");
    });
  });

  it("hydrates profile fields when auth data arrives after initial render", async () => {
    setMeState(null);

    render(() => (
      <I18nProvider>
        <OnboardingProfile />
      </I18nProvider>
    ));

    expect(screen.getByLabelText("First name")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");

    setMeState(
      makeMe({
        displayName: "Alice Rivera",
        profileForm: {
          firstName: null,
          lastName: null,
          aboutMe: "Existing bio",
          telegram: "@alice",
          socialLinks: ["https://example.com/alice"],
          socialUrl: "https://example.com/alice",
          notes: "Existing bio",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByLabelText("First name")).toHaveValue("Alice");
      expect(screen.getByLabelText("Last name")).toHaveValue("Rivera");
      expect(screen.getByLabelText("About me")).toHaveValue("Existing bio");
      expect(screen.getByLabelText("Telegram")).toHaveValue("@alice");
      expect(screen.getByLabelText("Email")).toHaveValue("u1@example.com");
      expect(screen.getByDisplayValue("https://example.com/alice")).toBeInTheDocument();
    });
  });

  it("falls back to displayName when backend profileForm does not expose name fields", async () => {
    patchMeMock.mockResolvedValue({});
    setMeState({
      ...makeMe(),
      profileForm: {
        aboutMe: null,
        telegram: null,
        socialLinks: [],
        socialUrl: null,
        notes: null,
      } as never,
    });

    render(() => (
      <I18nProvider>
        <OnboardingProfile />
      </I18nProvider>
    ));

    fireEvent.input(screen.getByLabelText("First name"), {
      target: { value: "Alice" },
    });
    fireEvent.input(screen.getByLabelText("Last name"), {
      target: { value: "Rivera" },
    });
    fireEvent.input(screen.getByLabelText("About me"), {
      target: { value: "I want to become a better storyteller." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(patchMeMock).toHaveBeenCalledWith({
        displayName: "Alice Rivera",
        profileForm: {
          aboutMe: "I want to become a better storyteller.",
          telegram: null,
          socialLinks: [],
          socialUrl: null,
        },
      });
    });
  });
});
