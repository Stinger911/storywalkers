import { createEffect, createSignal, Show } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { getLibraryEntry, type LibraryEntry } from '../../lib/libraryApi'

export function StudentLibraryDetail() {
  const params = useParams()
  const [entry, setEntry] = createSignal<LibraryEntry | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!params.id) {
        throw new Error('No library entry ID provided.')
      }
      const data = await getLibraryEntry(params.id)
      setEntry(data)
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
        <div class="flex items-center justify-between">
          <h2 class="text-2xl font-semibold">Library entry</h2>
          <A href="/student/profile" class="text-sm text-primary underline">
            Back to profile
          </A>
        </div>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">Loading…</div>}>
        <Show when={entry()}>
          <div class="rounded-2xl border bg-card p-6">
            <div class="text-xs text-muted-foreground">
              {entry()?.categoryId}
            </div>
            <h3 class="text-xl font-semibold">{entry()?.title}</h3>
            <p class="mt-3 whitespace-pre-line text-sm text-muted-foreground">
              {entry()?.content}
            </p>
            <Show when={entry()?.videoUrl}>
              <a
                class="mt-3 inline-block text-sm text-primary underline"
                href={entry()?.videoUrl ?? ''}
                target="_blank"
                rel="noreferrer"
              >
                Watch video
              </a>
            </Show>
          </div>
        </Show>
      </Show>
    </section>
  )
}
