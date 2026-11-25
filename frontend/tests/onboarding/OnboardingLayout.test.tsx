import { render, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingLayout } from "../../src/routes/onboarding/OnboardingLayout";

const navigateMock = vi.fn();

let pathnameState = "/onboarding/profile";
let loadingState = false;
let meState: {
  role: "student" | "staff";
  status: "active" | "disabled" | "community_only" | "expired";
  selectedGoalId?: string | null;
  selectedCourses?: string[];
  profileForm?: {
    aboutMe?: string | null;
    telegram?: string | null;
    submitted?: boolean | null;
    notes?: string | null;
  };
} | null = null;

vi.mock("@solidjs/router", () => ({
  Navigate: (props: { href: string }) => <div data-testid="navigate">{props.href}</div>,
  useLocation: () => ({ pathname: pathnameState }),
  useNavigate: () => navigateMock,
}));

vi.mock("../../src/components/Loading", () => ({
  Loading: () => <div data-testid="loading">Loading</div>,
}));

vi.mock("../../src/routes/start/StartLayout", () => ({
  StartLayout: (props: { children?: unknown }) => <div>{props.children}</div>,
}));

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    loading: () => loadingState,
    me: () => meState,
  }),
}));

vi.mock("../../src/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("OnboardingLayout", () => {
  beforeEach(() => {
    pathnameState = "/onboarding/profile";
    loadingState = false;
    meState = {
      role: "student",
      status: "active",
      selectedGoalId: "goal-1",
      profileForm: {
        aboutMe: "About me",
        telegram: "@user",
        submitted: true,
        notes: null,
      },
      selectedCourses: [],
    };
    navigateMock.mockReset();
  });

  it("allows navigating back to earlier onboarding steps", async () => {
    // The profile is filled but nothing is picked: the profile stays open.
    pathnameState = "/onboarding/profile";

    render(() => (
      <OnboardingLayout step="profile" title="Profile">
        <div>Profile step</div>
      </OnboardingLayout>
    ));

    await waitFor(() => {
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it("redirects forward only when visiting a locked step", async () => {
    pathnameState = "/onboarding/checkout";

    render(() => (
      <OnboardingLayout step="checkout" title="Checkout">
        <div>Checkout step</div>
      </OnboardingLayout>
    ));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/start", { replace: true });
    });
  });
});
