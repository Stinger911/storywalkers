import { createEffect, createMemo, createSignal, type JSX } from "solid-js";

import { listGoals, getStudentPlan, getStudentPlanSteps, type Goal } from "../../lib/adminApi";
import type { PlanStep as ApiPlanStep } from "../../lib/studentApi";
import { StudentPlanContext, type StudentPlan, type StudentPlanState } from "../student/studentPlanContext";
import type { StudentPathStep } from "../student/studentPathTypes";

export function AdminStudentPreviewPlanProvider(props: {
  uid: string;
  children: JSX.Element;
}) {
  const [plan, setPlan] = createSignal<StudentPlan | null>(null);
  const [goal, setGoal] = createSignal<Goal | null>(null);
  const [steps, setSteps] = createSignal<StudentPathStep[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [planData, goalsData] = await Promise.all([
        getStudentPlan(props.uid).catch(() => null),
        listGoals(),
      ]);
      const stepsData = planData
        ? await getStudentPlanSteps(props.uid).catch(() => ({ items: [] }))
        : { items: [] };

      if (!planData) {
        setPlan(null);
        setGoal(null);
        setSteps([]);
        return;
      }

      setPlan({
        studentUid: planData.studentUid,
        goalId: planData.goalId,
      });
      setGoal(goalsData.items.find((item) => item.id === planData.goalId) || null);
      setSteps(
        stepsData.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step: ApiPlanStep) => ({
            id: step.stepId,
            title: step.title,
            description: step.description,
            materialUrl: step.materialUrl,
            order: step.order,
            isDone: step.isDone,
            isLocked: false,
            doneAt: step.doneAt as { toDate?: () => Date } | null,
            doneComment: step.doneComment ?? null,
            doneLink: step.doneLink ?? null,
          })),
      );
    } catch (err) {
      setError((err as Error).message);
      setPlan(null);
      setGoal(null);
      setSteps([]);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void reload();
  });

  const progress = createMemo(() => {
    const total = steps().length;
    const done = steps().filter((step) => step.isDone).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  });

  const openMaterial = (url?: string | null) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const value: StudentPlanState = {
    plan,
    goal,
    steps,
    loading,
    error,
    progress,
    reload,
    markStepDone: async () => {
      throw new Error("Preview mode is read-only");
    },
    completeStep: async () => {
      throw new Error("Preview mode is read-only");
    },
    openMaterial,
  };

  return (
    <StudentPlanContext.Provider value={value}>
      {props.children}
    </StudentPlanContext.Provider>
  );
}
