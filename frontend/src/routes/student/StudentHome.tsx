import { Show, createMemo } from 'solid-js'
import { Button, buttonVariants } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import { Illustration } from '../../components/ui/illustration'
import { SectionCard } from '../../components/ui/section-card'
import { SmallStatBadge } from '../../components/ui/small-stat-badge'
import { useMe } from '../../lib/useMe'
import { useI18n } from '../../lib/i18n'
import { useMyPlan } from './studentPlanContext'
import { cn } from '../../lib/utils'

export function StudentHome() {
  const { me } = useMe()
  const { plan, goal, steps, loading, error, progress, markStepDone, openMaterial } = useMyPlan()
  const { t } = useI18n()
  const firstName = createMemo(() => {
    const raw = me()?.displayName ?? ''
    return raw.trim().split(' ')[0] || t('student.home.fallbackName')
  })

  return (
    <section class="space-y-6">
      <Show
        when={!loading()}
        fallback={
          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <div class="h-10 w-56 animate-pulse rounded-[var(--radius-md)] bg-muted" />
              <div class="h-7 w-20 animate-pulse rounded-full bg-muted" />
            </div>
            <div class="h-24 animate-pulse rounded-[var(--radius-lg)] bg-muted" />
            <div class="space-y-3">
              <div class="h-6 w-40 animate-pulse rounded-[var(--radius-md)] bg-muted" />
              <div class="h-20 animate-pulse rounded-[var(--radius-lg)] bg-muted" />
              <div class="h-16 animate-pulse rounded-[var(--radius-lg)] bg-muted" />
            </div>
          </div>
        }
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <h1 class="text-3xl font-semibold tracking-tight">
              {t('student.home.greeting', { name: firstName() })}
            </h1>
          <Show when={me()?.roleRaw && me()?.roleRaw !== 'student'}>
            <SmallStatBadge class="bg-card">
              <span class="material-symbols-outlined text-sm">school</span>
              {me()?.roleRaw}
            </SmallStatBadge>
          </Show>
        </div>
          <Show when={me()}>
            <div class="text-sm text-muted-foreground">
              {t('student.home.signedInAs')}{' '}
              <span class="font-medium text-foreground">
                {me()?.displayName ?? me()?.email}
              </span>
            </div>
          </Show>
        </div>

        <Show when={error()}>
          <div class="rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error-foreground">
            {error()}
          </div>
        </Show>

        <Show
          when={plan()}
          fallback={
            <SectionCard title={t('student.home.noGoalTitle')}>
              <div class="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>{t('student.home.noGoalBody')}</span>
                <a href="/student/questions" class="text-primary underline">
                  {t('student.home.contactAdmin')}
                </a>
              </div>
            </SectionCard>
          }
        >
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-lg font-semibold">{t('student.home.dashboardTitle')}</h2>
            <SmallStatBadge>
              {t('student.home.progressComplete', { percent: progress().percent })}
            </SmallStatBadge>
          </div>

          <Card class="border border-border/70">
            <CardContent class="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_140px] lg:items-center">
              <div class="space-y-2">
                <div class="text-sm font-semibold text-muted-foreground">
                  {t('student.home.goalLabel')}
                </div>
                <h3 class="text-2xl font-semibold">
                  {goal()?.title ?? t('student.home.goalFallbackTitle')}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {goal()?.description ?? t('student.home.goalFallbackDescription')}
                </p>
                <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress().percent}%` }}
                  />
                </div>
              </div>
              <div class="flex justify-start lg:justify-center">
                <Illustration
                  src="/illustrations/goal-thumb.svg"
                  alt={t('student.home.goalThumbnailAlt')}
                  class="h-20 w-20 shadow-rail lg:h-24 lg:w-24"
                />
              </div>
            </CardContent>
          </Card>

          <SectionCard
            title={t('student.home.stepsTitle')}
            description={t('student.home.stepsDescription')}
          >
            <Show
              when={steps().length > 0}
              fallback={
                <div class="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                  <span>{t('student.home.stepsEmpty')}</span>
                  <div class="flex items-center gap-3">
                    <a href="/student/questions" class="text-primary underline">
                      {t('student.home.stepsAskQuestion')}
                    </a>
                    <a href="/student/library" class="text-primary underline">
                      {t('student.home.stepsBrowseLibrary')}
                    </a>
                  </div>
                </div>
              }
            >
              <div class="grid gap-3">
                {steps().map((step) => (
                  <div class="rounded-[var(--radius-md)] border border-border/70 bg-card px-4 py-3 shadow-rail">
                    <div class="flex items-center justify-between gap-4">
                      <div class="flex items-center gap-3 min-w-0">
                        <span
                          class={cn(
                            "material-symbols-outlined text-[22px]",
                            step.isDone ? "text-success-foreground" : "text-muted-foreground",
                          )}
                        >
                          {step.isDone ? "check_circle" : "schedule"}
                        </span>
                        <div class="min-w-0 max-w-[520px]">
                          <div class="truncate text-sm font-semibold">{step.title}</div>
                          <div class="line-clamp-2 text-xs text-muted-foreground">
                            {step.description}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        {step.materialUrl ? (
                          <button
                            class={buttonVariants({ size: "sm" })}
                            onClick={() => openMaterial(step.materialUrl)}
                          >
                            {t('common.open')}
                          </button>
                        ) : (
                          <Button size="sm" disabled>
                            {t('common.open')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={
                            step.isDone
                              ? t('student.home.markNotDone')
                              : t('student.home.markDone')
                          }
                          title={
                            step.isDone
                              ? t('student.home.markNotDone')
                              : t('student.home.markDone')
                          }
                          onClick={() => void markStepDone(step.id, !step.isDone)}
                        >
                          <span class="material-symbols-outlined text-[18px]">check</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Show>
          </SectionCard>
        </Show>
      </Show>
    </section>
  )
}
