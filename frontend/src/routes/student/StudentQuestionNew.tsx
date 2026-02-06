import { createEffect, createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import { SectionCard } from "../../components/ui/section-card";
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import {
  Select,
  SelectContent,
  SelectHiddenSelect,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { listCategories, type Category } from "../../lib/adminApi";
import { createQuestion } from "../../lib/questionsApi";

export function StudentQuestionNew() {
  const navigate = useNavigate();
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [form, setForm] = createSignal({
    categoryId: "",
    title: "",
    body: "",
  });

  createEffect(() => {
    void (async () => {
      try {
        const data = await listCategories();
        setCategories(data.items);
      } catch (err) {
        setError((err as Error).message);
      }
    })();
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
      navigate("/student/questions");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-semibold">Ask a question</h2>
        <p class="text-sm text-muted-foreground">
          Share details so mentors can help quickly.
        </p>
      </div>

      <SectionCard title="New question">
        <div class="grid gap-4">
          <div class="grid gap-2">
            <Select
              value={
                categories().find((category) => category.id === form().categoryId) ??
                null
              }
              onChange={(value) =>
                setForm({ ...form(), categoryId: value?.id ?? "" })
              }
              options={[
                { id: "", name: "Select category" },
                ...categories().map((category) => ({
                  id: category.id,
                  name: category.name,
                })),
              ]}
              optionValue={(option) =>
                (option as unknown as { id: string; name: string }).id
              }
              optionTextValue={(option) =>
                (option as unknown as { id: string; name: string }).name
              }
              itemComponent={(props) => (
                <SelectItem item={props.item}>
                  {
                    (props.item.rawValue as unknown as { name: string }).name
                  }
                </SelectItem>
              )}
            >
              <SelectLabel for="question-category">Category</SelectLabel>
              <SelectHiddenSelect id="question-category" />
              <SelectTrigger aria-label="Category">
                <SelectValue<{ id: string; name: string }>>
                  {(state) =>
                    (
                      (state?.selectedOption() || {}) as unknown as {
                        name: string;
                      }
                    ).name ?? "Select category"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
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
          <div class="flex flex-wrap gap-2">
            <Button onClick={() => void submit()} disabled={saving()}>
              Submit question
            </Button>
            <Button variant="outline" onClick={() => navigate("/student/questions")}>
              Cancel
            </Button>
          </div>
        </div>
      </SectionCard>

      <Show when={error()}>
        <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>
    </section>
  );
}
