import { createEffect, createSignal, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import {
  type Category,
  type StepTemplate,
  createStepTemplate,
  deleteStepTemplate,
  listCategories,
  listStepTemplates,
  updateStepTemplate,
} from "../../lib/adminApi";

type StepTemplateForm = {
  id?: string;
  title: string;
  description: string;
  materialUrl: string;
  categoryId: string;
  tags: string;
  isActive: boolean;
};

export function AdminStepTemplates() {
  const [items, setItems] = createSignal<StepTemplate[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [form, setForm] = createSignal<StepTemplateForm>({
    title: "",
    description: "",
    materialUrl: "",
    categoryId: "",
    tags: "",
    isActive: true,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [templates, cats] = await Promise.all([
        listStepTemplates(),
        listCategories(),
      ]);
      setItems(templates.items);
      setCategories(cats.items);
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
    setForm({
      title: "",
      description: "",
      materialUrl: "",
      categoryId: "",
      tags: "",
      isActive: true,
    });
  };

  const selectItem = (item: StepTemplate) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description,
      materialUrl: item.materialUrl,
      categoryId: item.categoryId ?? "",
      tags: (item.tags ?? []).join(", "),
      isActive: item.isActive,
    });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = form();
      if (!payload.title || !payload.description || !payload.materialUrl) {
        throw new Error("Title, description, and material URL are required.");
      }
      const tags = payload.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);

      const data = {
        title: payload.title,
        description: payload.description,
        materialUrl: payload.materialUrl,
        categoryId: payload.categoryId || null,
        tags,
        isActive: payload.isActive,
      };

      if (payload.id) {
        await updateStepTemplate(payload.id, data);
      } else {
        await createStepTemplate(data);
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
    if (!confirm("Delete this step template?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteStepTemplate(id);
      await load();
      if (form().id === id) resetForm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section class="space-y-6">
      <div class="rounded-2xl border bg-card p-6">
        <h2 class="text-2xl font-semibold">Step Templates</h2>
        <p class="text-sm text-muted-foreground">
          Templates used to build student plans.
        </p>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div class="rounded-2xl border bg-card p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">All templates</h3>
            <Button variant="outline" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <Show
            when={!loading()}
            fallback={<div class="mt-4 text-sm">Loading…</div>}
          >
            <div class="mt-4 grid gap-3">
              {items().map((item) => (
                <div class="rounded-xl border p-4">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="text-xs text-muted-foreground">
                        {item.categoryId || "No category"}
                      </div>
                      <div class="text-base font-semibold">{item.title}</div>
                      <div class="text-sm text-muted-foreground">
                        {item.description}
                      </div>
                      <div class="mt-1 text-xs text-muted-foreground">
                        {item.isActive ? "Active" : "Inactive"}
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
        </div>

        <div class="rounded-2xl border bg-card p-6">
          <h3 class="text-lg font-semibold">
            {form().id ? "Edit" : "New"} template
          </h3>
          <div class="mt-4 grid gap-4">
            <TextField>
              <TextFieldLabel for="template-title">Title</TextFieldLabel>
              <TextFieldInput
                id="template-title"
                value={form().title}
                onInput={(e) =>
                  setForm({ ...form(), title: e.currentTarget.value })
                }
                placeholder="Learn basic cuts"
              />
            </TextField>
            <TextField>
              <TextFieldLabel for="template-description">
                Description
              </TextFieldLabel>
              <TextFieldInput
                id="template-description"
                value={form().description}
                onInput={(e) =>
                  setForm({ ...form(), description: e.currentTarget.value })
                }
                placeholder="Short instructions"
              />
            </TextField>
            <TextField>
              <TextFieldLabel for="template-material">
                Material URL
              </TextFieldLabel>
              <TextFieldInput
                id="template-material"
                value={form().materialUrl}
                onInput={(e) =>
                  setForm({ ...form(), materialUrl: e.currentTarget.value })
                }
                placeholder="https://example.com/lesson"
              />
            </TextField>
            <div class="grid gap-2">
              <label class="text-sm font-medium" for="template-category">
                Category
              </label>
              <select
                id="template-category"
                class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form().categoryId}
                onChange={(e) =>
                  setForm({ ...form(), categoryId: e.currentTarget.value })
                }
              >
                <option value="">No category</option>
                {categories().map((category) => (
                  <option value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <TextField>
              <TextFieldLabel for="template-tags">
                Tags (comma separated)
              </TextFieldLabel>
              <TextFieldInput
                id="template-tags"
                value={form().tags}
                onInput={(e) =>
                  setForm({ ...form(), tags: e.currentTarget.value })
                }
                placeholder="cuts, basics"
              />
            </TextField>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form().isActive}
                onChange={(e) =>
                  setForm({ ...form(), isActive: e.currentTarget.checked })
                }
              />
              Active
            </label>
            <div class="flex flex-wrap gap-2">
              <Button onClick={() => void submit()} disabled={saving()}>
                {form().id ? "Save changes" : "Create template"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
