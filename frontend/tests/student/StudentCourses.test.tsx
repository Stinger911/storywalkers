import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

let meState = {
  uid: "u1",
  email: "u1@example.com",
  displayName: "User One",
  role: "student" as const,
  status: "active" as const,
  selectedCourses: ["course-1"],
  preferredCurrency: "USD" as const,
  isFirstHundred: false,
};

vi.mock("../../src/lib/auth", () => ({
  useAuth: () => ({
    me: () => meState,
  }),
}));

vi.mock("../../src/lib/coursesApi", async () => {
  const actual = await vi.importActual<typeof import("../../src/lib/coursesApi")>(
    "../../src/lib/coursesApi",
  );
  return {
    ...actual,
    listCourses: vi.fn(),
  };
});

vi.mock("../../src/lib/fxApi", () => ({
  getFxRates: vi.fn(),
}));

vi.mock("../../src/lib/checkoutApi", () => ({
  createCheckoutIntent: vi.fn(),
}));

import { createCheckoutIntent } from "../../src/lib/checkoutApi";
import { listCourses } from "../../src/lib/coursesApi";
import { getFxRates } from "../../src/lib/fxApi";
import { I18nProvider } from "../../src/lib/i18n";
import { StudentCourses } from "../../src/routes/student/StudentCourses";

describe("StudentCourses", () => {
  beforeEach(() => {
    meState = {
      uid: "u1",
      email: "u1@example.com",
      displayName: "User One",
      role: "student",
      status: "active",
      selectedCourses: ["course-1"],
      preferredCurrency: "USD",
      isFirstHundred: false,
    };
    vi.mocked(listCourses).mockReset();
    vi.mocked(getFxRates).mockReset();
    vi.mocked(createCheckoutIntent).mockReset();
    vi.mocked(listCourses).mockResolvedValue({
      items: [
        {
          id: "course-1",
          title: "Owned course",
          shortDescription: "Owned",
          priceUsdCents: 3000,
          isActive: true,
          goalIds: [],
        },
        {
          id: "course-2",
          title: "New course",
          shortDescription: "Additional lessons",
          priceUsdCents: 4000,
          isActive: true,
          goalIds: [],
        },
      ],
    });
    vi.mocked(getFxRates).mockResolvedValue({
      base: "USD",
      rates: { USD: 1 },
      updatedAt: null,
    });
  });

  it("creates a checkout intent for newly selected courses", async () => {
    vi.mocked(createCheckoutIntent).mockResolvedValue({
      paymentId: "p1",
      redirectUrl: "https://boosty.example/pay",
      amount: 4000,
      currency: "USD",
      activationCode: "SW-NEW12345",
      instructionsText: "Pay and send the code to support.",
    });

    render(() => (
      <I18nProvider>
        <StudentCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("New course")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create payment instructions" }));

    await waitFor(() => {
      expect(createCheckoutIntent).toHaveBeenCalledWith({
        selectedCourses: ["course-2"],
      });
    });

    expect(await screen.findByText("SW-NEW12345")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open payment page" })).toHaveAttribute(
      "href",
      "https://boosty.example/pay",
    );
  });

  it("shows free pricing and hides payment link for first hundred students", async () => {
    meState = {
      ...meState,
      isFirstHundred: true,
    };
    vi.mocked(createCheckoutIntent).mockResolvedValue({
      paymentId: "p1",
      redirectUrl: "https://boosty.example/pay",
      amount: 0,
      currency: "USD",
      activationCode: "SW-FREE100",
      instructionsText: "No payment required.",
    });

    render(() => (
      <I18nProvider>
        <StudentCourses />
      </I18nProvider>
    ));

    expect(await screen.findByText("New course")).toBeInTheDocument();
    expect(screen.getByText("You are in the first 100 students cohort. No payment is required for these courses.")).toBeInTheDocument();
    expect(screen.getByText("$40.00")).toHaveClass("line-through");
    expect(screen.getAllByText("$0.00").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create payment instructions" }));

    expect(await screen.findByText("SW-FREE100")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open payment page" })).not.toBeInTheDocument();
  });
});
