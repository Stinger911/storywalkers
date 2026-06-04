import { A } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  Show,
} from "solid-js";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
import { DestructiveConfirmDialog } from "../../components/ui/destructive-confirm-dialog";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  type AdminCourse,
  type Goal,
  type GoalIntakeQuestion,
  createGoal,
  deleteGoal,
  listGoals,
  listAdminCourses,
  updateGoal,
} from "../../lib/adminApi";

type GoalForm = {
  id?: string;
  title: string;
  description: string;
  intakeQuestions: GoalIntakeQuestion[];
};

function newQuestion(order: number): GoalIntakeQuestion {
  return {
    id: `question_${Date.now()}_${order}`,
    label: "",
    type: "text",
    options: [],
    required: false,
    order,
    isActive: true,
  };
}

function normalizeQuestions(questions: GoalIntakeQuestion[]) {
  return questions.map((question, index) => ({
    ...question,
    id: question.id.trim(),
    label: question.label.trim(),
    options: (question.options ?? [])
      .map((item) => item.trim())
      .filter(Boolean),
    order: index,
  }));
}

export function AdminGoals() {
  let questionsEndRef: HTMLDivElement | undefined;

  const [items, setItems] = createSignal<Goal[]>([]);
  const [courses, setCourses] = createSignal<AdminCourse[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [deleteTarget, setDeleteTarget] = createSignal<Goal | null>(null);
  const [form, setForm] = createSignal<GoalForm>({
    title: "",
    description: "",
    intakeQuestions: [],
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [goalsData, coursesData] = await Promise.all([
        listGoals(),
        listAdminCourses({ limit: 200 }),
      ]);
      setItems(goalsData.items);
      setCourses(coursesData.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  const resetForm = () => {
    setForm({ title: "", description: "", intakeQuestions: [] });
  };

  const selectItem = (item: Goal) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      intakeQuestions: [...(item.intakeQuestions ?? [])].sort(
        (a, b) => a.order - b.order,
      ),
    });
  };

  const linkedCourses = createMemo(() => {
    const goalId = form().id;
    if (!goalId) return [];
    return courses().filter((course) => course.goalIds.includes(goalId));
  });

  const updateQuestion = (
    index: number,
    patch: Partial<GoalIntakeQuestion>,
  ) => {
    setForm((current) => ({
      ...current,
      intakeQuestions: current.intakeQuestions.map((question, itemIndex) =>
        itemIndex === index ? { ...question, ...patch } : question,
      ),
    }));
  };

  const addQuestion = () => {
    setForm((current) => ({
      ...current,
      intakeQuestions: [
        ...current.intakeQuestions,
        newQuestion(current.intakeQuestions.length),
      ],
    }));
  };

  const removeQuestion = (index: number) => {
    setForm((current) => ({
      ...current,
      intakeQuestions: current.intakeQuestions.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = form();
      if (!payload.title.trim()) {
        throw new Error("Title is required.");
      }
      const intakeQuestions = normalizeQuestions(payload.intakeQuestions);
      const invalidQuestion = intakeQuestions.find(
        (question) => !question.id || !question.label,
      );
      if (invalidQuestion) {
        throw new Error("Every intake question needs an id and label.");
      }
      if (payload.id) {
        const currentId = payload.id;
        await updateGoal(currentId, {
          title: payload.title.trim(),
          description: payload.description.trim() || null,
          intakeQuestions,
        });
        await load();
        const updated = items().find((g) => g.id === currentId);
        if (updated) {
          selectItem(updated);
          if (updated.intakeQuestions && updated.intakeQuestions.length > 0) {
            queueMicrotask(() =>
              questionsEndRef?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              }),
            );
          }
        }
      } else {
        await createGoal({
          title: payload.title.trim(),
          description: payload.description.trim() || null,
          intakeQuestions,
        });
        resetForm();
        await load();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const item = deleteTarget();
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      await deleteGoal(item.id);
      await load();
      if (form().id === item.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Goals"
      subtitle="Create and manage learning goals for students."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Goals</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <Show when={error()}>
        <div class="admin-callout admin-callout--error text-sm">{error()}</div>
      </Show>

      <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <SectionCard
          title="All goals"
          actions={
            <Button variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          }
        >
          <Show
            when={!loading()}
            fallback={
              <div class="mt-4 space-y-2">
                <Skeleton
                  class="h-12 w-full rounded-[var(--radius-md)]"
                  animate
                />
                <Skeleton
                  class="h-12 w-full rounded-[var(--radius-md)]"
                  animate
                />
                <Skeleton
                  class="h-12 w-full rounded-[var(--radius-md)]"
                  animate
                />
              </div>
            }
          >
            <Show
              when={items().length > 0}
              fallback={
                <div class="py-8 text-center text-sm text-muted-foreground">
                  No goals have been created yet.
                </div>
              }
            >
              <div class="mt-4 grid gap-3">
                <For each={items()}>
                  {(item) => (
                    <div
                      class="cursor-pointer rounded-xl border p-4 transition-colors hover:bg-muted/30"
                      onClick={() => selectItem(item)}
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div>
                          <div class="text-base font-semibold">
                            {item.title}
                          </div>
                          <div class="text-sm text-muted-foreground">
                            {item.description || "No description yet"}
                          </div>
                          <div class="mt-1 text-xs text-muted-foreground">
                            {(item.intakeQuestions ?? []).length} intake
                            questions
                          </div>
                        </div>
                        <div class="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectItem(item);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(item);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </SectionCard>

        <div class="grid gap-6">
          <SectionCard title={`${form().id ? "Edit" : "New"} goal`}>
            <div class="mt-4 grid gap-4">
              <TextField>
                <TextFieldLabel for="goal-title">Title</TextFieldLabel>
                <TextFieldInput
                  id="goal-title"
                  value={form().title}
                  onInput={(e) =>
                    setForm({ ...form(), title: e.currentTarget.value })
                  }
                  placeholder="Become a video editor"
                />
              </TextField>
              <TextField>
                <TextFieldLabel for="goal-description">
                  Description
                </TextFieldLabel>
                <TextFieldTextArea
                  id="goal-description"
                  rows={4}
                  value={form().description}
                  onInput={(e) =>
                    setForm({ ...form(), description: e.currentTarget.value })
                  }
                  placeholder="Add a short description"
                />
              </TextField>

              <div class="grid gap-3 rounded-xl border border-border/70 p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold">
                      Goal intake questions
                    </div>
                    <div class="text-xs text-muted-foreground">
                      These questions appear after a student selects this goal.
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    Add question
                  </Button>
                </div>
                <Show
                  when={form().intakeQuestions.length > 0}
                  fallback={
                    <div class="text-sm text-muted-foreground">
                      No questions yet.
                    </div>
                  }
                >
                  <div class="grid gap-3">
                    <Index each={form().intakeQuestions}>
                      {(question, index) => (
                        <div class="grid gap-3 rounded-xl border border-border/70 bg-card p-3">
                          <TextField>
                            <TextFieldLabel
                              for={`goal-question-label-${index}`}
                            >
                              <span class="flex items-center gap-1.5">
                                Label
                                <span
                                  title={`Question ID: ${question().id}`}
                                  class="cursor-help text-muted-foreground"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                  >
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="M12 16v-4" />
                                    <path d="M12 8h.01" />
                                  </svg>
                                </span>
                              </span>
                            </TextFieldLabel>
                            <TextFieldInput
                              id={`goal-question-label-${index}`}
                              value={question().label}
                              onInput={(e) =>
                                updateQuestion(index, {
                                  label: e.currentTarget.value,
                                })
                              }
                              placeholder="Enter question label"
                            />
                          </TextField>
                          <label class="grid gap-2 text-sm">
                            <span class="font-medium">Type</span>
                            <select
                              class="rounded-md border border-border bg-background px-3 py-2"
                              value={question().type}
                              onChange={(e) =>
                                updateQuestion(index, {
                                  type: e.currentTarget
                                    .value as GoalIntakeQuestion["type"],
                                })
                              }
                            >
                              <option value="text">text</option>
                              <option value="multi_select">multi_select</option>
                            </select>
                          </label>
                          <TextField>
                            <TextFieldLabel
                              for={`goal-question-options-${index}`}
                            >
                              Options
                            </TextFieldLabel>
                            <TextFieldInput
                              id={`goal-question-options-${index}`}
                              value={(question().options ?? []).join(", ")}
                              onInput={(e) =>
                                updateQuestion(index, {
                                  options: e.currentTarget.value
                                    .split(/[\n,]/)
                                    .map((item) => item.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="Only for multi_select, comma-separated"
                            />
                          </TextField>
                          <div class="flex flex-wrap items-center gap-4 text-sm">
                            <label class="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={question().required}
                                onChange={(e) =>
                                  updateQuestion(index, {
                                    required: e.currentTarget.checked,
                                  })
                                }
                              />
                              <span>Required</span>
                            </label>
                            <label class="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={question().isActive}
                                onChange={(e) =>
                                  updateQuestion(index, {
                                    isActive: e.currentTarget.checked,
                                  })
                                }
                              />
                              <span>Active</span>
                            </label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeQuestion(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </Index>
                    <div ref={questionsEndRef} />
                  </div>
                </Show>
              </div>

              <div class="flex flex-wrap justify-between gap-2">
                <div>
                  <Button onClick={() => void submit()} disabled={saving()}>
                    {form().id ? "Save changes" : "Create goal"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    Reset
                  </Button>
                </div>
                <Show when={form().intakeQuestions.length > 0}>
                  <Button
                    variant="outline"
                    onClick={addQuestion}
                    disabled={saving()}
                  >
                    Add question
                  </Button>
                </Show>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Linked Courses"
            description="Courses linked to this goal. Open the course editor to update them."
            actions={
              <Button as={A} href="/admin/courses" variant="outline">
                Open courses
              </Button>
            }
          >
            <Show
              when={form().id}
              fallback={
                <div class="text-sm text-muted-foreground">
                  Select a goal to view linked courses.
                </div>
              }
            >
              <Show
                when={linkedCourses().length > 0}
                fallback={
                  <div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No courses are linked to this goal yet.
                  </div>
                }
              >
                <div class="mt-4 grid gap-3">
                  <For each={linkedCourses()}>
                    {(course) => (
                      <div class="rounded-xl border border-border/70 bg-card p-4">
                        <div class="flex items-start justify-between gap-4">
                          <div>
                            <div class="text-base font-semibold">
                              {course.title}
                            </div>
                            <div class="text-sm text-muted-foreground">
                              {course.description || "No description yet"}
                            </div>
                          </div>
                          <div class="flex gap-2">
                            <Button
                              as={A}
                              href={`/admin/courses?edit=${encodeURIComponent(course.id)}`}
                              variant="outline"
                              size="sm"
                            >
                              Edit course
                            </Button>
                            <Button
                              as={A}
                              href={`/admin/courses/${course.id}/lessons?title=${encodeURIComponent(course.title)}`}
                              variant="outline"
                              size="sm"
                            >
                              Lessons
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </SectionCard>
        </div>
      </div>

      <DestructiveConfirmDialog
        open={deleteTarget() !== null}
        onOpenChange={(open) => {
          if (!saving() && !open) setDeleteTarget(null);
        }}
        title="Delete goal?"
        description={`This removes "${deleteTarget()?.title || "this goal"}" from active admin use. Existing student plans keep their stored goal reference.`}
        acknowledgeLabel="I understand this action affects future goal selection."
        confirmKeyword="DELETE"
        confirmLabel="Confirm delete"
        loading={saving()}
        onConfirm={remove}
        testIdPrefix="delete-goal"
      />
    </Page>
  );
}
