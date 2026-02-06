import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { useParams } from "@solidjs/router";

import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { RightRail } from "../../components/ui/right-rail";
import { RailCard } from "../../components/ui/rail-card";
import { SectionCard } from "../../components/ui/section-card";
import { SmallStatBadge } from "../../components/ui/small-stat-badge";
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
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

type SelectOption = {
  value: string;
  label: string;
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
  const roleOptions: SelectOption[] = [
    { value: "student", label: "Student" },
    { value: "expert", label: "Expert" },
    { value: "admin", label: "Admin" },
  ];
  const goalOptions = createMemo<SelectOption[]>(() => [
    { value: "", label: "Select goal" },
    ...goals().map((goal) => ({
      value: goal.id,
      label: goal.title,
    })),
  ]);
  const selectedRoleOption = createMemo(() =>
    roleOptions.find((option) => option.value === roleDraft()) ?? null,
  );
  const selectedGoalOption = createMemo(() =>
    goalOptions().find((option) => option.value === goalId()) ?? null,
  );

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
    <Page
      title="Student profile"
      subtitle="Manage access, goals, and plan steps."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/students">Students</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Profile</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      rightRail={
        <RightRail>
          <RailCard
            title="Current plan"
            actions={<SmallStatBadge>{progress()}% complete</SmallStatBadge>}
          >
            <Show
              when={!loading()}
              fallback={<div class="text-xs text-muted-foreground">Loading…</div>}
            >
              <div class="grid gap-3">
                {steps().map((step, index) => (
                  <div class="rounded-[var(--radius-md)] border border-border/70 bg-card p-3 shadow-rail">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-xs text-muted-foreground">
                          Step {index + 1}
                        </div>
                        <div class="text-sm font-semibold">{step.title}</div>
                        <div class="text-xs text-muted-foreground">
                          {step.description}
                        </div>
                        <Show when={step.materialUrl}>
                          <a
                            class="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"
                            href={step.materialUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span class="material-symbols-outlined text-[16px]">open_in_new</span>
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
          </RailCard>
        </RightRail>
      }
    >
      <SectionCard title="Student">
        <Show
          when={student()}
          fallback={<div class="text-sm">Loading student…</div>}
        >
          <div class="text-sm text-muted-foreground">
            {student()?.displayName || "Unnamed student"} · {student()?.email}
          </div>
        </Show>
      </SectionCard>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="space-y-6">
        <SectionCard title="Access">
          <div class="grid gap-4">
            <div class="grid gap-2">
              <Select
                value={selectedRoleOption()}
                onChange={(value) =>
                  setRoleDraft((value as SelectOption | null)?.value ?? "student")
                }
                options={roleOptions}
                optionValue={(option) =>
                  (option as unknown as SelectOption).value
                }
                optionTextValue={(option) =>
                  (option as unknown as SelectOption).label
                }
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {
                      (props.item.rawValue as unknown as { label: string })
                        .label
                    }
                  </SelectItem>
                )}
              >
                <SelectLabel for="role-select">Role</SelectLabel>
                <SelectHiddenSelect id="role-select" />
                <SelectTrigger aria-label="Role">
                  <SelectValue<string>>
                    {(state) =>
                      (
                        (state?.selectedOption() || {}) as unknown as {
                          label: string;
                        }
                      ).label ?? "Select role"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
            <Button
              onClick={() => void saveProfile()}
              disabled={savingProfile()}
            >
              Save access
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Assign goal">
          <div class="grid gap-4">
            <div class="grid gap-2">
              <Select
                value={selectedGoalOption()}
                onChange={(value) =>
                  setGoalId((value as SelectOption | null)?.value ?? "")
                }
                options={goalOptions()}
                optionValue={(option) =>
                  (option as unknown as SelectOption).value
                }
                optionTextValue={(option) =>
                  (option as unknown as SelectOption).label
                }
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {
                      (props.item.rawValue as unknown as { label: string })
                        .label
                    }
                  </SelectItem>
                )}
              >
                <SelectLabel for="goal-select">Goal</SelectLabel>
                <SelectHiddenSelect id="goal-select" />
                <SelectTrigger aria-label="Goal">
                  <SelectValue<string>>
                    {(state) =>
                      (
                        (state?.selectedOption() || {}) as unknown as {
                          label: string;
                        }
                      ).label ?? "Select goal"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
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
        </SectionCard>

        <SectionCard title="Add steps from templates">
          <div class="grid gap-3 max-h-[420px] overflow-y-auto">
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
            <Button variant="outline" onClick={() => setSelectedTemplates([])}>
              Clear selection
            </Button>
          </div>
        </SectionCard>
      </div>
    </Page>
  );
}
