import type { MeProfile } from "../../lib/auth";

export type OnboardingStep = "profile" | "goal" | "courses" | "checkout";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  "profile",
  "goal",
  "courses",
  "checkout",
];

const ONBOARDING_GOAL_CACHE_KEY = "storywalkers:onboarding-goal";

export type CachedOnboardingGoal = {
  goalId: string;
  goalTitle?: string | null;
};

export function onboardingPath(step: OnboardingStep): string {
  return `/onboarding/${step}`;
}

export function readCachedOnboardingGoal(): CachedOnboardingGoal | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(ONBOARDING_GOAL_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedOnboardingGoal;
    if (!parsed?.goalId || typeof parsed.goalId !== "string") return null;
    return {
      goalId: parsed.goalId,
      goalTitle:
        typeof parsed.goalTitle === "string" && parsed.goalTitle.trim()
          ? parsed.goalTitle
          : null,
    };
  } catch {
    return null;
  }
}

export function writeCachedOnboardingGoal(goal: CachedOnboardingGoal) {
  if (typeof window === "undefined") return;
  const goalId = goal.goalId.trim();
  if (!goalId) return;
  window.sessionStorage.setItem(
    ONBOARDING_GOAL_CACHE_KEY,
    JSON.stringify({
      goalId,
      goalTitle: goal.goalTitle?.trim() || null,
    }),
  );
}

export function isProfileComplete(me: MeProfile): boolean {
  const profile = me.profileForm;
  if (!profile) return false;
  return Boolean((profile.aboutMe || profile.notes || "").trim());
}

export function getNextOnboardingStep(me: MeProfile): OnboardingStep {
  if (!isProfileComplete(me)) return "profile";
  if (!me.selectedGoalId) return "goal";
  if (!me.selectedCourses || me.selectedCourses.length === 0) {
    return me.subscriptionSelected === true ? "checkout" : "courses";
  }
  return "checkout";
}

export function canAccessOnboardingStep(me: MeProfile, step: OnboardingStep): boolean {
  return stepIndex(step) <= stepIndex(getNextOnboardingStep(me));
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
