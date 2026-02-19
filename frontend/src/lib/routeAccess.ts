import type { MeProfile } from "./auth";

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

export function resolveGuardRedirect(input: ResolveGuardInput): string | null {
  const { me, requiredRole, pathname } = input;
  if (!me) return "/login";

  if (requiredRole && me.role !== requiredRole) {
    return me.role === "staff" ? "/admin/home" : "/student/home";
  }

  if (me.role !== "student") {
    return null;
  }

  if (me.status === "disabled") {
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
