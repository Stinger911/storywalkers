import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminPaymentDetail } from "../../src/routes/admin/AdminPaymentDetail";
import {
  activateAdminPayment,
  getAdminPayment,
  getStudent,
  rejectAdminPayment,
} from "../../src/lib/adminApi";
import { showToast } from "../../src/components/ui/toast";

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
  useParams: () => ({ id: "p1" }),
}));

vi.mock("../../src/components/AppShell", () => ({
  useAppShellRail: () => () => {},
}));

vi.mock("../../src/lib/adminApi", () => ({
  getAdminPayment: vi.fn(),
  getStudent: vi.fn(),
  activateAdminPayment: vi.fn(),
  rejectAdminPayment: vi.fn(),
}));

vi.mock("../../src/components/ui/toast", () => ({
  showToast: vi.fn(),
}));

const getAdminPaymentMock = getAdminPayment as unknown as ReturnType<typeof vi.fn>;
const getStudentMock = getStudent as unknown as ReturnType<typeof vi.fn>;
const activateAdminPaymentMock = activateAdminPayment as unknown as ReturnType<
  typeof vi.fn
>;
const rejectAdminPaymentMock = rejectAdminPayment as unknown as ReturnType<typeof vi.fn>;
const showToastMock = showToast as unknown as ReturnType<typeof vi.fn>;

const paymentFixture = {
  id: "p1",
  userUid: "u1",
  email: "user@example.com",
  provider: "boosty",
  selectedCourses: ["course-1"],
  amount: 1000,
  currency: "USD",
  activationCode: "SW-ABC12345",
  status: "created" as const,
  emailEvidence: "messageId=msg-1;snippet=Paid",
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-03-01T00:00:00Z",
};

describe("AdminPaymentDetail", () => {
  beforeEach(() => {
    getAdminPaymentMock.mockReset();
    getStudentMock.mockReset();
    activateAdminPaymentMock.mockReset();
    rejectAdminPaymentMock.mockReset();
    showToastMock.mockReset();

    getAdminPaymentMock.mockResolvedValue(paymentFixture);
    getStudentMock.mockResolvedValue({
      uid: "u1",
      email: "user@example.com",
      displayName: "User One",
      role: "student",
      status: "disabled",
    });
  });

  it("activates payment and refetches", async () => {
    activateAdminPaymentMock.mockResolvedValue({
      status: "ok",
      id: "p1",
      result: "activated",
      payment: { ...paymentFixture, status: "activated" },
    });

    render(() => <AdminPaymentDetail />);

    expect(await screen.findByText("Actions")).toBeInTheDocument();

    const confirmInput = screen.getByPlaceholderText("ACTIVATE");
    fireEvent.input(confirmInput, { target: { value: "ACTIVATE" } });
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => {
      expect(activateAdminPaymentMock).toHaveBeenCalledWith("p1");
    });
    await waitFor(() => {
      expect(getAdminPaymentMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("rejects payment with reason and refetches", async () => {
    rejectAdminPaymentMock.mockResolvedValue({
      status: "ok",
      id: "p1",
      result: "rejected",
      payment: { ...paymentFixture, status: "rejected" },
    });

    render(() => <AdminPaymentDetail />);

    expect(await screen.findByText("Actions")).toBeInTheDocument();

    const reason = screen.getByPlaceholderText("Reason (optional)");
    fireEvent.input(reason, { target: { value: "Manual review required" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => {
      expect(rejectAdminPaymentMock).toHaveBeenCalledWith("p1", {
        reason: "Manual review required",
      });
    });
    await waitFor(() => {
      expect(getAdminPaymentMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });
});
