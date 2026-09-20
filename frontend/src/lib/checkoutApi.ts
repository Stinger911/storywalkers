import { apiFetch } from "./api";

export type SelectedLesson = { courseId: string; lessonId: string };

export type CheckoutIntentResponse = {
  paymentId: string;
  redirectUrl: string;
  amount: number;
  currency: string;
  activationCode: string;
  instructionsText: string;
};

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function createCheckoutIntent(payload: {
  selectedCourses?: string[];
  selectedLessons?: SelectedLesson[];
}) {
  const response = await apiFetch("/api/checkout/intents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleJson<CheckoutIntentResponse>(response);
}

export type MyPayment = {
  id: string;
  amount: number;
  currency: string;
  activationCode: string | null;
  status: string;
  note: string | null;
  selectedLessons: SelectedLesson[];
  selectedCourses: string[];
  createdAt?: unknown;
};

export type MyPaymentsResponse = {
  items: MyPayment[];
  redirectUrl: string;
};

/** Invoices of the current student, including those issued by staff. */
export async function listMyPayments(limit = 10) {
  const response = await apiFetch(`/api/me/payments?limit=${limit}`);
  return handleJson<MyPaymentsResponse>(response);
}

/** Invoices the student still has to pay. */
export function isPayableInvoice(payment: MyPayment) {
  return ["created", "email_detected", "pending"].includes(payment.status);
}
