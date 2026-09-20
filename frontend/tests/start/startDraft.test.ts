import { beforeEach, describe, expect, it } from "vitest";

import {
  canAccessStep,
  clearDraft,
  draftAsksMonetization,
  emptyDraft,
  furthestStep,
  readDraft,
  toYoutubeOnboardingPayload,
  writeDraft,
} from "../../src/routes/start/startDraft";

function channel(subscriberCount: number | null, hidden = false) {
  return {
    channelId: "UC123",
    title: "StoryWalkers",
    url: "https://youtube.com/@storywalkers",
    subscriberCount,
    hiddenSubscriberCount: hidden,
    videoCount: 42,
    viewCount: 120000,
  };
}

describe("startDraft", () => {
  beforeEach(() => {
    clearDraft();
  });

  it("starts empty and keeps written answers", () => {
    expect(readDraft().hasChannel).toBeNull();

    writeDraft({ hasChannel: false, topic: "games", format: "voiceover" });

    const stored = readDraft();
    expect(stored.hasChannel).toBe(false);
    expect(stored.topic).toBe("games");
    expect(stored.format).toBe("voiceover");
  });

  it("drops a draft of an older version", () => {
    localStorage.setItem(
      "storywalkers:onboarding-draft",
      JSON.stringify({ ...emptyDraft(), version: 0, topic: "games" }),
    );

    expect(readDraft().topic).toBeNull();
  });

  it("guards steps until the previous answers exist", () => {
    expect(furthestStep(readDraft())).toBe("channel");

    writeDraft({ hasChannel: true, channel: channel(null) });
    expect(furthestStep(readDraft())).toBe("channel");

    writeDraft({ channel: channel(1500) });
    expect(furthestStep(readDraft())).toBe("topic");
    expect(canAccessStep(readDraft(), "goal")).toBe(false);

    writeDraft({ topic: "tech_ai", format: "talking_head" });
    expect(furthestStep(readDraft())).toBe("goal");

    writeDraft({ monetizationEnabled: false, targetMilestone: "hours_4k" });
    expect(furthestStep(readDraft())).toBe("plan");
    expect(canAccessStep(readDraft(), "plan")).toBe(true);
  });

  it("asks about monetization only with a channel above the threshold", () => {
    writeDraft({ hasChannel: true, channel: channel(999) });
    expect(draftAsksMonetization(readDraft())).toBe(false);

    writeDraft({ channel: channel(1000) });
    expect(draftAsksMonetization(readDraft())).toBe(true);

    writeDraft({ hasChannel: false, channel: null });
    expect(draftAsksMonetization(readDraft())).toBe(false);
  });

  it("builds the PATCH /api/me payload for the expert branch", () => {
    writeDraft({
      hasChannel: true,
      channel: channel(1500),
      topic: "tech_ai",
      format: "voiceover",
      monetizationEnabled: false,
      targetMilestone: "hours_4k",
    });

    expect(toYoutubeOnboardingPayload(readDraft())).toEqual({
      version: 1,
      hasChannel: true,
      channel: {
        url: "https://youtube.com/@storywalkers",
        channelId: "UC123",
        title: "StoryWalkers",
        subscriberCount: 1500,
        hiddenSubscriberCount: false,
        videoCount: 42,
        viewCount: 120000,
        subscriberCountSource: "api",
      },
      topic: "tech_ai",
      format: "voiceover",
      purpose: null,
      monetizationEnabled: false,
      targetMilestone: "hours_4k",
      track: "expert",
      excludedTags: ["filming"],
    });
  });

  it("builds the payload for the self-serve branch and marks manual counts", () => {
    writeDraft({
      hasChannel: false,
      topic: "lifestyle",
      format: "live",
      purpose: "business",
    });

    expect(toYoutubeOnboardingPayload(readDraft())).toMatchObject({
      hasChannel: false,
      channel: null,
      purpose: "business",
      targetMilestone: "views_10k",
      track: "self_serve",
      excludedTags: [],
    });

    writeDraft({
      hasChannel: true,
      channel: channel(2500, true),
      topic: "games",
      format: "live",
      purpose: null,
      monetizationEnabled: true,
      targetMilestone: "subs_5k",
    });

    expect(
      toYoutubeOnboardingPayload(readDraft())?.channel?.subscriberCountSource,
    ).toBe("manual");
  });

  it("returns no payload while the draft is incomplete", () => {
    writeDraft({ hasChannel: false, topic: "games", format: "live" });
    expect(toYoutubeOnboardingPayload(readDraft())).toBeNull();
  });
});
