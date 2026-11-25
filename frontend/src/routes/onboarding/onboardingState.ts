import type { MeProfile } from "../../lib/auth";

/** "start" is the public funnel under /start; the rest live under /onboarding. */
export type OnboardingStep = "start" | "profile" | "checkout" | "expert";

export function onboardingPath(step: OnboardingStep): string {
  return step === "start" ? "/start" : `/onboarding/${step}`;
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
  if (!me.selectedGoalId) return "start";
  if (!isProfileComplete(me)) return "profile";
  // The expert builds the path, so course selection and checkout are skipped.
  if (isExpertTrack(me)) return "expert";
  if (!hasSelectedContent(me)) {
    return me.subscriptionSelected === true ? "checkout" : "start";
  }
  return "checkout";
}

export function canAccessOnboardingStep(me: MeProfile, step: OnboardingStep): boolean {
  if (step === "expert") return isExpertTrack(me);
  // The funnel is public; it is also where a path is picked again.
  if (step === "start") return true;
  if (!me.selectedGoalId) return false;
  if (step === "profile") return true;
  return getNextOnboardingStep(me) === "checkout";
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
