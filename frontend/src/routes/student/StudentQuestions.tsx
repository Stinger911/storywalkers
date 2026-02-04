import { createEffect, createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { listCategories, type Category } from "../../lib/adminApi";
import {
  createQuestion,
  listMyQuestions,
  type Question,
} from "../../lib/questionsApi";

export function StudentQuestions() {
  const [items, setItems] = createSignal<Question[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [form, setForm] = createSignal({
    categoryId: "",
    title: "",
    body: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [questionsData, categoriesData] = await Promise.all([
        listMyQuestions(),
        listCategories(),
      ]);
      setItems(questionsData.items);
      setCategories(categoriesData.items);
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
    try {
      const payload = form();
      if (!payload.categoryId || !payload.title) {
        throw new Error("Category and title are required.");
      }
      await createQuestion({
        categoryId: payload.categoryId,
        title: payload.title,
        body: payload.body || undefined,
      });
      setForm({ categoryId: "", title: "", body: "" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section class="space-y-6">
      <div class="rounded-2xl border bg-card p-6">
        <h3 class="text-lg font-semibold">Ask a question</h3>
        <div class="mt-4 grid gap-4">
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="question-category">
              Category
            </label>
            <select
              id="question-category"
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
            <TextFieldLabel for="question-title">Title</TextFieldLabel>
            <TextFieldInput
              id="question-title"
              value={form().title}
              onInput={(e) =>
                setForm({ ...form(), title: e.currentTarget.value })
              }
              placeholder="How do I remove background noise?"
            />
          </TextField>
          <TextField>
            <TextFieldLabel for="question-body">Details</TextFieldLabel>
            <TextFieldInput
              id="question-body"
              value={form().body}
              onInput={(e) =>
                setForm({ ...form(), body: e.currentTarget.value })
              }
              placeholder="Explain your context"
            />
          </TextField>
          <div class="flex gap-2">
            <Button onClick={() => void submit()} disabled={saving()}>
              Submit question
            </Button>
            <Button
              variant="outline"
              onClick={() => setForm({ categoryId: "", title: "", body: "" })}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="rounded-2xl border bg-card p-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">My questions</h3>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <Show
          when={!loading()}
          fallback={<div class="mt-4 text-sm">Loading…</div>}
        >
          <div class="mt-4 grid gap-3">
            {items().map((question) => (
              <div class="rounded-xl border p-4">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-xs text-muted-foreground">
                      {question.categoryId}
                    </div>
                    <div class="text-base font-semibold">{question.title}</div>
                    <div class="text-sm text-muted-foreground">
                      {question.status === "answered" ? "Answered" : "New"}
                    </div>
                  </div>
                  <A
                    href={`/student/questions/${question.id}`}
                    class="text-sm font-medium text-primary underline"
                  >
                    View
                  </A>
                </div>
              </div>
            ))}
          </div>
        </Show>
      </div>
    </section>
  );
}
