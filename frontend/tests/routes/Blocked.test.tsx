import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";

import { Blocked } from "../../src/routes/Blocked";

let typeParam: string | undefined;

vi.mock("@solidjs/router", () => ({
  useSearchParams: () => [{ type: typeParam }],
}));

describe("Blocked route", () => {
  it("renders disabled variant by default", () => {
    typeParam = undefined;
    render(() => <Blocked />);

    expect(screen.getByText("Account disabled")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account is currently disabled. Access to protected sections is restricted.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toBeInTheDocument();
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
