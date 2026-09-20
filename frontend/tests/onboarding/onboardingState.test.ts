import { describe, expect, it } from "vitest";

import type { MeProfile } from "../../src/lib/auth";
import {
  canAccessOnboardingStep,
  getNextOnboardingStep,
  isExpertTrack,
  isOnboardingIncomplete,
  isProfileComplete,
} from "../../src/routes/onboarding/onboardingState";

function baseMe(): MeProfile {
  return {
    uid: "u1",
    email: "u1@example.com",
    displayName: "User One",
    role: "student",
    status: "active",
    level: 1,
    selectedGoalId: null,
    profileForm: {
      aboutMe: null,
      submitted: null,
      telegram: null,
      socialUrl: null,
      experienceLevel: null,
      notes: null,
    },
    selectedCourses: [],
    subscriptionSelected: null,
  };
}

describe("onboardingState", () => {
  it("computes next step in order", () => {
    const me1 = baseMe();
    expect(getNextOnboardingStep(me1)).toBe("goal");

    const me2 = {
      ...baseMe(),
      selectedGoalId: "goal-1",
    };
    expect(getNextOnboardingStep(me2)).toBe("profile");

    const me3 = {
      ...me2,
      profileForm: {
        ...baseMe().profileForm,
        submitted: true,
        telegram: "@alice",
      },
    };
    expect(getNextOnboardingStep(me3)).toBe("courses");

    const me4 = { ...me3, selectedCourses: ["course-1"] };
    expect(getNextOnboardingStep(me4)).toBe("checkout");
    expect(isOnboardingIncomplete(me4)).toBe(false);
    expect(isOnboardingIncomplete(me1)).toBe(true);
  });

  it("allows earlier onboarding steps but blocks skipping ahead", () => {
    const me = {
      ...baseMe(),
      profileForm: {
        ...baseMe().profileForm,
        submitted: true,
        telegram: "@alice",
      },
      selectedGoalId: "goal-1",
    };

    expect(canAccessOnboardingStep(me, "profile")).toBe(true);
    expect(canAccessOnboardingStep(me, "goal")).toBe(true);
    expect(canAccessOnboardingStep(me, "courses")).toBe(true);
    expect(canAccessOnboardingStep(me, "checkout")).toBe(false);
  });

  it("treats community-only checkout as the next step when no courses are selected", () => {
    const me = {
      ...baseMe(),
      profileForm: {
        ...baseMe().profileForm,
        submitted: true,
        telegram: "@alice",
      },
      selectedGoalId: "goal-1",
      subscriptionSelected: true,
      selectedCourses: [],
    };

    expect(getNextOnboardingStep(me)).toBe("checkout");
    expect(isOnboardingIncomplete(me)).toBe(true);
  });

  it("treats non-empty profileForm with telegram as complete", () => {
    expect(isProfileComplete(baseMe())).toBe(false);
    expect(
      isProfileComplete({
        ...baseMe(),
        profileForm: {
          aboutMe: "I am here",
          submitted: null,
          telegram: "@alice",
          socialUrl: "https://example.com",
          experienceLevel: null,
          notes: null,
        },
      }),
    ).toBe(true);
  });

  it("treats an explicitly submitted profile with telegram as complete", () => {
    expect(
      isProfileComplete({
        ...baseMe(),
        profileForm: {
          ...baseMe().profileForm,
          submitted: true,
          telegram: "@alice",
        },
      }),
    ).toBe(true);
  });

  it("treats submitted profile without telegram as incomplete", () => {
    expect(
      isProfileComplete({
        ...baseMe(),
        profileForm: {
          ...baseMe().profileForm,
          submitted: true,
          telegram: null,
        },
      }),
    ).toBe(false);
  });

  it("routes the expert track past course selection and checkout", () => {
    const withChannel: MeProfile = {
      ...baseMe(),
      selectedGoalId: "goal-1",
      youtubeOnboarding: { hasChannel: true, track: "expert" },
    };

    expect(isExpertTrack(withChannel)).toBe(true);
    expect(getNextOnboardingStep(withChannel)).toBe("profile");
    expect(isOnboardingIncomplete(withChannel)).toBe(true);

    const withProfile: MeProfile = {
      ...withChannel,
      profileForm: {
        ...baseMe().profileForm,
        submitted: true,
        telegram: "@alice",
      },
    };

    expect(getNextOnboardingStep(withProfile)).toBe("expert");
    // No courses to pick, so onboarding is done once the profile is filled.
    expect(isOnboardingIncomplete(withProfile)).toBe(false);
    expect(canAccessOnboardingStep(withProfile, "expert")).toBe(true);
    expect(canAccessOnboardingStep(withProfile, "checkout")).toBe(false);
    expect(canAccessOnboardingStep(withProfile, "courses")).toBe(false);
  });

  it("keeps the self-serve track away from the expert screen", () => {
    const selfServe: MeProfile = {
      ...baseMe(),
      selectedGoalId: "goal-1",
      selectedCourses: ["course-1"],
      profileForm: {
        ...baseMe().profileForm,
        submitted: true,
        telegram: "@alice",
      },
      youtubeOnboarding: { hasChannel: false, track: "self_serve" },
    };

    expect(isExpertTrack(selfServe)).toBe(false);
    expect(getNextOnboardingStep(selfServe)).toBe("checkout");
    expect(canAccessOnboardingStep(selfServe, "expert")).toBe(false);
  });

  it("leaves students from the old flow untouched", () => {
    const legacy: MeProfile = {
      ...baseMe(),
      selectedGoalId: "goal-1",
      profileForm: {
        ...baseMe().profileForm,
        submitted: true,
        telegram: "@alice",
      },
    };

    expect(isExpertTrack(legacy)).toBe(false);
    expect(getNextOnboardingStep(legacy)).toBe("courses");
    expect(isOnboardingIncomplete(legacy)).toBe(true);
  });
});
