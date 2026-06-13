import { createContext, createEffect, createMemo, createSignal, useContext, type JSX } from "solid-js";

import type { Goal } from "../../lib/adminApi";
import { useAuth } from "../../lib/auth";
import {
  completeMyStep,
  getMyDashboard,
  updateMyStepProgress,
  type PlanStep as ApiPlanStep,
  type StudentCourse,
} from "../../lib/studentApi";
import type { StudentPathStep } from "./studentPathTypes";

export type StudentPlan = {
  studentUid: string;
  goalId: string;
};

export type StudentPlanState = {
  plan: () => StudentPlan | null;
  goal: () => Goal | null;
  courses: () => StudentCourse[];
  steps: () => StudentPathStep[];
  stepsByCourseId: () => Map<string, StudentPathStep[]>;
  loading: () => boolean;
  error: () => string | null;
  progress: () => { total: number; done: number; percent: number };
  reload: () => Promise<void>;
  markStepDone: (stepId: string, done: boolean) => Promise<void>;
  completeStep: (stepId: string, payload: { comment?: string; link?: string }) => Promise<void>;
  openMaterial: (url?: string | null) => void;
};

export const StudentPlanContext = createContext<StudentPlanState>();

export function StudentPlanProvider(props: { children: JSX.Element }) {
  const auth = useAuth();
  const [plan, setPlan] = createSignal<StudentPlan | null>(null);
  const [goal, setGoal] = createSignal<Goal | null>(null);
  const [courses, setCourses] = createSignal<StudentCourse[]>([]);
  const [steps, setSteps] = createSignal<StudentPathStep[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const reload = async () => {
    if (auth.loading() || !auth.me()) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const dashboard = await getMyDashboard();
      const planData = dashboard.plan;
      setPlan({
        studentUid: planData.studentUid,
        goalId: planData.goalId,
      });
      setGoal(dashboard.goal);
      setCourses(dashboard.courses?.items ?? []);
      setSteps(
        dashboard.steps.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step: ApiPlanStep) => {
            // TODO: implement sequential locking in future epic.
            const isLocked = step.order > 0 && false;
            return {
              id: step.stepId,
              courseId: step.courseId ?? null,
              title: step.title,
              description: step.description,
              materialUrl: step.materialUrl,
              order: step.order,
              lessonOrder: step.lessonOrder ?? null,
              isDone: step.isDone,
              isLocked,
              doneAt: step.doneAt as { toDate?: () => Date } | null,
              doneComment: step.doneComment ?? null,
              doneLink: step.doneLink ?? null,
            };
          }),
      );
    } catch (err) {
      setError((err as Error).message);
      setPlan(null);
      setGoal(null);
      setCourses([]);
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
      setCourses([]);
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

  const stepsByCourseId = createMemo(() => {
    const grouped = new Map<string, StudentPathStep[]>();
    for (const step of steps()) {
      const courseId = step.courseId?.trim() || "__legacy__";
      const current = grouped.get(courseId) ?? [];
      current.push(step);
      grouped.set(courseId, current);
    }
    for (const [courseId, items] of grouped) {
      grouped.set(
        courseId,
        items.slice().sort((a, b) =>
          (a.lessonOrder ?? a.order) - (b.lessonOrder ?? b.order)
        ),
      );
    }
    return grouped;
  });

  const markStepDone = async (stepId: string, done: boolean) => {
    try {
      await updateMyStepProgress(stepId, done);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const completeStep = async (
    stepId: string,
    payload: { comment?: string; link?: string },
  ) => {
    await completeMyStep(stepId, payload);
    const now = new Date();
    const normalizedComment = payload.comment?.trim() || null;
    const normalizedLink = payload.link?.trim() || null;
    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              isDone: true,
              doneAt: { toDate: () => now },
              doneComment: normalizedComment,
              doneLink: normalizedLink,
            }
          : step,
      ),
    );
  };

  const openMaterial = (url?: string | null) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const value: StudentPlanState = {
    plan,
    goal,
    courses,
    steps,
    stepsByCourseId,
    loading,
    error,
    progress,
    reload,
    markStepDone,
    completeStep,
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
