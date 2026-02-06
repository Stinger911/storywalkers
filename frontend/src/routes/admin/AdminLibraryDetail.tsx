import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
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
import { listCategories, type Category } from "../../lib/adminApi";
import {
  createLibraryEntry,
  getLibraryEntry,
  updateLibraryEntry,
  type LibraryEntry,
} from "../../lib/libraryApi";

type LibraryForm = {
  categoryId: string;
  title: string;
  content: string;
  videoUrl: string;
  status: "draft" | "published";
  keywords: string;
};

export function AdminLibraryDetail() {
  const params = useParams();
  const [, setEntry] = createSignal<LibraryEntry | null>(null);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);
  const [form, setForm] = createSignal<LibraryForm>({
    categoryId: "",
    title: "",
    content: "",
    videoUrl: "",
    status: "draft",
    keywords: "",
  });

  const isNew = createMemo(() => params.id === "new");

  const load = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const categoriesData = await listCategories();
      setCategories(categoriesData.items);
      if (!params.id) {
        throw new Error("No library entry ID provided.");
      }
      if (params.id === "new") {
        setEntry(null);
        setForm({
          categoryId: "",
          title: "",
          content: "",
          videoUrl: "",
          status: "draft",
          keywords: "",
        });
      } else {
        const entryData = await getLibraryEntry(params.id);
        setEntry(entryData);
        setForm({
          categoryId: entryData.categoryId ?? "",
          title: entryData.title ?? "",
          content: entryData.content ?? "",
          videoUrl: entryData.videoUrl ?? "",
          status: entryData.status === "published" ? "published" : "draft",
          keywords: (entryData.keywords || []).join(", "),
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    void load();
  });

  const submit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = form();
      if (!payload.title.trim()) {
        throw new Error("Title is required.");
      }
      if (!payload.categoryId.trim()) {
        throw new Error("Category is required.");
      }
      if (!payload.content.trim()) {
        throw new Error("Content is required.");
      }
      const keywords = payload.keywords
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      if (isNew()) {
        const created = await createLibraryEntry({
          categoryId: payload.categoryId.trim(),
          title: payload.title.trim(),
          content: payload.content.trim(),
          videoUrl: payload.videoUrl.trim() || undefined,
          status: payload.status,
          keywords,
        });
        setSuccess(`Library entry ${created.id} created.`);
        window.history.replaceState({}, "", `/admin/library/${created.id}`);
        await load();
      } else if (params.id) {
        const response = await updateLibraryEntry(params.id, {
          categoryId: payload.categoryId.trim(),
          title: payload.title.trim(),
          content: payload.content.trim(),
          videoUrl: payload.videoUrl.trim() || undefined,
          status: payload.status,
          keywords,
        });
        setSuccess(`Library entry ${response.id} updated.`);
        await load();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      title={isNew() ? "New library entry" : "Edit library entry"}
      subtitle="Draft, edit, and publish guidance for students."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/library">Library</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>{isNew() ? "New" : "Edit"}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <A href="/admin/library" class="text-sm text-primary underline">
          Back to library
        </A>
      }
    >

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>
      <Show when={success()}>
        <div class="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
          {success()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
        <SectionCard title="Entry details">
          <div class="grid gap-4">
            <TextField>
              <TextFieldLabel for="library-title">Title</TextFieldLabel>
              <TextFieldInput
                id="library-title"
                value={form().title}
                onInput={(e) =>
                  setForm({ ...form(), title: e.currentTarget.value })
                }
                placeholder="Lighting tips for interviews"
              />
            </TextField>
            <div class="grid gap-2">
              <label class="text-sm font-medium" for="library-category">
                Category
              </label>
              <select
                id="library-category"
                class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form().categoryId}
                onChange={(e) =>
                  setForm({ ...form(), categoryId: e.currentTarget.value })
                }
              >
                <option value="">Select category</option>
                {categories().map((category) => (
                  <option value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <TextField>
              <TextFieldLabel for="library-content">Content</TextFieldLabel>
              <TextFieldTextArea
                id="library-content"
                value={form().content}
                onInput={(e) =>
                  setForm({ ...form(), content: e.currentTarget.value })
                }
                placeholder="Steps, guidance, or summary"
              />
            </TextField>
            <TextField>
              <TextFieldLabel for="library-video">Video URL</TextFieldLabel>
              <TextFieldInput
                id="library-video"
                value={form().videoUrl}
                onInput={(e) =>
                  setForm({ ...form(), videoUrl: e.currentTarget.value })
                }
                placeholder="Optional video link"
              />
            </TextField>
            <TextField>
              <TextFieldLabel for="library-keywords">
                Keywords (comma-separated)
              </TextFieldLabel>
              <TextFieldInput
                id="library-keywords"
                value={form().keywords}
                onInput={(e) =>
                  setForm({ ...form(), keywords: e.currentTarget.value })
                }
                placeholder="lighting, interview, setup"
              />
            </TextField>
            <div class="grid gap-2">
              <label class="text-sm font-medium" for="library-status">
                Status
              </label>
              <select
                id="library-status"
                class="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form().status}
                onChange={(e) =>
                  setForm({
                    ...form(),
                    status: e.currentTarget.value as "draft" | "published",
                  })
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div class="flex gap-2">
              <Button onClick={() => void submit()} disabled={saving()}>
                {saving() ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={() => void load()}
                disabled={saving()}
              >
                Reset
              </Button>
            </div>
          </div>
        </SectionCard>
      </Show>
    </Page>
  );
}
