import { Navigate, useLocation } from "@solidjs/router";
import { Show } from "solid-js";
import { Loading } from "../../components/Loading";
import { useAuth } from "../../lib/auth";
import { resolveGuardRedirect } from "../../lib/routeAccess";
import { StudentLayout } from "./StudentLayout";
import { StudentProfile, StudentProfileRail } from "./StudentProfile";
import {
  getNextOnboardingStep,
  isOnboardingIncomplete,
  onboardingPath,
} from "../onboarding/onboardingState";

export function StudentHomeRoute() {
  const auth = useAuth();
  const location = useLocation();
  const me = () => auth.me();

  const redirect = () =>
    resolveGuardRedirect({
      me: me(),
      requiredRole: "student",
      pathname: location.pathname,
    });

  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      {(() => {
        if (redirect()) return <Navigate href={redirect()!} />;
        if (me() && me()!.status === "active" && isOnboardingIncomplete(me()!)) {
          return <Navigate href={onboardingPath(getNextOnboardingStep(me()!))} />;
        }
        return (
          <StudentLayout rightRail={<StudentProfileRail />}>
            <StudentProfile />
          </StudentLayout>
        );
      })()}
    </Show>
  );
}
