import { apiFetch } from "./api";

export type FxRatesResponse = {
  base: string;
  rates: Record<string, number>;
  updatedAt?: string | null;
};

let cachedFxRates: FxRatesResponse | null = null;
let cachedFxRatesAt: number | null = null;
const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

export async function getFxRates(options?: { force?: boolean }) {
  const now = Date.now();
  if (
    !options?.force &&
    cachedFxRates &&
    cachedFxRatesAt !== null &&
    now - cachedFxRatesAt < FX_CACHE_TTL_MS
  ) {
    return cachedFxRates;
  }
  const response = await apiFetch("/api/fx-rates");
  const payload = await handleJson<FxRatesResponse>(response);
  cachedFxRates = {
    base: typeof payload.base === "string" ? payload.base : "USD",
    rates: payload.rates && typeof payload.rates === "object" ? payload.rates : { USD: 1 },
    updatedAt: payload.updatedAt ?? null,
  };
  if (!cachedFxRates.rates.USD) {
    cachedFxRates.rates.USD = 1;
  }
  cachedFxRatesAt = now;
  return cachedFxRates;
}

export function resetFxRatesCacheForTests() {
  cachedFxRates = null;
  cachedFxRatesAt = null;
}
