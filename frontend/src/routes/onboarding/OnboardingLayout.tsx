import { Navigate, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, Show, type JSX } from "solid-js";

import { Loading } from "../../components/Loading";
import { useAuth } from "../../lib/auth";
import { StartLayout } from "../start/StartLayout";
import { draftFromYoutubeOnboarding } from "../start/startDraft";
import {
  canAccessOnboardingStep,
  getNextOnboardingStep,
  onboardingPath,
} from "./onboardingState";

type OnboardingLayoutProps = {
  step: "profile" | "checkout";
  title: string;
  subtitle?: string;
  children: JSX.Element;
};

/** Signed-in steps of the funnel: guards access and renders the funnel shell. */
export function OnboardingLayout(props: OnboardingLayoutProps) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [resumeChecked, setResumeChecked] = createSignal(false);

  createEffect(() => {
    if (resumeChecked()) return;
    if (auth.loading()) return;
    const me = auth.me();
    if (!me) return;
    if (me.status !== "active") {
      setResumeChecked(true);
      return;
    }
    const target = onboardingPath(getNextOnboardingStep(me));
    setResumeChecked(true);
    if (!canAccessOnboardingStep(me, props.step) && location.pathname !== target) {
      void navigate(target, { replace: true });
    }
  });

  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      <Show
        when={auth.me()?.role === "student"}
        fallback={<Navigate href={auth.me()?.role === "staff" ? "/admin" : "/login"} />}
      >
        <StartLayout
          step={props.step === "checkout" ? "payment" : "plan"}
          draft={draftFromYoutubeOnboarding(auth.me()?.youtubeOnboarding)}
          title={props.title}
          subtitle={props.subtitle}
        >
          {props.children}
        </StartLayout>
      </Show>
    </Show>
  );
}
