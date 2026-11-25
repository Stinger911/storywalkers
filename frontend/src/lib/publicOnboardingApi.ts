// Client for the two unauthenticated onboarding endpoints. Deliberately does
// not use apiFetch: these pages run before registration, so there is no token
// to attach and a 401 handler would be wrong here.

export type ChannelStats = {
  channelId: string | null;
  title: string | null;
  url: string | null;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  videoCount: number | null;
  viewCount: number | null;
};

export type ChannelLookupResult = {
  channel: ChannelStats;
  cached: boolean;
};

export type PlanLesson = {
  id: string;
  title: string;
  order: number;
};

export type PlanCourse = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  lessonCount: number;
  priceUsdCents: number | null;
  lessons: PlanLesson[];
};

export type OnboardingPlan = {
  goal: { id: string; title: string; slug: string | null };
  excludedTags: string[];
  courses: PlanCourse[];
};

export class PublicApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PublicApiError";
    this.code = code;
  }
}

function buildUrl(path: string) {
  const base = import.meta.env.VITE_API_BASE ?? "";
  return `${base}${path}`;
}

async function publicGet<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new PublicApiError("network_error", "Request failed");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: unknown; message?: unknown };
    };
    const code =
      typeof payload?.error?.code === "string" ? payload.error.code : "request_failed";
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Request failed";
    throw new PublicApiError(code, message);
  }

  return (await response.json()) as T;
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeChannel(raw: unknown): ChannelStats {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    channelId: asStringOrNull(data.channelId),
    title: asStringOrNull(data.title),
    url: asStringOrNull(data.url),
    subscriberCount: asNumberOrNull(data.subscriberCount),
    hiddenSubscriberCount: data.hiddenSubscriberCount === true,
    videoCount: asNumberOrNull(data.videoCount),
    viewCount: asNumberOrNull(data.viewCount),
  };
}

export async function lookupYoutubeChannel(url: string): Promise<ChannelLookupResult> {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    throw new PublicApiError("youtube_link_unsupported", "Channel link is required");
  }
  const payload = await publicGet<{ channel?: unknown; cached?: unknown }>(
    `/api/public/youtube/channel?url=${encodeURIComponent(trimmed)}`,
  );
  return {
    channel: normalizeChannel(payload.channel),
    cached: payload.cached === true,
  };
}

function normalizePlanCourse(raw: unknown): PlanCourse | null {
  const data = (raw ?? {}) as Record<string, unknown>;
  const id = asStringOrNull(data.id);
  const title = asStringOrNull(data.title);
  if (!id || !title) return null;
  const lessons = Array.isArray(data.lessons) ? data.lessons : [];
  return {
    id,
    title,
    description: asStringOrNull(data.description),
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    lessonCount: asNumberOrNull(data.lessonCount) ?? lessons.length,
    priceUsdCents: asNumberOrNull(data.priceUsdCents),
    lessons: lessons
      .map((lesson) => {
        const item = (lesson ?? {}) as Record<string, unknown>;
        const lessonId = asStringOrNull(item.id);
        const lessonTitle = asStringOrNull(item.title);
        if (!lessonId || !lessonTitle) return null;
        return {
          id: lessonId,
          title: lessonTitle,
          order: asNumberOrNull(item.order) ?? 0,
        };
      })
      .filter((lesson): lesson is PlanLesson => Boolean(lesson))
      .sort((a, b) => a.order - b.order),
  };
}

export async function getOnboardingPlan(options: {
  goal: string;
  format?: string | null;
}): Promise<OnboardingPlan> {
  const params = new URLSearchParams({ goal: options.goal });
  if (options.format) params.set("format", options.format);
  const payload = await publicGet<{
    goal?: unknown;
    excludedTags?: unknown;
    courses?: unknown;
  }>(`/api/public/onboarding/plan?${params.toString()}`);

  const goalRaw = (payload.goal ?? {}) as Record<string, unknown>;
  return {
    goal: {
      id: asStringOrNull(goalRaw.id) ?? "",
      title: asStringOrNull(goalRaw.title) ?? "",
      slug: asStringOrNull(goalRaw.slug),
    },
    excludedTags: Array.isArray(payload.excludedTags)
      ? payload.excludedTags.filter((tag): tag is string => typeof tag === "string")
      : [],
    courses: (Array.isArray(payload.courses) ? payload.courses : [])
      .map(normalizePlanCourse)
      .filter((course): course is PlanCourse => Boolean(course)),
  };
}
