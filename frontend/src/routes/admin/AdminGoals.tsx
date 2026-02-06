import { createEffect, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
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
  type Goal,
  createGoal,
  deleteGoal,
  listGoals,
  listGoalTemplateSteps,
  listStepTemplates,
  replaceGoalTemplateSteps,
  type StepTemplate,
  updateGoal,
} from "../../lib/adminApi";

type GoalForm = {
  id?: string;
  title: string;
  description: string;
};

type TemplateStepDraft = {
  tempId: string;
  id?: string;
  title: string;
  description: string;
  materialUrl: string;
  order: number;
};

export function AdminGoals() {
  const [items, setItems] = createSignal<Goal[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [form, setForm] = createSignal<GoalForm>({
    title: "",
    description: "",
  });
  const [templateSteps, setTemplateSteps] = createStore<TemplateStepDraft[]>([]);
  const [templateLoading, setTemplateLoading] = createSignal(false);
  const [templateSaving, setTemplateSaving] = createSignal(false);
  const [templateError, setTemplateError] = createSignal<string | null>(null);
  const [templateNotice, setTemplateNotice] = createSignal<string | null>(null);
  const [stepTemplates, setStepTemplates] = createSignal<StepTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = createSignal("");
  const [templatesError, setTemplatesError] = createSignal<string | null>(null);
  let tempIdCounter = 0;
  const nextTempId = () => `tmpl_${tempIdCounter++}`;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGoals();
      setItems(data.items);
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
    void loadStepTemplates();
  });

  createEffect(() => {
    const goalId = form().id;
    if (!goalId) {
      setTemplateSteps([]);
      setTemplateError(null);
      setTemplateNotice(null);
      return;
    }
    void loadTemplateSteps(goalId);
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

  const loadTemplateSteps = async (goalId: string) => {
    setTemplateLoading(true);
    setTemplateError(null);
    setTemplateNotice(null);
    try {
      const data = await listGoalTemplateSteps(goalId);
      const sorted = [...data.items].sort((a, b) => a.order - b.order);
      setTemplateSteps(
        sorted.map((step, index) => ({
          tempId: step.id ?? nextTempId(),
          id: step.id,
          title: step.title,
          description: step.description,
          materialUrl: step.materialUrl,
          order: index,
        })),
      );
    } catch (err) {
      setTemplateError((err as Error).message);
    } finally {
      setTemplateLoading(false);
    }
  };

  const loadStepTemplates = async () => {
    setTemplatesError(null);
    try {
      const data = await listStepTemplates();
      setStepTemplates(data.items);
    } catch (err) {
      setTemplatesError((err as Error).message);
    }
  };

  const updateTemplateStep = (index: number, updates: Partial<TemplateStepDraft>) => {
    setTemplateSteps(index, updates);
  };

  const removeTemplateStep = (index: number) => {
    const next = templateSteps.slice();
    next.splice(index, 1);
    setTemplateSteps(
      next.map((step, order) => ({ ...step, order })),
    );
  };

  const addTemplateStep = () => {
    setTemplateSteps([
      ...templateSteps,
      {
        tempId: nextTempId(),
        title: "",
        description: "",
        materialUrl: "",
        order: templateSteps.length,
      },
    ]);
  };

  const addFromTemplate = () => {
    const template = stepTemplates().find(
      (item) => item.id === selectedTemplateId(),
    );
    if (!template) {
      setTemplateError("Select a template step first.");
      return;
    }
    setTemplateSteps([
      ...templateSteps,
      {
        tempId: nextTempId(),
        title: template.title,
        description: template.description,
        materialUrl: template.materialUrl,
        order: templateSteps.length,
      },
    ]);
    setSelectedTemplateId("");
  };

  const moveTemplateStep = (index: number, direction: -1 | 1) => {
    const next = templateSteps.slice();
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setTemplateSteps(next.map((step, order) => ({ ...step, order })));
  };

  const validateTemplateSteps = (steps: TemplateStepDraft[]) => {
    for (const [index, step] of steps.entries()) {
      if (!step.title.trim()) {
        return `Step ${index + 1}: title is required.`;
      }
      if (!step.materialUrl.trim()) {
        return `Step ${index + 1}: material URL is required.`;
      }
      try {
        const parsed = new URL(step.materialUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return `Step ${index + 1}: material URL must be http(s).`;
        }
      } catch {
        return `Step ${index + 1}: material URL is invalid.`;
      }
    }
    return null;
  };

  const saveTemplateSteps = async () => {
    const goalId = form().id;
    if (!goalId) {
      setTemplateError("Select a goal first.");
      return;
    }
    const current = templateSteps;
    const validation = validateTemplateSteps(current);
    if (validation) {
      setTemplateError(validation);
      return;
    }
    setTemplateSaving(true);
    setTemplateError(null);
    setTemplateNotice(null);
    try {
      const normalized = current.map((step, order) => ({
        id: step.id,
        title: step.title.trim(),
        description: step.description.trim(),
        materialUrl: step.materialUrl.trim(),
        order,
      }));
      const result = await replaceGoalTemplateSteps(goalId, { items: normalized });
      setTemplateSteps(
        result.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step, order) => ({
            tempId: step.id ?? nextTempId(),
            id: step.id,
            title: step.title,
            description: step.description,
            materialUrl: step.materialUrl,
            order,
          })),
      );
      setTemplateNotice("Template path saved.");
    } catch (err) {
      setTemplateError((err as Error).message);
    } finally {
      setTemplateSaving(false);
    }
  };

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
                <div class="rounded-xl border p-4">
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
                        onClick={() => selectItem(item)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void remove(item.id)}
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
                <TextFieldInput
                  id="goal-description"
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
            title="Template Path"
            description="Define the default learning steps for this goal."
            actions={
              <div class="flex gap-2">
                <Button variant="outline" onClick={addTemplateStep}>
                  Add step
                </Button>
                <Button onClick={() => void saveTemplateSteps()} disabled={templateSaving()}>
                  Save path
                </Button>
              </div>
            }
          >
            <Show when={form().id} fallback={<div class="text-sm text-muted-foreground">Select a goal to edit its template path.</div>}>
              <Show when={templatesError()}>
                <div class="rounded-xl border border-error bg-error/10 p-3 text-sm text-error-foreground">
                  {templatesError()}
                </div>
              </Show>
              <Show when={templateError()}>
                <div class="rounded-xl border border-error bg-error/10 p-3 text-sm text-error-foreground">
                  {templateError()}
                </div>
              </Show>
              <Show when={templateNotice()}>
                <div class="rounded-xl border border-success-foreground/30 bg-success/10 p-3 text-sm text-success-foreground">
                  {templateNotice()}
                </div>
              </Show>
              <div class="mt-4 grid gap-3 rounded-xl border border-border/70 bg-card p-4">
                <div class="text-sm font-semibold">Add from template</div>
                <div class="flex flex-wrap items-end gap-3">
                  <div class="grid gap-2 min-w-[240px] flex-1">
                    <label class="text-sm font-medium" for="goal-template-select">
                      Template step
                    </label>
                    <select
                      id="goal-template-select"
                      class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedTemplateId()}
                      onChange={(e) => setSelectedTemplateId(e.currentTarget.value)}
                    >
                      <option value="">Select a template</option>
                      {stepTemplates().map((item) => (
                        <option value={item.id}>{item.title}</option>
                      ))}
                    </select>
                  </div>
                  <Button variant="outline" onClick={addFromTemplate}>
                    Add from template
                  </Button>
                </div>
              </div>
              <Show
                when={!templateLoading()}
                fallback={<div class="mt-3 text-sm">Loading…</div>}
              >
                <div class="mt-4 grid gap-4">
                  <Show
                    when={templateSteps.length > 0}
                    fallback={
                      <div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        No template steps yet. Add the first step to get started.
                      </div>
                    }
                  >
                    <For each={templateSteps}>
                      {(step, index) => (
                        <div class="rounded-xl border border-border/70 bg-card p-4 shadow-rail">
                          <div class="flex items-center justify-between gap-2">
                            <div class="text-sm font-semibold">
                              Step {index() + 1}
                            </div>
                            <div class="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => moveTemplateStep(index(), -1)}
                                disabled={index() === 0}
                              >
                                Up
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => moveTemplateStep(index(), 1)}
                                disabled={index() === templateSteps.length - 1}
                              >
                                Down
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeTemplateStep(index())}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                          <div class="mt-4 grid gap-3">
                            <TextField>
                              <TextFieldLabel for={`goal-step-title-${step.tempId}`}>
                                Title
                              </TextFieldLabel>
                              <TextFieldInput
                                id={`goal-step-title-${step.tempId}`}
                                value={step.title}
                                onInput={(e) =>
                                  updateTemplateStep(index(), {
                                    title: e.currentTarget.value,
                                  })
                                }
                                placeholder="Learn basic cuts"
                              />
                            </TextField>
                            <TextField>
                              <TextFieldLabel for={`goal-step-description-${step.tempId}`}>
                                Description
                              </TextFieldLabel>
                              <TextFieldTextArea
                                id={`goal-step-description-${step.tempId}`}
                                value={step.description}
                                onInput={(e) =>
                                  updateTemplateStep(index(), {
                                    description: e.currentTarget.value,
                                  })
                                }
                                placeholder="Explain what the student should do."
                              />
                            </TextField>
                            <TextField>
                              <TextFieldLabel for={`goal-step-url-${step.tempId}`}>
                                Material URL
                              </TextFieldLabel>
                              <TextFieldInput
                                id={`goal-step-url-${step.tempId}`}
                                value={step.materialUrl}
                                onInput={(e) =>
                                  updateTemplateStep(index(), {
                                    materialUrl: e.currentTarget.value,
                                  })
                                }
                                placeholder="https://example.com/lesson"
                              />
                            </TextField>
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            </Show>
          </SectionCard>
        </div>
      </div>
    </Page>
  );
}
