import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { useParams } from "@solidjs/router";

import { Button } from "../../components/ui/button";
// import {
//   TextField,
//   TextFieldInput,
//   TextFieldLabel,
// } from "../../components/ui/text-field";
import {
  assignPlan,
  bulkAddSteps,
  getStudent,
  getStudentPlan,
  getStudentPlanSteps,
  listGoals,
  listStepTemplates,
  reorderSteps,
  updateStudent,
  type Goal,
  type StepTemplate,
} from "../../lib/adminApi";

type StudentProfile = {
  displayName?: string;
  email?: string;
  role?: string;
  status?: string;
};

type StudentPlan = {
  goalId?: string;
  createdAt?: { toDate?: () => Date } | null;
  updatedAt?: { toDate?: () => Date } | null;
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

export function AdminStudentProfile() {
  const params = useParams();
  const uid = () => params.uid ?? "";

  const [student, setStudent] = createSignal<StudentProfile | null>(null);
  const [, setPlan] = createSignal<StudentPlan | null>(null);
  const [steps, setSteps] = createSignal<PlanStep[]>([]);
  const [goals, setGoals] = createSignal<Goal[]>([]);
  const [templates, setTemplates] = createSignal<StepTemplate[]>([]);
  const [goalId, setGoalId] = createSignal("");
  const [selectedTemplates, setSelectedTemplates] = createSignal<string[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [savingProfile, setSavingProfile] = createSignal(false);
  const [roleDraft, setRoleDraft] = createSignal("student");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentData, planData, stepsData] = await Promise.all([
        getStudent(uid()),
        getStudentPlan(uid()).catch(() => null),
        getStudentPlanSteps(uid()).catch(() => ({ items: [] })),
      ]);
      setStudent(studentData as StudentProfile);
      if (planData) {
        setPlan(planData as StudentPlan);
        setGoalId(planData.goalId || "");
      } else {
        setPlan(null);
        setGoalId("");
      }
      setSteps(
        stepsData.items.map((step) => ({
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
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  createEffect(() => {
    const currentRole = student()?.role || "student";
    setRoleDraft(currentRole);
  });

  createEffect(() => {
    const load = async () => {
      try {
        const [goalData, templateData] = await Promise.all([
          listGoals(),
          listStepTemplates(),
        ]);
        setGoals(goalData.items);
        setTemplates(templateData.items);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    void load();
  });

  const progress = createMemo(() => {
    const total = steps().length;
    const done = steps().filter((step) => step.isDone).length;
    return total ? Math.round((done / total) * 100) : 0;
  });

  const currentGoal = createMemo(() => goals().find((g) => g.id === goalId()));

  const toggleTemplate = (id: string) => {
    const current = selectedTemplates();
    if (current.includes(id)) {
      setSelectedTemplates(current.filter((value) => value !== id));
    } else {
      setSelectedTemplates([...current, id]);
    }
  };

  const saveGoal = async () => {
    if (!goalId()) {
      setError("Select a goal first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await assignPlan(uid(), goalId());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addSteps = async () => {
    if (selectedTemplates().length === 0) {
      setError("Select at least one template.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await bulkAddSteps(uid(), {
        items: selectedTemplates().map((templateId) => ({ templateId })),
      });
      setSelectedTemplates([]);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const moveStep = async (index: number, delta: number) => {
    const list = steps();
    const target = list[index];
    const swapWith = list[index + delta];
    if (!target || !swapWith) return;
    setSaving(true);
    setError(null);
    try {
      await reorderSteps(uid(), {
        items: [
          { stepId: target.id, order: swapWith.order },
          { stepId: swapWith.id, order: target.order },
        ],
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setError(null);
    try {
      await updateStudent(uid(), { role: roleDraft() });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <section class="space-y-6">
      <div class="rounded-2xl border bg-card p-6">
        <h2 class="text-2xl font-semibold">Student profile</h2>
        <Show
          when={student()}
          fallback={<div class="text-sm">Loading student…</div>}
        >
          <div class="mt-2 text-sm text-muted-foreground">
            {student()?.displayName || "Unnamed student"} · {student()?.email}
          </div>
        </Show>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div class="space-y-6">
          <div class="rounded-2xl border bg-card p-6">
            <h3 class="text-lg font-semibold">Access</h3>
            <div class="mt-4 grid gap-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium" for="role-select">
                  Role
                </label>
                <select
                  id="role-select"
                  class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={roleDraft()}
                  onChange={(e) => setRoleDraft(e.currentTarget.value)}
                >
                  <option value="student">Student</option>
                  <option value="expert">Expert</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button
                onClick={() => void saveProfile()}
                disabled={savingProfile()}
              >
                Save access
              </Button>
            </div>
          </div>

          <div class="rounded-2xl border bg-card p-6">
            <h3 class="text-lg font-semibold">Assign goal</h3>
            <div class="mt-4 grid gap-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium" for="goal-select">
                  Goal
                </label>
                <select
                  id="goal-select"
                  class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={goalId()}
                  onChange={(e) => setGoalId(e.currentTarget.value)}
                >
                  <option value="">Select goal</option>
                  {goals().map((goal) => (
                    <option value={goal.id}>{goal.title}</option>
                  ))}
                </select>
              </div>
              <Show when={currentGoal()}>
                <div class="rounded-xl border p-4 text-sm text-muted-foreground">
                  <div class="font-medium text-foreground">
                    {currentGoal()?.title}
                  </div>
                  <div>{currentGoal()?.description || "No description"}</div>
                </div>
              </Show>
              <Button onClick={() => void saveGoal()} disabled={saving()}>
                Save goal
              </Button>
            </div>
          </div>

          <div class="rounded-2xl border bg-card p-6">
            <h3 class="text-lg font-semibold">Add steps from templates</h3>
            <div class="mt-4 grid gap-3 max-h-[420px] overflow-y-auto">
              {templates().map((template) => (
                <label class="flex items-start gap-3 rounded-xl border p-3">
                  <input
                    type="checkbox"
                    checked={selectedTemplates().includes(template.id)}
                    onChange={() => toggleTemplate(template.id)}
                  />
                  <div>
                    <div class="text-sm font-semibold">{template.title}</div>
                    <div class="text-xs text-muted-foreground">
                      {template.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => void addSteps()} disabled={saving()}>
                Add selected steps
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedTemplates([])}
              >
                Clear selection
              </Button>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border bg-card p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Current plan</h3>
            <span class="rounded-full border px-3 py-1 text-xs">
              {progress()}% complete
            </span>
          </div>
          <Show
            when={!loading()}
            fallback={<div class="mt-4 text-sm">Loading…</div>}
          >
            <div class="mt-4 grid gap-3">
              {steps().map((step, index) => (
                <div class="rounded-xl border p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-sm text-muted-foreground">
                        Step {index + 1}
                      </div>
                      <div class="text-base font-semibold">{step.title}</div>
                      <div class="text-sm text-muted-foreground">
                        {step.description}
                      </div>
                      <Show when={step.materialUrl}>
                        <a
                          class="mt-1 inline-block text-xs text-primary underline"
                          href={step.materialUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open material
                        </a>
                      </Show>
                    </div>
                    <div class="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === 0 || saving()}
                        onClick={() => void moveStep(index, -1)}
                      >
                        Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={index === steps().length - 1 || saving()}
                        onClick={() => void moveStep(index, 1)}
                      >
                        Down
                      </Button>
                    </div>
                  </div>
                  <div class="mt-2 text-xs text-muted-foreground">
                    {step.isDone ? "Completed" : "Not started"}
                  </div>
                </div>
              ))}
            </div>
          </Show>
        </div>
      </div>
    </section>
  );
}
