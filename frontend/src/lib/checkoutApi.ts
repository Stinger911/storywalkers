import { apiFetch } from "./api";

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
  selectedCourses: string[];
}) {
  const response = await apiFetch("/api/checkout/intents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return handleJson<CheckoutIntentResponse>(response);
}
