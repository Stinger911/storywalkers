import type { MeProfile } from "../../lib/auth";

export type OnboardingStep = "goal" | "profile" | "courses" | "checkout";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "goal",
  "profile",
  "courses",
  "checkout",
];

export function onboardingPath(step: OnboardingStep): string {
  return `/onboarding/${step}`;
}

export function isProfileComplete(me: MeProfile): boolean {
  const profile = me.profileForm;
  if (!profile) return false;
  return Boolean(
    profile.telegram ||
      profile.socialUrl ||
      profile.experienceLevel ||
      profile.notes,
  );
}

export function getNextOnboardingStep(me: MeProfile): OnboardingStep {
  if (!me.selectedGoalId) return "goal";
  if (!isProfileComplete(me)) return "profile";
  if (!me.selectedCourses || me.selectedCourses.length === 0) return "courses";
  return "checkout";
}

export function isOnboardingIncomplete(me: MeProfile): boolean {
  return getNextOnboardingStep(me) !== "checkout";
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
