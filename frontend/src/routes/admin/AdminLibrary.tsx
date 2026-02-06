import { createEffect, createMemo, createSignal, Show } from "solid-js";
import { A } from "@solidjs/router";
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
import { listCategories, type Category } from "../../lib/adminApi";
import { listLibrary, type LibraryEntrySummary } from "../../lib/libraryApi";

export function AdminLibrary() {
  const [items, setItems] = createSignal<LibraryEntrySummary[]>([]);
  const [categories, setCategories] = createSignal<Category[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [filters, setFilters] = createSignal({
    status: "",
    categoryId: "",
    q: "",
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
      const [libraryData, categoriesData] = await Promise.all([
        listLibrary({
          status: filterValues.status || undefined,
          categoryId: filterValues.categoryId || undefined,
          q: filterValues.q || undefined,
          limit: 100,
        }),
        listCategories(),
      ]);
      setItems(libraryData.items);
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
      title="Library"
      subtitle="Create, edit, and publish knowledge base entries."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink current>Library</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <div class="flex gap-2">
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
          <Button as={A} href="/admin/library/new">
            New entry
          </Button>
        </div>
      }
    >
      <SectionCard title="Filters" description="Find entries by status, category, or keyword.">
        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="library-status">
              Status
            </label>
            <select
              id="library-status"
              class="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filters().status}
              onChange={(e) =>
                setFilters({ ...filters(), status: e.currentTarget.value })
              }
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium" for="library-category">
              Category
            </label>
            <select
              id="library-category"
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
            <TextFieldLabel for="library-search">Search</TextFieldLabel>
            <TextFieldInput
              id="library-search"
              value={filters().q}
              onInput={(e) => setFilters({ ...filters(), q: e.currentTarget.value })}
              placeholder="Search keywords"
            />
          </TextField>
        </div>
        <div class="mt-4 flex gap-2">
          <Button onClick={() => void load()}>Apply filters</Button>
          <Button
            variant="outline"
            onClick={() => setFilters({ status: "", categoryId: "", q: "" })}
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

      <SectionCard title="Entries">
        <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
          <div class="grid gap-3">
            {items().map((entry) => (
              <div class="rounded-xl border p-4">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div class="text-xs text-muted-foreground">
                      {categoryLookup().get(entry.categoryId) || entry.categoryId}
                    </div>
                    <div class="text-base font-semibold">{entry.title}</div>
                    <div class="mt-1 text-sm text-muted-foreground">
                      {entry.status === "published" ? "Published" : "Draft"}
                    </div>
                  </div>
                  <A
                    href={`/admin/library/${entry.id}`}
                    class="text-sm font-medium text-primary underline"
                  >
                    Edit
                  </A>
                </div>
              </div>
            ))}
          </div>
          <Show when={items().length === 0}>
            <div class="mt-4 text-sm text-muted-foreground">
              No entries match the current filters.
            </div>
          </Show>
        </Show>
      </SectionCard>
    </Page>
  );
}
