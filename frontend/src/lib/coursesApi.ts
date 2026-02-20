import { apiFetch } from "./api";

export type Course = {
  id: string;
  title: string;
  shortDescription: string;
  priceUsdCents: number;
  isActive: boolean;
  goalIds: string[];
};

type CoursesResponse = {
  items: Course[];
};

type RawCourse = {
  id?: unknown;
  title?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  priceUsdCents?: unknown;
  price?: unknown;
  isActive?: unknown;
  goalIds?: unknown;
};

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

const cachedCoursesByGoal = new Map<string, Course[]>();

function normalizeCourse(raw: RawCourse): Course | null {
  if (typeof raw?.id !== "string" || !raw.id.trim()) return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  const shortDescription =
    typeof raw.shortDescription === "string"
      ? raw.shortDescription
      : typeof raw.description === "string"
        ? raw.description
        : "";
  const cents =
    typeof raw.priceUsdCents === "number"
      ? raw.priceUsdCents
      : typeof raw.priceUsdCents === "string"
        ? Number(raw.priceUsdCents)
        : typeof raw.price === "number"
          ? raw.price * 100
          : typeof raw.price === "string"
            ? Number(raw.price) * 100
            : 0;
  const goalIds = Array.isArray(raw.goalIds)
    ? raw.goalIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  return {
    id: raw.id,
    title,
    shortDescription,
    priceUsdCents: Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0,
    isActive: raw.isActive !== false,
    goalIds,
  };
}

function normalizeResponse(payload: unknown): Course[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown })?.items)
      ? ((payload as { items: unknown[] }).items ?? [])
      : [];
  return list
    .map((item) => normalizeCourse(item as RawCourse))
    .filter((item): item is Course => Boolean(item));
}

type ListCoursesOptions = {
  force?: boolean;
  goalId?: string | null;
};

function normalizeGoalId(goalId: string | null | undefined) {
  if (typeof goalId !== "string") return "";
  const trimmed = goalId.trim();
  return trimmed;
}

export async function listCourses(options?: ListCoursesOptions) {
  const goalId = normalizeGoalId(options?.goalId);
  if (!options?.force && cachedCoursesByGoal.has(goalId)) {
    return { items: cachedCoursesByGoal.get(goalId) ?? [] };
  }
  const query = goalId ? `?goalId=${encodeURIComponent(goalId)}` : "";
  const response = await apiFetch(`/api/courses${query}`);
  const payload = await handleJson<CoursesResponse | RawCourse[]>(response);
  const items = normalizeResponse(payload);
  cachedCoursesByGoal.set(goalId, items);
  return { items };
}

export function resetCoursesCacheForTests() {
  cachedCoursesByGoal.clear();
}

export function convertUsdCentsToCurrencyCents(
  usdCents: number,
  rate: number | null | undefined,
) {
  if (!Number.isFinite(usdCents)) return 0;
  const safeRate = typeof rate === "number" && rate > 0 ? rate : 1;
  return Math.max(0, Math.round(usdCents * safeRate));
}

export function formatCents(cents: number, currency: string) {
  const safeCents = Number.isFinite(cents) ? Math.max(0, cents) : 0;
  const safeCurrency = typeof currency === "string" && currency ? currency : "USD";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: safeCurrency,
    minimumFractionDigits: 2,
  }).format(safeCents / 100);
}
