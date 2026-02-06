import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Button } from "../../components/ui/button";
import { Page } from "../../components/ui/page";
import { SectionCard } from "../../components/ui/section-card";
import { TextField, TextFieldInput, TextFieldLabel } from "../../components/ui/text-field";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";
import { listCategories, type Category } from "../../lib/adminApi";
import { listQuestions, type Question } from "../../lib/questionsApi";

export function AdminQuestions() {
  const [items, setItems] = createSignal<Question[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [filters, setFilters] = createSignal({
    status: "",
    categoryId: "",
    studentName: "",
  });

  const categoryLookup = createMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories()) {
      map.set(category.id, category.name);
    }
    return map;
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const filterValues = filters();
      const [questionsData, categoriesData] = await Promise.all([
        listQuestions({
          status: filterValues.status || undefined,
          categoryId: filterValues.categoryId || undefined,
          studentName: filterValues.studentName || undefined,
          limit: 100,
        }),
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

  return (
    <Page
      title="Student questions"
      subtitle="Review new questions and respond with published answers."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Questions</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      <SectionCard title="Filters" description="Refine by status, category, or student name.">
        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="question-status">
              Status
            </label>
            <select
              id="question-status"
              class="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters().status}
              onChange={(e) =>
                setFilters({ ...filters(), status: e.currentTarget.value })
              }
            >
              <option value="">All</option>
              <option value="new">New</option>
              <option value="answered">Answered</option>
            </select>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="question-category">
              Category
            </label>
            <select
              id="question-category"
              class="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters().categoryId}
              onChange={(e) =>
                setFilters({ ...filters(), categoryId: e.currentTarget.value })
              }
            >
              <option value="">All categories</option>
              {categories().map((category) => (
                <option value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <TextField>
            <TextFieldLabel for="question-student">Student name</TextFieldLabel>
            <TextFieldInput
              id="question-student"
              value={filters().studentName}
              onInput={(e) =>
                setFilters({ ...filters(), studentName: e.currentTarget.value })
              }
              placeholder="Filter by name"
            />
          </TextField>
        </div>
        <div class="mt-4 flex gap-2">
          <Button onClick={() => void load()}>Apply filters</Button>
          <Button
            variant="outline"
            onClick={() =>
              setFilters({
                status: "",
                categoryId: "",
                studentName: "",
              })
            }
          >
            Clear
          </Button>
        </div>
      </SectionCard>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <SectionCard title="Questions">
        <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
          <div class="grid gap-3">
            {items().map((question) => (
              <div class="rounded-xl border p-4">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div class="text-xs text-muted-foreground">
                      {categoryLookup().get(question.categoryId) ||
                        question.categoryId}
                    </div>
                    <div class="text-base font-semibold">{question.title}</div>
                    <div class="mt-1 text-sm text-muted-foreground">
                      {question.status === "answered" ? "Answered" : "New"}
                      {question.studentUid
                        ? ` · ${question.studentUid}`
                        : ""}
                    </div>
                  </div>
                  <A
                    href={`/admin/questions/${question.id}`}
                    class="text-sm font-medium text-primary underline"
                  >
                    Review
                  </A>
                </div>
              </div>
            ))}
          </div>
          <Show when={items().length === 0}>
            <div class="mt-4 text-sm text-muted-foreground">
              No questions match the current filters.
            </div>
          </Show>
        </Show>
      </SectionCard>
    </Page>
  );
}
