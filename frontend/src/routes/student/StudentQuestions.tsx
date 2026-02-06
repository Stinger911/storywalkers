import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button, buttonVariants } from "../../components/ui/button";
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
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from "../../components/ui/text-field";
import { listCategories, type Category } from "../../lib/adminApi";
import { type Question, listQuestions } from "../../lib/questionsApi";
import { SectionCard } from "../../components/ui/section-card";
import { SmallStatBadge } from "../../components/ui/small-stat-badge";

const statusTabs = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "answered", label: "Answered" },
] as const;

export function StudentQuestions() {
  const [items, setItems] = createSignal<Question[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [search, setSearch] = createSignal("");
  const [categoryId, setCategoryId] = createSignal("");
  const [status, setStatus] = createSignal<(typeof statusTabs)[number]["id"]>(
    "all",
  );

  const categoryLabel = createMemo(() => {
    const match = categories().find((category) => category.id === categoryId());
    return match?.name ?? "All categories";
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesData, questionsData] = await Promise.all([
        listCategories(),
        listQuestions({
          status: status() === "all" ? undefined : status(),
          categoryId: categoryId() || undefined,
        }),
      ]);
      const list = questionsData.items;
      const term = search().trim().toLowerCase();
      const filtered = term
        ? list.filter(
            (question) =>
              question.title.toLowerCase().includes(term) ||
              (question.body ?? "").toLowerCase().includes(term),
          )
        : list;
      setItems(filtered);
      setCategories(categoriesData.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    search();
    categoryId();
    status();
    void load();
  });

  const categoryName = (id?: string) =>
    categories().find((category) => category.id === id)?.name ?? id ?? "General";

  const formatDate = (value?: unknown) => {
    if (!value) return "";
    const maybe = value as { toDate?: () => Date };
    if (maybe?.toDate) return maybe.toDate().toLocaleDateString();
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleDateString();
    }
    return "";
  };

  return (
    <section class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-2xl font-semibold">My Questions</h2>
        <A href="/student/questions/new" class={buttonVariants()}>
          Ask question
        </A>
      </div>

      <SectionCard title="Filters" description="Find questions quickly.">
        <div class="grid gap-4 lg:grid-cols-[1.2fr_240px_auto] lg:items-end">
          <TextField>
            <TextFieldLabel for="question-search">Search</TextFieldLabel>
            <TextFieldInput
              id="question-search"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder="Search by title or details"
            />
          </TextField>

          <div class="grid gap-2">
            <Select
              value={
                categories().find((category) => category.id === categoryId()) ??
                null
              }
              onChange={(value) => setCategoryId(value?.id ?? "")}
              options={[
                { id: "", name: "All categories" },
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
                    ).name ?? "All categories"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent />
            </Select>
          </div>

          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button
              class={`rounded-[var(--radius-md)] border px-3 py-1 text-xs font-semibold ${
                status() === tab.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-background text-muted-foreground"
              }`}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <Show when={categoryId()}>
            <SmallStatBadge class="bg-card">{categoryLabel()}</SmallStatBadge>
          </Show>
        </div>
      </SectionCard>

      <Show when={error()}>
        <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <SectionCard title="Questions">
        <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
          <div class="grid gap-3">
            {items().map((question) => (
              <A
                href={`/student/questions/${question.id}`}
                class="rounded-[var(--radius-md)] border border-border/70 bg-card px-4 py-3 shadow-rail transition hover:border-primary/40"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold">{question.title}</div>
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
                        {categoryName(question.categoryId)}
                      </span>
                      <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
                        {question.status === "answered" ? "Answered" : "New"}
                      </span>
                      <span>{formatDate(question.updatedAt || question.createdAt)}</span>
                    </div>
                  </div>
                  <span class="text-xs font-semibold text-primary">Open</span>
                </div>
              </A>
            ))}
          </div>
        </Show>
      </SectionCard>
    </section>
  );
}
