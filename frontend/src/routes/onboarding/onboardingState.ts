import type { MeProfile } from "../../lib/auth";

export type OnboardingStep = "profile" | "goal" | "courses" | "checkout";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "profile",
  "goal",
  "courses",
  "checkout",
];

export function onboardingPath(step: OnboardingStep): string {
  return `/onboarding/${step}`;
}

export function isProfileComplete(me: MeProfile): boolean {
  const profile = me.profileForm;
  if (!profile) return false;
  return Boolean((profile.aboutMe || profile.notes || "").trim());
}

export function getNextOnboardingStep(me: MeProfile): OnboardingStep {
  if (!isProfileComplete(me)) return "profile";
  if (!me.selectedGoalId) return "goal";
  if (!me.selectedCourses || me.selectedCourses.length === 0) return "courses";
  return "checkout";
}

export function isOnboardingIncomplete(me: MeProfile): boolean {
  return (
    !isProfileComplete(me) ||
    !me.selectedGoalId ||
    !me.selectedCourses ||
    me.selectedCourses.length === 0
  );
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
