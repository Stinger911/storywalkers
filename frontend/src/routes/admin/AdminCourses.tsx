import { createSignal, For, onMount, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
  TextFieldTextArea,
} from "../../components/ui/text-field";
import { Badge } from "../../components/ui/badge";
import { showToast } from "../../components/ui/toast";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  createAdminCourse,
  deleteAdminCourse,
  listAdminCourses,
  listGoals,
  patchAdminCourse,
  type AdminCourse,
  type Goal,
} from "../../lib/adminApi";

type CourseForm = {
  id?: string;
  title: string;
  description: string;
  priceUsd: string;
  goalIds: string[];
  isActive: boolean;
};

function centsToDollars(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2);
}

function dollarsToCents(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Price must be a non-negative number.");
  }
  return Math.round(numeric * 100);
}

export function AdminCourses() {
  const [items, setItems] = createSignal<AdminCourse[]>([]);
  const [goals, setGoals] = createSignal<Goal[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [form, setForm] = createSignal<CourseForm>({
    title: "",
    description: "",
    priceUsd: "0.00",
    goalIds: [],
    isActive: true,
  });

  const loadGoals = async () => {
    const data = await listGoals();
    setGoals(data.items);
  };

  const loadCourses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminCourses({ q: query() || undefined, limit: 200 });
      setItems(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadGoals(), loadCourses()]);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      }
    })();
  });

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      priceUsd: "0.00",
      goalIds: [],
      isActive: true,
    });
  };

  const selectItem = (item: AdminCourse) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? "",
      priceUsd: centsToDollars(item.priceUsdCents),
      goalIds: item.goalIds,
      isActive: item.isActive,
    });
  };

  const toggleGoal = (goalId: string) => {
    setForm((prev) => ({
      ...prev,
      goalIds: prev.goalIds.includes(goalId)
        ? prev.goalIds.filter((id) => id !== goalId)
        : [...prev.goalIds, goalId],
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
      if (payload.goalIds.length === 0) {
        throw new Error("Select at least one goal.");
      }
      const priceUsdCents = dollarsToCents(payload.priceUsd);
      if (payload.id) {
        await patchAdminCourse(payload.id, {
          title: payload.title.trim(),
          description: payload.description.trim() || null,
          goalIds: payload.goalIds,
          priceUsdCents,
          isActive: payload.isActive,
        });
        showToast({ title: "Course updated", variant: "success" });
      } else {
        await createAdminCourse({
          title: payload.title.trim(),
          description: payload.description.trim() || null,
          goalIds: payload.goalIds,
          priceUsdCents,
          isActive: payload.isActive,
        });
        showToast({ title: "Course created", variant: "success" });
      }
      resetForm();
      await loadCourses();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to save course", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: AdminCourse) => {
    if (!confirm(`Deactivate course "${item.title}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAdminCourse(item.id);
      showToast({ title: "Course deactivated", variant: "success" });
      await loadCourses();
      if (form().id === item.id) {
        resetForm();
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to deactivate course", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: AdminCourse) => {
    setSaving(true);
    setError(null);
    try {
      await patchAdminCourse(item.id, { isActive: !item.isActive });
      showToast({
        title: !item.isActive ? "Course activated" : "Course deactivated",
        variant: "success",
      });
      await loadCourses();
      if (form().id === item.id) {
        setForm((prev) => ({ ...prev, isActive: !item.isActive }));
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      showToast({ title: "Failed to update status", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title="Courses"
      subtitle="Manage paid courses used in onboarding."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Courses</BreadcrumbLink>
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
          title="All courses"
          actions={
            <div class="flex items-center gap-2">
              <TextField>
                <TextFieldInput
                  value={query()}
                  onInput={(e) => setQuery(e.currentTarget.value)}
                  placeholder="Search by title or description"
                />
              </TextField>
              <Button variant="outline" onClick={() => void loadCourses()}>
                Search
              </Button>
              <Button variant="outline" onClick={() => void loadCourses()}>
                Refresh
              </Button>
            </div>
          }
        >
          <Show when={!loading()} fallback={<div class="mt-4 text-sm">Loading…</div>}>
            <Show
              when={items().length > 0}
              fallback={
                <div class="mt-4 rounded-xl border border-border/70 p-4 text-sm text-muted-foreground">
                  No courses yet.
                </div>
              }
            >
              <div class="mt-4 grid gap-3">
                <For each={items()}>
                  {(item) => (
                    <div class="rounded-xl border p-4">
                      <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2">
                            <div class="text-base font-semibold">{item.title}</div>
                            <Badge variant={item.isActive ? "success" : "warning"}>
                              {item.isActive ? "active" : "inactive"}
                            </Badge>
                          </div>
                          <div class="text-sm text-muted-foreground">
                            {item.description || "No description"}
                          </div>
                          <div class="mt-1 text-xs text-muted-foreground">
                            ${centsToDollars(item.priceUsdCents)} · goals:{" "}
                            {item.goalIds.length ? item.goalIds.join(", ") : "none"}
                          </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <Button
                            as={A}
                            href={`/admin/courses/${item.id}/lessons`}
                            variant="outline"
                            size="sm"
                          >
                            Lessons
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => selectItem(item)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void toggleActive(item)}
                            disabled={saving()}
                          >
                            {item.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void remove(item)}
                            disabled={saving() || !item.isActive}
                          >
                            Soft delete
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

        <SectionCard title={`${form().id ? "Edit" : "New"} course`}>
          <div class="mt-4 grid gap-4">
            <TextField>
              <TextFieldLabel for="course-title">Title</TextFieldLabel>
              <TextFieldInput
                id="course-title"
                value={form().title}
                onInput={(e) => setForm({ ...form(), title: e.currentTarget.value })}
                placeholder="Course title"
              />
            </TextField>

            <TextField>
              <TextFieldLabel for="course-description">Description</TextFieldLabel>
              <TextFieldTextArea
                id="course-description"
                rows={4}
                value={form().description}
                onInput={(e) =>
                  setForm({ ...form(), description: e.currentTarget.value })
                }
                placeholder="Course description"
              />
            </TextField>

            <TextField>
              <TextFieldLabel for="course-price-usd">
                Price (USD, dollars)
              </TextFieldLabel>
              <TextFieldInput
                id="course-price-usd"
                type="number"
                min="0"
                step="0.01"
                value={form().priceUsd}
                onInput={(e) => setForm({ ...form(), priceUsd: e.currentTarget.value })}
              />
            </TextField>

            <div class="grid gap-2">
              <div class="text-sm font-medium">Goals</div>
              <Show
                when={goals().length > 0}
                fallback={
                  <div class="rounded-md border border-border/70 p-3 text-sm text-muted-foreground">
                    No goals available.
                  </div>
                }
              >
                <div class="max-h-48 space-y-2 overflow-auto rounded-md border border-border/70 p-3">
                  <For each={goals()}>
                    {(goal) => (
                      <label class="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form().goalIds.includes(goal.id)}
                          onChange={() => toggleGoal(goal.id)}
                        />
                        <span>{goal.title}</span>
                      </label>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form().isActive}
                onChange={(e) =>
                  setForm({ ...form(), isActive: e.currentTarget.checked })
                }
              />
              <span>Active</span>
            </label>

            <div class="flex flex-wrap gap-2">
              <Button onClick={() => void submit()} disabled={saving()}>
                {form().id ? "Save changes" : "Create course"}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={saving()}>
                Clear
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </Page>
  );
}
