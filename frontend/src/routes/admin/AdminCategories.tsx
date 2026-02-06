import { createEffect, createSignal, Show } from "solid-js";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import {
  type Category,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../lib/adminApi";

const categoryTypes = ["questions", "library", "mixed"] as const;

type CategoryForm = {
  id?: string;
  name: string;
  slug: string;
  type: string;
};

export function AdminCategories() {
  const [items, setItems] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [form, setForm] = createSignal<CategoryForm>({
    name: "",
    slug: "",
    type: "mixed",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCategories();
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

  const resetForm = () => {
    setForm({ name: "", slug: "", type: "mixed" });
  };

  const selectItem = (item: Category) => {
    setForm({ id: item.id, name: item.name, slug: item.slug, type: item.type });
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = form();
      if (!payload.name || !payload.slug) {
        throw new Error("Name and slug are required.");
      }
      if (payload.id) {
        await updateCategory(payload.id, {
          name: payload.name,
          slug: payload.slug,
          type: payload.type,
        });
      } else {
        await createCategory({
          name: payload.name,
          slug: payload.slug,
          type: payload.type,
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
    if (!confirm("Delete this category?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteCategory(id);
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
      title="Categories"
      subtitle="Create and edit content categories used in questions and library."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Categories</BreadcrumbLink>
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
          title="All categories"
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
                      <div class="text-sm text-muted-foreground">
                        {item.type}
                      </div>
                      <div class="text-base font-semibold">{item.name}</div>
                      <div class="text-xs text-muted-foreground">
                        {item.slug}
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

        <SectionCard title={`${form().id ? "Edit" : "New"} category`}>
          <div class="mt-4 grid gap-4">
            <TextField>
              <TextFieldLabel for="category-name">Name</TextFieldLabel>
              <TextFieldInput
                id="category-name"
                value={form().name}
                onInput={(e) =>
                  setForm({ ...form(), name: e.currentTarget.value })
                }
                placeholder="Editing"
              />
            </TextField>
            <TextField>
              <TextFieldLabel for="category-slug">Slug</TextFieldLabel>
              <TextFieldInput
                id="category-slug"
                value={form().slug}
                onInput={(e) =>
                  setForm({ ...form(), slug: e.currentTarget.value })
                }
                placeholder="editing"
              />
            </TextField>
            <div class="grid gap-2">
              <label class="text-sm font-medium" for="category-type">
                Type
              </label>
              <select
                id="category-type"
                class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form().type}
                onChange={(e) =>
                  setForm({ ...form(), type: e.currentTarget.value })
                }
              >
                {categoryTypes.map((type) => (
                  <option value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button onClick={() => void submit()} disabled={saving()}>
                {form().id ? "Save changes" : "Create category"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Clear
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    </Page>
  );
}
