import { apiFetch } from "./api";

export type Course = {
  id: string;
  title: string;
  shortDescription: string;
  priceUsdCents: number;
  isActive: boolean;
  goalIds: string[];
  lessonCount?: number;
};

export type CourseLesson = {
  id: string;
  title: string;
  content: string;
  materialUrl: string | null;
  order: number;
  isActive: boolean;
  updatedAt?: unknown;
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
  lessonCount?: unknown;
};

type RawCourseLesson = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  materialUrl?: unknown;
  order?: unknown;
  isActive?: unknown;
  updatedAt?: unknown;
};

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

const cachedCoursesByGoal = new Map<string, Course[]>();
const cachedLessonsByCourse = new Map<string, CourseLesson[]>();

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
    lessonCount:
      typeof raw.lessonCount === "number" && Number.isFinite(raw.lessonCount)
        ? Math.max(0, Math.round(raw.lessonCount))
        : undefined,
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

function normalizeCourseLesson(raw: RawCourseLesson): CourseLesson | null {
  if (typeof raw?.id !== "string" || !raw.id.trim()) return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  return {
    id: raw.id,
    title,
    content: typeof raw.content === "string" ? raw.content : "",
    materialUrl:
      typeof raw.materialUrl === "string" && raw.materialUrl.trim()
        ? raw.materialUrl
        : null,
    order:
      typeof raw.order === "number" && Number.isFinite(raw.order)
        ? Math.max(0, Math.round(raw.order))
        : 0,
    isActive: raw.isActive !== false,
    updatedAt: raw.updatedAt,
  };
}

export async function listCourseLessons(
  courseId: string,
  options?: { force?: boolean },
) {
  const normalizedCourseId = typeof courseId === "string" ? courseId.trim() : "";
  if (!normalizedCourseId) {
    throw new Error("courseId is required");
  }
  if (!options?.force && cachedLessonsByCourse.has(normalizedCourseId)) {
    return { items: cachedLessonsByCourse.get(normalizedCourseId) ?? [] };
  }
  const response = await apiFetch(
    `/api/courses/${encodeURIComponent(normalizedCourseId)}/lessons`,
  );
  const payload = await handleJson<{ items?: RawCourseLesson[] } | RawCourseLesson[]>(
    response,
  );
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  const items = list
    .map((item) => normalizeCourseLesson(item as RawCourseLesson))
    .filter((item): item is CourseLesson => Boolean(item))
    .sort((a, b) => a.order - b.order);
  cachedLessonsByCourse.set(normalizedCourseId, items);
  return { items };
}

export function resetCoursesCacheForTests() {
  cachedCoursesByGoal.clear();
  cachedLessonsByCourse.clear();
}

export function convertUsdCentsToCurrencyCents(
  usdCents: number,
  rate: number | null | undefined,
) {
  if (!Number.isFinite(usdCents)) return 0;
  const safeRate = typeof rate === "number" && rate > 0 ? rate : 1;
  return Math.max(0, Math.round(usdCents * safeRate));
}

export function convertRubCentsToCurrencyCents(
  rubCents: number,
  rates: Record<string, number> | null | undefined,
  targetCurrency: string | null | undefined,
) {
  if (!Number.isFinite(rubCents)) return 0;
  const safeCurrency =
    typeof targetCurrency === "string" && targetCurrency ? targetCurrency : "USD";
  if (safeCurrency === "RUB") {
    return Math.max(0, Math.round(rubCents));
  }
  const rubRate = rates?.RUB;
  const targetRate = safeCurrency === "USD" ? 1 : rates?.[safeCurrency];
  if (
    typeof rubRate !== "number" ||
    rubRate <= 0 ||
    typeof targetRate !== "number" ||
    targetRate <= 0
  ) {
    return 0;
  }
  const usdCents = rubCents / rubRate;
  return Math.max(0, Math.round(usdCents * targetRate));
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
