import { describe, expect, it } from "vitest";

import { resolveGuardRedirect } from "../../src/lib/routeAccess";

const student = (status: "active" | "disabled" | "community_only" | "expired") => ({
  uid: "u1",
  email: "u1@example.com",
  displayName: "User One",
  role: "student" as const,
  status,
});

const staff = () => ({
  uid: "s1",
  email: "s1@example.com",
  displayName: "Staff",
  role: "staff" as const,
  status: "disabled" as const,
});

describe("resolveGuardRedirect", () => {
  it("redirects unauthenticated user to login", () => {
    expect(
      resolveGuardRedirect({ me: null, requiredRole: "student", pathname: "/student/home" }),
    ).toBe("/login");
  });

  it("redirects disabled and expired students to blocked page", () => {
    expect(
      resolveGuardRedirect({
        me: student("disabled"),
        requiredRole: "student",
        pathname: "/student/questions",
      }),
    ).toBe("/blocked");
    expect(
      resolveGuardRedirect({
        me: student("expired"),
        requiredRole: "student",
        pathname: "/student/home",
      }),
    ).toBe("/blocked?type=expired");
  });

  it("allows community_only only on dashboard and library paths", () => {
    expect(
      resolveGuardRedirect({
        me: student("community_only"),
        requiredRole: "student",
        pathname: "/student/home",
      }),
    ).toBeNull();
    expect(
      resolveGuardRedirect({
        me: student("community_only"),
        requiredRole: "student",
        pathname: "/student/library/entry-1",
      }),
    ).toBeNull();
    expect(
      resolveGuardRedirect({
        me: student("community_only"),
        requiredRole: "student",
        pathname: "/student/questions",
      }),
    ).toBe("/blocked?type=community_only");
  });

  it("does not apply student status restrictions to staff", () => {
    expect(
      resolveGuardRedirect({
        me: staff(),
        requiredRole: "staff",
        pathname: "/admin/home",
      }),
    ).toBeNull();
  });
});
