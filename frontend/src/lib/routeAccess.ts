import type { MeProfile } from "./auth";
import {
  getNextOnboardingStep,
  isOnboardingIncomplete,
  onboardingPath,
} from "../routes/onboarding/onboardingState";

type GuardRole = "student" | "staff";

type ResolveGuardInput = {
  me: MeProfile | null;
  requiredRole?: GuardRole;
  pathname: string;
};

function isCommunityOnlyAllowedPath(pathname: string) {
  return (
    pathname === "/student" ||
    pathname === "/student/home" ||
    pathname === "/student/library" ||
    pathname.startsWith("/student/library/")
  );
}

function isOnboardingPath(pathname: string) {
  return pathname.startsWith("/onboarding/");
}

export function resolveGuardRedirect(input: ResolveGuardInput): string | null {
  const { me, requiredRole, pathname } = input;
  if (!me) return "/login";

  if (requiredRole && me.role !== requiredRole) {
    return me.role === "staff" ? "/admin/home" : "/student/home";
  }

  if (me.role !== "student") {
    return null;
  }

  if (isOnboardingIncomplete(me) && !isOnboardingPath(pathname)) {
    return onboardingPath(getNextOnboardingStep(me));
  }

  if (me.status === "disabled" && !isOnboardingPath(pathname)) {
    return "/blocked";
  }
  if (me.status === "expired") {
    return "/blocked?type=expired";
  }
  if (me.status === "community_only" && !isCommunityOnlyAllowedPath(pathname)) {
    return "/blocked?type=community_only";
  }

  return null;
}
