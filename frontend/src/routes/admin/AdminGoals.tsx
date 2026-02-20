import { A } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
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
};

export function AdminGoals() {
  const [items, setItems] = createSignal<Goal[]>([]);
  const [courses, setCourses] = createSignal<AdminCourse[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [form, setForm] = createSignal<GoalForm>({
    title: "",
    description: "",
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
    setForm({ title: "", description: "" });
  };

  const selectItem = (item: Goal) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
    });
  };

  const linkedCourses = createMemo(() => {
    const goalId = form().id;
    if (!goalId) return [];
    return courses().filter((course) => course.goalIds.includes(goalId));
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = form();
      if (!payload.title) {
        throw new Error("Title is required.");
      }
      if (payload.id) {
        await updateGoal(payload.id, {
          title: payload.title,
          description: payload.description,
        });
      } else {
        await createGoal({
          title: payload.title,
          description: payload.description,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this goal?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteGoal(id);
      await load();
      if (form().id === id) resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Goals"
      subtitle="Define learning goals assigned to students."
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
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
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
            fallback={<div class="mt-4 text-sm">Loading…</div>}
          >
            <div class="mt-4 grid gap-3">
              {items().map((item) => (
                <div
                  class="cursor-pointer rounded-xl border p-4 transition-colors hover:bg-muted/30"
                  onClick={() => selectItem(item)}
                >
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-base font-semibold">{item.title}</div>
                      <div class="text-sm text-muted-foreground">
                        {item.description || "No description"}
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
                          void remove(item.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                  placeholder="Short description"
                />
              </TextField>
              <div class="flex flex-wrap gap-2">
                <Button onClick={() => void submit()} disabled={saving()}>
                  {form().id ? "Save changes" : "Create goal"}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Clear
                </Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Linked Courses"
            description="Courses linked to this goal. Open course editor to update details."
            actions={
              <Button as={A} href="/admin/courses" variant="outline">
                Open courses
              </Button>
            }
          >
            <Show
              when={form().id}
              fallback={<div class="text-sm text-muted-foreground">Select a goal to view linked courses.</div>}
            >
              <Show
                when={linkedCourses().length > 0}
                fallback={
                  <div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No courses linked to this goal yet.
                  </div>
                }
              >
                <div class="mt-4 grid gap-3">
                  {linkedCourses().map((course) => (
                    <div class="rounded-xl border border-border/70 bg-card p-4">
                      <div class="flex items-start justify-between gap-4">
                        <div>
                          <div class="text-base font-semibold">{course.title}</div>
                          <div class="text-sm text-muted-foreground">
                            {course.description || "No description"}
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
                  ))}
                </div>
              </Show>
            </Show>
          </SectionCard>
        </div>
      </div>
    </Page>
  );
}
