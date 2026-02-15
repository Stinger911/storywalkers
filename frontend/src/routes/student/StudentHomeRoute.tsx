import { Navigate } from "@solidjs/router";
import { Show } from "solid-js";

import { Loading } from "../../components/Loading";
import { useAuth } from "../../lib/auth";
import { StudentLayout } from "./StudentLayout";
import { StudentProfile, StudentProfileRail } from "./StudentProfile";
import {
  getNextOnboardingStep,
  isOnboardingIncomplete,
  onboardingPath,
} from "../onboarding/onboardingState";

export function StudentHomeRoute() {
  const auth = useAuth();

  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      {(() => {
        const me = auth.me();
        if (!me) return <Navigate href="/login" />;
        if (me.role !== "student") return <Navigate href="/admin/home" />;
        if (isOnboardingIncomplete(me)) {
          return <Navigate href={onboardingPath(getNextOnboardingStep(me))} />;
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
