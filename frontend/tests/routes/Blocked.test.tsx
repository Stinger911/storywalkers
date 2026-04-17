import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { Blocked } from "../../src/routes/Blocked";
import { ThemeProvider } from "../../src/lib/theme";

let typeParam: string | undefined;
const logoutMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useSearchParams: () => [{ type: typeParam }],
}));
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => null,
    logout: logoutMock,
  }),
}));
vi.mock("../../src/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === "common.contactSupport") return "Contact Support";
      if (key === "blocked.titleDisabled") return "Account disabled";
      if (key === "blocked.descriptionDisabled") {
        return "Your account is currently disabled. Access to protected sections is restricted.";
      }
      if (key === "blocked.titleExpired") return "Access expired";
      if (key === "blocked.descriptionExpired") {
        return "Your access period has ended. Some sections are unavailable until renewal.";
      }
      if (key === "blocked.renewalMessage") {
        return "To continue learning, contact support and request renewal.";
      }
      if (key === "blocked.continueOnboarding") return "Continue onboarding";
      if (key === "blocked.logout") return "Log out";
      return key;
    },
  }),
}));

describe("Blocked route", () => {
  const renderBlocked = () =>
    render(() => (
      <ThemeProvider>
        <Blocked />
      </ThemeProvider>
    ));

  it("allows logout from blocked page", () => {
    typeParam = undefined;
    renderBlocked();

    expect(
      screen.getByRole("link", { name: "Continue onboarding" }),
    ).toHaveAttribute("href", "/onboarding/profile");

    const button = screen.getByRole("button", { name: "Log out" });
    fireEvent.click(button);
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("renders disabled variant by default", () => {
    typeParam = undefined;
    renderBlocked();

    expect(screen.getByText("Account disabled")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Your account is currently disabled. Access to protected sections is restricted.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /Contact Support/ }),
    ).toBeInTheDocument();
  });

  it("renders expired variant with renewal message", () => {
    typeParam = "expired";
    renderBlocked();

    expect(screen.getByText("Access expired")).toBeInTheDocument();
    expect(
      screen.getByText("To continue learning, contact support and request renewal."),
    ).toBeInTheDocument();
  });
});
