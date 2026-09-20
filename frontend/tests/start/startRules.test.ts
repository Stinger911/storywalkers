import { describe, expect, it } from "vitest";

import {
  allowedMilestones,
  excludedTagsForFormat,
  fixedFormatForTopic,
  milestoneForPurpose,
  recommendedMilestone,
  requiresMonetizationQuestion,
  trackForChannel,
} from "../../src/routes/start/startRules";

describe("startRules", () => {
  it("maps purpose to the current goal", () => {
    expect(milestoneForPurpose("earn")).toBe("subs_1k_hours_4k");
    expect(milestoneForPurpose("business")).toBe("views_10k");
    expect(milestoneForPurpose("community")).toBe("views_10k");
    expect(milestoneForPurpose("creative")).toBe("first_video");
  });

  it("asks about monetization only from 1000 subscribers", () => {
    expect(requiresMonetizationQuestion(999)).toBe(false);
    expect(requiresMonetizationQuestion(1000)).toBe(true);
  });

  it("recommends the next milestone by subscribers and monetization", () => {
    expect(
      recommendedMilestone({ subscriberCount: 999, monetizationEnabled: null }),
    ).toBe("subs_1k_hours_4k");
    expect(
      recommendedMilestone({ subscriberCount: 1000, monetizationEnabled: false }),
    ).toBe("hours_4k");
    expect(
      recommendedMilestone({ subscriberCount: 1000, monetizationEnabled: true }),
    ).toBe("subs_2k");
    expect(
      recommendedMilestone({ subscriberCount: 1500, monetizationEnabled: true }),
    ).toBe("subs_2k");
    expect(
      recommendedMilestone({ subscriberCount: 2000, monetizationEnabled: true }),
    ).toBe("subs_5k");
    expect(
      recommendedMilestone({ subscriberCount: 99999, monetizationEnabled: true }),
    ).toBe("subs_100k");
    expect(
      recommendedMilestone({ subscriberCount: 100000, monetizationEnabled: true }),
    ).toBe("subs_100k");
  });

  it("offers only milestones above the current subscriber count", () => {
    expect(
      allowedMilestones({ subscriberCount: 1500, monetizationEnabled: true }),
    ).toEqual(["subs_2k", "subs_5k", "subs_10k", "subs_25k", "subs_50k", "subs_100k"]);
    expect(
      allowedMilestones({ subscriberCount: 1500, monetizationEnabled: false }),
    ).toEqual(["hours_4k"]);
    expect(
      allowedMilestones({ subscriberCount: 10, monetizationEnabled: null }),
    ).toEqual(["subs_1k_hours_4k"]);
  });

  it("locks the format for lifestyle and drops filming for voiceover", () => {
    expect(fixedFormatForTopic("lifestyle")).toBe("live");
    expect(fixedFormatForTopic("games")).toBeNull();
    expect(excludedTagsForFormat("voiceover")).toEqual(["filming"]);
    expect(excludedTagsForFormat("live")).toEqual([]);
    expect(excludedTagsForFormat(null)).toEqual([]);
  });

  it("sends students with a channel to the expert track", () => {
    expect(trackForChannel(true)).toBe("expert");
    expect(trackForChannel(false)).toBe("self_serve");
  });
});
