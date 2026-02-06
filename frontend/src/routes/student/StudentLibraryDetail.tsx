import { createEffect, createSignal, Show } from 'solid-js'
import { A, useParams } from '@solidjs/router'
import { buttonVariants } from '../../components/ui/button'
import { SectionCard } from '../../components/ui/section-card'
import { getLibraryEntry, type LibraryEntry } from '../../lib/libraryApi'
import { useI18n } from '../../lib/i18n'

export function StudentLibraryDetail() {
  const params = useParams()
  const { t } = useI18n()
  const [entry, setEntry] = createSignal<LibraryEntry | null>(null)
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const statusLabel = (status?: string) => {
    if (!status) return ''
    if (status === 'draft') return t('common.status.draft')
    if (status === 'published') return t('common.status.published')
    return status
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (!params.id) {
        throw new Error(t('student.libraryDetail.noIdError'))
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
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-2xl font-semibold">{t('student.libraryDetail.title')}</h2>
        <A href="/student/library" class="text-sm text-primary underline">
          {t('student.libraryDetail.back')}
        </A>
      </div>

      <Show when={error()}>
        <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">{t('common.loading')}</div>}>
        <Show when={entry()}>
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
              {entry()?.categoryId}
            </span>
            <span class="rounded-full border border-border/70 bg-background px-2 py-0.5">
              {statusLabel(entry()?.status)}
            </span>
          </div>

          <SectionCard title={entry()?.title ?? t('student.libraryDetail.fallbackTitle')}>
            <p class="whitespace-pre-line text-sm text-muted-foreground">
              {entry()?.content}
            </p>
            <Show when={entry()?.videoUrl}>
              <a
                class={`mt-3 inline-flex ${buttonVariants({ size: 'sm', variant: 'outline' })}`}
                href={entry()?.videoUrl ?? ''}
                target="_blank"
                rel="noreferrer"
              >
                {t('student.libraryDetail.watchVideo')}
              </a>
            </Show>
          </SectionCard>
        </Show>
      </Show>
    </section>
  )
}
