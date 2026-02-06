import { createContext, createEffect, createMemo, createSignal, useContext, type JSX } from "solid-js";

import { listGoals, type Goal } from "../../lib/adminApi";
import { useAuth } from "../../lib/auth";
import {
  getMyPlan,
  getMyPlanSteps,
  updateMyStepProgress,
  type PlanStep as ApiPlanStep,
} from "../../lib/studentApi";

type StudentPlan = {
  studentUid: string;
  goalId: string;
};

type PlanStep = {
  id: string;
  title: string;
  description: string;
  materialUrl: string;
  order: number;
  isDone: boolean;
  doneAt?: { toDate?: () => Date } | null;
};

type StudentPlanState = {
  plan: () => StudentPlan | null;
  goal: () => Goal | null;
  steps: () => PlanStep[];
  loading: () => boolean;
  error: () => string | null;
  progress: () => { total: number; done: number; percent: number };
  reload: () => Promise<void>;
  markStepDone: (stepId: string, done: boolean) => Promise<void>;
  openMaterial: (url?: string | null) => void;
};

const StudentPlanContext = createContext<StudentPlanState>();

export function StudentPlanProvider(props: { children: JSX.Element }) {
  const auth = useAuth();
  const [plan, setPlan] = createSignal<StudentPlan | null>(null);
  const [goal, setGoal] = createSignal<Goal | null>(null);
  const [steps, setSteps] = createSignal<PlanStep[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const reload = async () => {
    if (auth.loading() || !auth.me()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [planData, stepsData, goalsData] = await Promise.all([
        getMyPlan(),
        getMyPlanSteps(),
        listGoals(),
      ]);
      setPlan({
        studentUid: planData.studentUid,
        goalId: planData.goalId,
      });
      const goalMatch = goalsData.items.find((g) => g.id === planData.goalId) || null;
      setGoal(goalMatch);
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
            doneAt: step.doneAt as { toDate?: () => Date } | null,
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
    if (auth.loading()) {
      return;
    }
    if (!auth.me()) {
      setPlan(null);
      setGoal(null);
      setSteps([]);
      setLoading(false);
      return;
    }
    void reload();
  });

  const progress = createMemo(() => {
    const total = steps().length;
    const done = steps().filter((step) => step.isDone).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  });

  const markStepDone = async (stepId: string, done: boolean) => {
    try {
      await updateMyStepProgress(stepId, done);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

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
    markStepDone,
    openMaterial,
  };

  return (
    <StudentPlanContext.Provider value={value}>
      {props.children}
    </StudentPlanContext.Provider>
  );
}

export function useStudentPlan() {
  const ctx = useContext(StudentPlanContext);
  if (!ctx) {
    throw new Error("useStudentPlan must be used within StudentPlanProvider");
  }
  return ctx;
}

export function useMyPlan() {
  return useStudentPlan();
}
