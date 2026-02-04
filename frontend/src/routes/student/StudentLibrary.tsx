import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { A } from '@solidjs/router'
import { Button } from '../../components/ui/button'
import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from '../../components/ui/text-field'
import { listCategories, type Category } from '../../lib/adminApi'
import { listLibrary, type LibraryEntrySummary } from '../../lib/libraryApi'

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

  return (
    <section class="space-y-6">
      <div class="rounded-2xl border bg-card p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-2xl font-semibold">Library</h2>
            <p class="text-sm text-muted-foreground">
              Browse published tips from the expert team.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
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
              placeholder="Noise reduction, lighting, etc."
            />
          </TextField>
        </div>
        <div class="mt-4 flex gap-2">
          <Button onClick={() => void load()}>Apply filters</Button>
          <Button
            variant="outline"
            onClick={() => setFilters({ categoryId: '', q: '' })}
          >
            Clear
          </Button>
        </div>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <div class="rounded-2xl border bg-card p-6">
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
                  </div>
                  <A
                    href={`/student/library/${entry.id}`}
                    class="text-sm font-medium text-primary underline"
                  >
                    View
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
      </div>
    </section>
  )
}
