import { apiFetch } from "./api";

export type Course = {
  id: string;
  title: string;
  shortDescription: string;
  price: number;
  isActive: boolean;
};

type CoursesResponse = {
  items: Course[];
};

type RawCourse = {
  id?: unknown;
  title?: unknown;
  shortDescription?: unknown;
  description?: unknown;
  price?: unknown;
  isActive?: unknown;
};

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? "Request failed");
  }
  return response.json() as Promise<T>;
}

let cachedCourses: Course[] | null = null;

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
  const numericPrice =
    typeof raw.price === "number"
      ? raw.price
      : typeof raw.price === "string"
        ? Number(raw.price)
        : 0;
  return {
    id: raw.id,
    title,
    shortDescription,
    price: Number.isFinite(numericPrice) ? Math.max(0, numericPrice) : 0,
    isActive: raw.isActive !== false,
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

export async function listCourses(options?: { force?: boolean }) {
  if (!options?.force && cachedCourses) {
    return { items: cachedCourses };
  }
  const response = await apiFetch("/api/courses");
  const payload = await handleJson<CoursesResponse | RawCourse[]>(response);
  const items = normalizeResponse(payload);
  cachedCourses = items;
  return { items };
}

export function resetCoursesCacheForTests() {
  cachedCourses = null;
}
