// Mirror of backend/app/services/youtube_onboarding.py. The backend stays the
// source of truth and rejects inconsistent payloads; this copy exists so the
// pre-registration pages can show the right options without a round trip.

export const TOPICS = [
  "movies_anime",
  "games",
  "education",
  "business",
  "tech_ai",
  "lifestyle",
  "beauty",
  "health",
  "food",
  "travel",
  "family",
  "psychology",
  "news",
  "music",
  "sport",
  "humor",
  "true_crime",
] as const;

export const VIDEO_FORMATS = ["live", "talking_head", "voiceover"] as const;

export const PURPOSES = ["earn", "business", "community", "creative"] as const;

export type TopicSlug = (typeof TOPICS)[number];
export type VideoFormat = (typeof VIDEO_FORMATS)[number];
export type Purpose = (typeof PURPOSES)[number];

export type Milestone =
  | "first_video"
  | "views_10k"
  | "subs_1k_hours_4k"
  | "hours_4k"
  | "subs_2k"
  | "subs_5k"
  | "subs_10k"
  | "subs_25k"
  | "subs_50k"
  | "subs_100k";

export const FILMING_TAG = "filming";

export const MONETIZATION_QUESTION_MIN_SUBSCRIBERS = 1000;

const SUBSCRIBER_MILESTONES: Array<{ threshold: number; milestone: Milestone }> = [
  { threshold: 2000, milestone: "subs_2k" },
  { threshold: 5000, milestone: "subs_5k" },
  { threshold: 10000, milestone: "subs_10k" },
  { threshold: 25000, milestone: "subs_25k" },
  { threshold: 50000, milestone: "subs_50k" },
  { threshold: 100000, milestone: "subs_100k" },
];

const PURPOSE_MILESTONES: Record<Purpose, Milestone> = {
  earn: "subs_1k_hours_4k",
  business: "views_10k",
  community: "views_10k",
  creative: "first_video",
};

const TOPIC_FIXED_FORMATS: Partial<Record<TopicSlug, VideoFormat>> = {
  lifestyle: "live",
};

export function milestoneForPurpose(purpose: Purpose): Milestone {
  return PURPOSE_MILESTONES[purpose];
}

export function requiresMonetizationQuestion(subscriberCount: number): boolean {
  return subscriberCount >= MONETIZATION_QUESTION_MIN_SUBSCRIBERS;
}

export function allowedMilestones(options: {
  subscriberCount: number;
  monetizationEnabled: boolean | null;
}): Milestone[] {
  if (options.subscriberCount < MONETIZATION_QUESTION_MIN_SUBSCRIBERS) {
    return ["subs_1k_hours_4k"];
  }
  if (!options.monetizationEnabled) {
    return ["hours_4k"];
  }
  const higher = SUBSCRIBER_MILESTONES.filter(
    (item) => options.subscriberCount < item.threshold,
  ).map((item) => item.milestone);
  // Above the last rung the expert sets the goal manually; keep the top one.
  return higher.length > 0 ? higher : ["subs_100k"];
}

export function recommendedMilestone(options: {
  subscriberCount: number;
  monetizationEnabled: boolean | null;
}): Milestone {
  return allowedMilestones(options)[0];
}

export function fixedFormatForTopic(topic: TopicSlug): VideoFormat | null {
  return TOPIC_FIXED_FORMATS[topic] ?? null;
}

export function excludedTagsForFormat(format: VideoFormat | null): string[] {
  return format === "voiceover" ? [FILMING_TAG] : [];
}

export function trackForChannel(hasChannel: boolean): "self_serve" | "expert" {
  return hasChannel ? "expert" : "self_serve";
}
