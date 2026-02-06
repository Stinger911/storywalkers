import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { Button, buttonVariants } from '../../components/ui/button'
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from '../../components/ui/text-field'
import { listCategories, type Category } from '../../lib/adminApi'
import { listLibrary, type LibraryEntrySummary } from '../../lib/libraryApi'
import { Illustration } from '../../components/ui/illustration'
import { SectionCard } from '../../components/ui/section-card'
import { SmallStatBadge } from '../../components/ui/small-stat-badge'

export function StudentLibrary() {
  const [items, setItems] = createSignal<LibraryEntrySummary[]>([])
  const [categories, setCategories] = createSignal<Category[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)
  const [filters, setFilters] = createSignal({
    categoryId: '',
    q: '',
  })

  const categoryLookup = createMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories()) {
      map.set(category.id, category.name)
    }
    return map
  })

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [libraryData, categoriesData] = await Promise.all([
        listLibrary({
          categoryId: filters().categoryId || undefined,
          q: filters().q || undefined,
          limit: 100,
        }),
        listCategories(),
      ])
      setItems(libraryData.items)
      setCategories(categoriesData.items)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    void load()
  })

  const formatDate = (value?: unknown) => {
    if (!value) return ''
    const maybe = value as { toDate?: () => Date }
    if (maybe?.toDate) return maybe.toDate().toLocaleDateString()
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return date.toLocaleDateString()
    }
    return ''
  }

  return (
    <section class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-2xl font-semibold">Library</h2>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <SectionCard title="Filters" description="Search by topic or category.">
        <div class="grid gap-4 lg:grid-cols-[1.2fr_240px_auto] lg:items-end">
          <TextField>
            <TextFieldLabel for="library-search">Search</TextFieldLabel>
            <TextFieldInput
              id="library-search"
              value={filters().q}
              onInput={(e) => setFilters({ ...filters(), q: e.currentTarget.value })}
              placeholder="Noise reduction, lighting, etc."
            />
          </TextField>
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
          <Button onClick={() => void load()}>Apply</Button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <Show when={filters().categoryId}>
            <SmallStatBadge class="bg-card">
              {categoryLookup().get(filters().categoryId) || filters().categoryId}
            </SmallStatBadge>
          </Show>
          <Button
            variant="outline"
            onClick={() => setFilters({ categoryId: '', q: '' })}
          >
            Clear
          </Button>
        </div>
      </SectionCard>

      <Show when={error()}>
        <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <SectionCard title="Entries">
        <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
          <div class="grid gap-3 md:grid-cols-2">
            {items().map((entry) => (
              <div class="rounded-[var(--radius-md)] border border-border/70 bg-card p-4 shadow-rail">
                <div class="flex items-start gap-4">
                  <Illustration
                    src="/illustrations/goal-thumb.svg"
                    alt="Entry thumbnail"
                    class="h-14 w-14"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="text-xs text-muted-foreground">
                      {categoryLookup().get(entry.categoryId) || entry.categoryId}
                    </div>
                    <div class="truncate text-sm font-semibold">{entry.title}</div>
                    <div class="mt-1 truncate text-xs text-muted-foreground">
                      {(categoryLookup().get(entry.categoryId) || entry.categoryId) +
                        (entry.status ? ` · ${entry.status}` : "")}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">
                      Updated {formatDate(entry.updatedAt || entry.createdAt)}
                    </div>
                    <div class="mt-3 flex items-center justify-between">
                      <A
                        href={`/student/library/${entry.id}`}
                        class={buttonVariants({ size: 'sm' })}
                      >
                        Open
                      </A>
                      <span class="text-xs text-muted-foreground">
                        View
                      </span>
                    </div>
                  </div>
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
    </section>
  )
}
