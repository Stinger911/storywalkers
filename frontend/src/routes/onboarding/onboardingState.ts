import type { MeProfile } from "../../lib/auth";

export type OnboardingStep =
  | "profile"
  | "goal"
  | "courses"
  | "checkout"
  | "expert";

// The stepper shows the self-serve path only; "expert" is a separate screen.
export const ONBOARDING_STEPS: OnboardingStep[] = [
  "goal",
  "profile",
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
  const hasTelegram = Boolean((profile.telegram || "").trim());
  if (!hasTelegram) return false;
  return Boolean(profile.submitted || (profile.aboutMe || profile.notes || "").trim());
}

export function hasSelectedContent(me: MeProfile): boolean {
  if (me.selectedCourses && me.selectedCourses.length > 0) return true;
  return Boolean(me.selectedLessons && me.selectedLessons.length > 0);
}

/** Students who already had a channel get their plan from a human expert. */
export function isExpertTrack(me: MeProfile): boolean {
  return me.youtubeOnboarding?.track === "expert";
}

export function getNextOnboardingStep(me: MeProfile): OnboardingStep {
  if (!me.selectedGoalId) return "goal";
  if (!isProfileComplete(me)) return "profile";
  // The expert builds the path, so course selection and checkout are skipped.
  if (isExpertTrack(me)) return "expert";
  if (!hasSelectedContent(me)) {
    return me.subscriptionSelected === true ? "checkout" : "courses";
  }
  return "checkout";
}

export function canAccessOnboardingStep(me: MeProfile, step: OnboardingStep): boolean {
  if (step === "expert") return isExpertTrack(me);
  const next = getNextOnboardingStep(me);
  if (next === "expert") return step === "goal" || step === "profile";
  return stepIndex(step) <= stepIndex(next);
}

export function isOnboardingIncomplete(me: MeProfile): boolean {
  if (isExpertTrack(me)) {
    // Nothing left to pick: the account is ready once the profile is filled.
    return !isProfileComplete(me) || !me.selectedGoalId;
  }
  return (
    !isProfileComplete(me) ||
    !me.selectedGoalId ||
    !hasSelectedContent(me)
  );
}

export function stepIndex(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step);
}
