import { Navigate, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, Show, type JSX } from "solid-js";

import { Loading } from "../../components/Loading";
import { StudentLayout } from "../student/StudentLayout";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import {
  getNextOnboardingStep,
  onboardingPath,
  ONBOARDING_STEPS,
  stepIndex,
  type OnboardingStep,
} from "./onboardingState";

type OnboardingLayoutProps = {
  step: OnboardingStep;
  title: string;
  subtitle?: string;
  children: JSX.Element;
};

function OnboardingStepper(props: { currentStep: OnboardingStep }) {
  const { t } = useI18n();
  return (
    <div class="rounded-xl border border-border/70 p-4">
      <div class="mb-3 text-sm font-medium">{t("student.onboarding.stepperTitle")}</div>
      <div class="grid gap-2 sm:grid-cols-4">
        {ONBOARDING_STEPS.map((step, index) => {
          const currentIndex = stepIndex(props.currentStep);
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const label = t(`student.onboarding.steps.${step}`);
          return (
            <div
              class={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                isCurrent
                  ? "bg-primary/10 text-primary"
                  : isDone
                    ? "bg-emerald-500/10 text-emerald-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                class={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-border text-foreground"
                }`}
              >
                {index + 1}
              </span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OnboardingLayout(props: OnboardingLayoutProps) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  createEffect(() => {
    if (auth.loading()) return;
    const me = auth.me();
    if (!me) return;
    if (me.status !== "active" && me.status !== "disabled") {
      void navigate("/student/home", { replace: true });
      return;
    }
    const target = onboardingPath(getNextOnboardingStep(me));
    if (location.pathname !== target) {
      void navigate(target, { replace: true });
    }
  });

  return (
    <Show when={!auth.loading()} fallback={<div class="page"><Loading /></div>}>
      <Show
        when={auth.me()?.role === "student"}
        fallback={<Navigate href={auth.me()?.role === "staff" ? "/admin" : "/login"} />}
      >
        <StudentLayout>
          <section class="space-y-6">
            <header>
              <h1 class="text-2xl font-semibold">{props.title}</h1>
              <Show when={props.subtitle}>
                <p class="text-sm text-muted-foreground">{props.subtitle}</p>
              </Show>
            </header>
            <OnboardingStepper currentStep={props.step} />
            {props.children}
          </section>
        </StudentLayout>
      </Show>
    </Show>
  );
}
