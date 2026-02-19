import { describe, expect, it } from "vitest";

import type { MeProfile } from "../../src/lib/auth";
import {
  getNextOnboardingStep,
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
    selectedGoalId: null,
    profileForm: {
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

    const me2 = { ...baseMe(), selectedGoalId: "goal-1" };
    expect(getNextOnboardingStep(me2)).toBe("profile");

    const me3 = {
      ...me2,
      profileForm: {
        telegram: "@abc",
        socialUrl: null,
        experienceLevel: null,
        notes: null,
      },
    };
    expect(getNextOnboardingStep(me3)).toBe("courses");

    const me4 = { ...me3, selectedCourses: ["course-1"] };
    expect(getNextOnboardingStep(me4)).toBe("checkout");
    expect(isOnboardingIncomplete(me4)).toBe(false);
    expect(isOnboardingIncomplete(me1)).toBe(true);
  });

  it("treats non-empty profileForm as complete", () => {
    expect(isProfileComplete(baseMe())).toBe(false);
    expect(
      isProfileComplete({
        ...baseMe(),
        profileForm: {
          telegram: null,
          socialUrl: "https://example.com",
          experienceLevel: null,
          notes: null,
        },
      }),
    ).toBe(true);
  });
});
