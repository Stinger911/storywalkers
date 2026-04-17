import { Navigate, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, createSignal, Show, type JSX } from "solid-js";

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
    <div class="rounded-[calc(var(--radius-lg)+6px)] border border-border/70 bg-[linear-gradient(180deg,rgba(237,244,255,0.86)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-card">
      <div class="mb-4 text-[11px] font-extrabold uppercase tracking-[0.16em] text-secondary">
        {t("student.onboarding.stepperTitle")}
      </div>
      <div class="grid gap-2 sm:grid-cols-4">
        {ONBOARDING_STEPS.map((step, index) => {
          const currentIndex = stepIndex(props.currentStep);
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const label = t(`student.onboarding.steps.${step}`);
          return (
            <div
              class={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] ${
                isCurrent
                  ? "bg-white text-primary shadow-rail"
                  : isDone
                    ? "bg-[#eef7f0] text-[#2a683a]"
                    : "bg-[rgba(217,227,241,0.72)] text-muted-foreground"
              }`}
            >
              <span
                class={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-white text-foreground"
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
  const { t } = useI18n();
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
          <section class="mx-auto max-w-5xl space-y-6">
            <header class="space-y-3 rounded-[calc(var(--radius-lg)+8px)] border border-border/70 bg-white px-6 py-7 shadow-card sm:px-8">
              <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">
                {t("student.onboarding.eyebrow")}
              </div>
              <h1 class="text-3xl font-extrabold tracking-[-0.04em] text-foreground sm:text-4xl">
                {props.title}
              </h1>
              <Show when={props.subtitle}>
                <p class="max-w-3xl text-base leading-7 text-muted-foreground">
                  {props.subtitle}
                </p>
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
