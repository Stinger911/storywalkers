import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "../../src/lib/api";
import { getOnboardingPlan } from "../../src/lib/publicOnboardingApi";
import { clearDraft, readDraft, writeDraft } from "../../src/routes/start/startDraft";
import { syncDraftToMe } from "../../src/routes/start/startSync";

vi.mock("../../src/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../../src/lib/publicOnboardingApi", () => ({
  getOnboardingPlan: vi.fn(),
}));

function plan() {
  return {
    goal: { id: "goal-1", title: "YouTube channel", slug: "youtube" },
    excludedTags: [],
    courses: [
      { id: "c1", title: "A", description: null, tags: [], lessonCount: 1, lessons: [] },
      { id: "c2", title: "B", description: null, tags: [], lessonCount: 1, lessons: [] },
    ],
  };
}

function seedSelfServeDraft() {
  writeDraft({
    hasChannel: false,
    channel: null,
    topic: "games",
    format: "voiceover",
    purpose: "earn",
    targetMilestone: "subs_1k_hours_4k",
  });
}

function seedExpertDraft() {
  writeDraft({
    hasChannel: true,
    channel: {
      channelId: "UC123",
      title: "StoryWalkers",
      url: "https://youtube.com/@storywalkers",
      subscriberCount: 1500,
      hiddenSubscriberCount: false,
      videoCount: 42,
      viewCount: 120000,
    },
    topic: "tech_ai",
    format: "talking_head",
    monetizationEnabled: false,
    targetMilestone: "hours_4k",
  });
}

function patchedBody() {
  const call = vi.mocked(apiFetch).mock.calls[0];
  return JSON.parse(String((call?.[1] as RequestInit)?.body ?? "{}"));
}

describe("syncDraftToMe", () => {
  beforeEach(() => {
    clearDraft();
    vi.mocked(apiFetch).mockReset();
    vi.mocked(getOnboardingPlan).mockReset();
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 200 }));
    vi.mocked(getOnboardingPlan).mockResolvedValue(plan());
  });

  it("does nothing without a complete draft", async () => {
    expect(await syncDraftToMe()).toBe("empty");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends answers, goal and the whole path for students without a channel", async () => {
    seedSelfServeDraft();

    expect(await syncDraftToMe()).toBe("synced");

    const body = patchedBody();
    expect(body.selectedGoalId).toBe("goal-1");
    expect(body.selectedCourses).toEqual(["c1", "c2"]);
    expect(body.subscriptionSelected).toBe(true);
    expect(body.youtubeOnboarding).toMatchObject({
      hasChannel: false,
      track: "self_serve",
      targetMilestone: "subs_1k_hours_4k",
      excludedTags: ["filming"],
    });
    expect(readDraft().hasChannel).toBeNull();
  });

  it("preselects no courses for the expert track", async () => {
    seedExpertDraft();

    expect(await syncDraftToMe()).toBe("synced");

    const body = patchedBody();
    expect(body.selectedCourses).toBeUndefined();
    expect(body.subscriptionSelected).toBeUndefined();
    expect(body.youtubeOnboarding).toMatchObject({
      hasChannel: true,
      track: "expert",
      monetizationEnabled: false,
    });
  });

  it("still saves the answers when the goal lookup fails", async () => {
    seedSelfServeDraft();
    vi.mocked(getOnboardingPlan).mockRejectedValue(new Error("boom"));

    expect(await syncDraftToMe()).toBe("synced");

    const body = patchedBody();
    expect(body.selectedGoalId).toBeUndefined();
    expect(body.youtubeOnboarding).toBeTruthy();
  });

  it("keeps the draft when the request fails", async () => {
    seedSelfServeDraft();
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));

    expect(await syncDraftToMe()).toBe("failed");
    expect(readDraft().hasChannel).toBe(false);
  });
});
