import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { Blocked } from "../../src/routes/Blocked";

let typeParam: string | undefined;
const logoutMock = vi.fn();

vi.mock("@solidjs/router", () => ({
  useSearchParams: () => [{ type: typeParam }],
}));
vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    logout: logoutMock,
  }),
}));
vi.mock("../../src/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      if (key === "common.contactSupport") return "Contact Support";
      return key;
    },
  }),
}));

describe("Blocked route", () => {
  it("allows logout from blocked page", () => {
    typeParam = undefined;
    render(() => <Blocked />);

    expect(
      screen.getByRole("link", { name: "Continue onboarding" }),
    ).toHaveAttribute("href", "/onboarding/goal");

    const button = screen.getByRole("button", { name: "Log out" });
    fireEvent.click(button);
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("renders disabled variant by default", () => {
    typeParam = undefined;
    render(() => <Blocked />);

    expect(screen.getByText("Account disabled")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account is currently disabled. Access to protected sections is restricted.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Contact Support" }),
    ).toBeInTheDocument();
  });

  it("renders expired variant with renewal message", () => {
    typeParam = "expired";
    render(() => <Blocked />);

    expect(screen.getByText("Access expired")).toBeInTheDocument();
    expect(
      screen.getByText("To continue learning, contact support and request renewal."),
    ).toBeInTheDocument();
  });
});
