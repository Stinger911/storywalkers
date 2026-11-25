// Answers collected before registration live in localStorage, like the referral
// code in lib/referral.ts. After login the draft is sent once to PATCH /api/me
// and cleared (stage 4 of the plan).

import type { YoutubeOnboarding } from "../../lib/auth";
import type { ChannelStats } from "../../lib/publicOnboardingApi";
import {
  excludedTagsForFormat,
  milestoneForPurpose,
  requiresMonetizationQuestion,
  trackForChannel,
  type Milestone,
  type Purpose,
  type TopicSlug,
  type VideoFormat,
} from "./startRules";

const STORAGE_KEY = "storywalkers:onboarding-draft";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type StartStep = "channel" | "topic" | "goal" | "plan";

export const START_STEPS: StartStep[] = ["channel", "topic", "goal", "plan"];

export type StartDraft = {
  version: 1;
  goalSlug: string;
  hasChannel: boolean | null;
  channel: ChannelStats | null;
  topic: TopicSlug | null;
  format: VideoFormat | null;
  purpose: Purpose | null;
  monetizationEnabled: boolean | null;
  targetMilestone: Milestone | null;
  /** Whole courses picked on the plan step (self-serve track). */
  selectedCourses: string[];
  /** Single lessons picked on the plan step. */
  selectedLessons: DraftLesson[];
  updatedAt: number;
};

export type DraftLesson = { courseId: string; lessonId: string };

export const DEFAULT_GOAL_SLUG = "youtube";

export function emptyDraft(): StartDraft {
  return {
    version: 1,
    goalSlug: DEFAULT_GOAL_SLUG,
    hasChannel: null,
    channel: null,
    topic: null,
    format: null,
    purpose: null,
    monetizationEnabled: null,
    targetMilestone: null,
    selectedCourses: [],
    selectedLessons: [],
    updatedAt: Date.now(),
  };
}

export function readDraft(): StartDraft {
  if (typeof localStorage === "undefined") return emptyDraft();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyDraft();
  }
  if (!raw) return emptyDraft();
  try {
    const parsed = JSON.parse(raw) as StartDraft;
    if (parsed?.version !== 1 || Date.now() - (parsed.updatedAt ?? 0) > TTL_MS) {
      clearDraft();
      return emptyDraft();
    }
    return { ...emptyDraft(), ...parsed };
  } catch {
    clearDraft();
    return emptyDraft();
  }
}

export function writeDraft(patch: Partial<StartDraft>): StartDraft {
  const next: StartDraft = { ...readDraft(), ...patch, updatedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: the page keeps working, the draft is
    // simply not restored on reload.
  }
  return next;
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Subscribers are required for the milestone rules; hidden counts are typed in. */
export function draftSubscriberCount(draft: StartDraft): number | null {
  const count = draft.channel?.subscriberCount;
  return typeof count === "number" ? count : null;
}

export function draftAsksMonetization(draft: StartDraft): boolean {
  if (draft.hasChannel !== true) return false;
  const count = draftSubscriberCount(draft);
  return count !== null && requiresMonetizationQuestion(count);
}

/** The furthest step the draft may open, so a direct link cannot skip ahead. */
export function furthestStep(draft: StartDraft): StartStep {
  if (draft.hasChannel === null) return "channel";
  if (draft.hasChannel && draftSubscriberCount(draft) === null) return "channel";
  if (!draft.topic || !draft.format) return "topic";
  if (!draft.targetMilestone) return "goal";
  return "plan";
}

export function canAccessStep(draft: StartDraft, step: StartStep): boolean {
  return START_STEPS.indexOf(step) <= START_STEPS.indexOf(furthestStep(draft));
}

export function startPath(step: StartStep): string {
  return `/start/${step}`;
}

export function nextStep(step: StartStep): StartStep {
  const index = START_STEPS.indexOf(step);
  return START_STEPS[Math.min(index + 1, START_STEPS.length - 1)];
}

export function previousStep(step: StartStep): StartStep {
  const index = START_STEPS.indexOf(step);
  return START_STEPS[Math.max(index - 1, 0)];
}

export type YoutubeOnboardingPayload = {
  version: 1;
  hasChannel: boolean;
  channel: {
    url: string | null;
    channelId: string | null;
    title: string | null;
    subscriberCount: number;
    hiddenSubscriberCount: boolean;
    videoCount: number | null;
    viewCount: number | null;
    subscriberCountSource: "api" | "manual";
  } | null;
  topic: TopicSlug;
  format: VideoFormat;
  purpose: Purpose | null;
  monetizationEnabled: boolean | null;
  targetMilestone: Milestone;
  track: "self_serve" | "expert";
  excludedTags: string[];
};

/** Draft to the PATCH /api/me body; null while the draft is incomplete. */
export function toYoutubeOnboardingPayload(
  draft: StartDraft,
): YoutubeOnboardingPayload | null {
  if (draft.hasChannel === null || !draft.topic || !draft.format) return null;

  const milestone = draft.hasChannel
    ? draft.targetMilestone
    : draft.purpose
      ? milestoneForPurpose(draft.purpose)
      : null;
  if (!milestone) return null;

  if (draft.hasChannel) {
    const subscriberCount = draftSubscriberCount(draft);
    if (subscriberCount === null) return null;
    return {
      version: 1,
      hasChannel: true,
      channel: {
        url: draft.channel?.url ?? null,
        channelId: draft.channel?.channelId ?? null,
        title: draft.channel?.title ?? null,
        subscriberCount,
        hiddenSubscriberCount: draft.channel?.hiddenSubscriberCount === true,
        videoCount: draft.channel?.videoCount ?? null,
        viewCount: draft.channel?.viewCount ?? null,
        subscriberCountSource: draft.channel?.hiddenSubscriberCount
          ? "manual"
          : "api",
      },
      topic: draft.topic,
      format: draft.format,
      purpose: null,
      monetizationEnabled: draftAsksMonetization(draft)
        ? draft.monetizationEnabled
        : null,
      targetMilestone: milestone,
      track: trackForChannel(true),
      excludedTags: excludedTagsForFormat(draft.format),
    };
  }

  return {
    version: 1,
    hasChannel: false,
    channel: null,
    topic: draft.topic,
    format: draft.format,
    purpose: draft.purpose,
    monetizationEnabled: null,
    targetMilestone: milestone,
    track: trackForChannel(false),
    excludedTags: excludedTagsForFormat(draft.format),
  };
}

/** Read-only draft rebuilt from the saved profile, for the summary panel after registration. */
export function draftFromYoutubeOnboarding(
  data: YoutubeOnboarding | null | undefined,
): StartDraft {
  const base = emptyDraft();
  if (!data) return base;
  const channel = data.channel;
  return {
    ...base,
    hasChannel: data.hasChannel,
    channel: channel
      ? {
          channelId: channel.channelId ?? null,
          title: channel.title ?? null,
          url: channel.url ?? null,
          subscriberCount: channel.subscriberCount ?? null,
          hiddenSubscriberCount: channel.hiddenSubscriberCount === true,
          videoCount: channel.videoCount ?? null,
          viewCount: channel.viewCount ?? null,
        }
      : null,
    topic: (data.topic as StartDraft["topic"]) ?? null,
    format: (data.format as StartDraft["format"]) ?? null,
    purpose: (data.purpose as StartDraft["purpose"]) ?? null,
    monetizationEnabled: data.monetizationEnabled ?? null,
    targetMilestone: (data.targetMilestone as StartDraft["targetMilestone"]) ?? null,
  };
}
