import { Show, createMemo, createSignal } from 'solid-js'
import { Button, buttonVariants } from '../../components/ui/button'
import { Card, CardContent } from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Illustration } from '../../components/ui/illustration'
import { SectionCard } from '../../components/ui/section-card'
import { SmallStatBadge } from '../../components/ui/small-stat-badge'
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from '../../components/ui/text-field'
import { showToast } from '../../components/ui/toast'
import { EditableDisplayName } from '../../components/ui/editable-display-name'
import { useMe } from '../../lib/useMe'
import { useI18n } from '../../lib/i18n'
import { useMyPlan } from './studentPlanContext'
import { cn } from '../../lib/utils'

export function StudentHome() {
  const { me } = useMe()
  const { plan, goal, steps, loading, error, progress, markStepDone, completeStep, openMaterial } = useMyPlan()
  const { t } = useI18n()
  const [completeDialogOpen, setCompleteDialogOpen] = createSignal(false)
  const [pendingStepId, setPendingStepId] = createSignal<string | null>(null)
  const [doneComment, setDoneComment] = createSignal('')
  const [doneLink, setDoneLink] = createSignal('')
  const [submittingComplete, setSubmittingComplete] = createSignal(false)
  const firstName = createMemo(() => {
    const raw = me()?.displayName ?? ''
    return raw.trim().split(' ')[0] || t('student.home.fallbackName')
  })
  const currentStep = createMemo(() => steps().find((step) => !step.isDone) ?? null)

  const openCompleteDialog = (stepId: string) => {
    setPendingStepId(stepId)
    setDoneComment('')
    setDoneLink('')
    setCompleteDialogOpen(true)
  }

  const closeCompleteDialog = () => {
    setCompleteDialogOpen(false)
    setPendingStepId(null)
    setDoneComment('')
    setDoneLink('')
    setSubmittingComplete(false)
  }

  const submitComplete = async () => {
    if (!pendingStepId()) return
    setSubmittingComplete(true)
    try {
      await completeStep(pendingStepId()!, {
        comment: doneComment(),
        link: doneLink(),
      })
      closeCompleteDialog()
    } catch (err) {
      showToast({
        variant: 'error',
        title: t('student.home.completeDialogErrorTitle'),
        description:
          (err as Error).message || t('student.home.completeDialogErrorBody'),
      })
      setSubmittingComplete(false)
    }
  }

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
            <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t('student.home.signedInAs')}</span>
              <EditableDisplayName
                displayName={me()?.displayName}
                email={me()?.email}
                canEdit
              />
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
            title={t('student.home.currentStepTitle')}
            description={t('student.home.currentStepDescription')}
          >
            <Show
              when={currentStep()}
              fallback={
                <div class="text-sm text-muted-foreground">
                  {t('student.home.currentStepEmpty')}
                </div>
              }
            >
              {(step) => (
                <div class="rounded-[var(--radius-lg)] border border-border/70 bg-card p-5 shadow-rail">
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0">
                      <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('student.home.currentStepLabel')}
                      </div>
                      <div class="mt-2 text-lg font-semibold">
                        {step().title}
                      </div>
                      <div class="mt-2 text-sm text-muted-foreground">
                        {step().description}
                      </div>
                      <Show when={step().materialUrl}>
                        <button
                          class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                          onClick={() => openMaterial(step().materialUrl)}
                        >
                          <span class="material-symbols-outlined text-[18px]">open_in_new</span>
                          {t('student.home.currentStepMaterial')}
                        </button>
                      </Show>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      {step().materialUrl ? (
                        <button
                          class={buttonVariants({ size: 'sm' })}
                          onClick={() => openMaterial(step().materialUrl)}
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
                        size="sm"
                        onClick={() => openCompleteDialog(step().id)}
                      >
                        {t('student.home.currentStepMarkDone')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Show>
          </SectionCard>

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
                          <Show when={step.isDone && step.doneComment}>
                            <div class="mt-2 text-xs">
                              <span class="font-semibold">Комментарий: </span>
                              <span class="text-muted-foreground">{step.doneComment}</span>
                            </div>
                          </Show>
                          <Show when={step.isDone && step.doneLink}>
                            <div class="mt-1 text-xs">
                              <span class="font-semibold">Ссылка: </span>
                              <a
                                href={step.doneLink ?? "#"}
                                target="_blank"
                                rel="noopener"
                                class="text-primary underline"
                              >
                                {step.doneLink}
                              </a>
                            </div>
                          </Show>
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
                          onClick={() => {
                            if (step.isDone) {
                              void markStepDone(step.id, false)
                              return
                            }
                            openCompleteDialog(step.id)
                          }}
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

      <Dialog
        open={completeDialogOpen()}
        onOpenChange={(open) => {
          if (!open && !submittingComplete()) {
            closeCompleteDialog()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('student.home.completeDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('student.home.completeDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <TextField>
              <TextFieldLabel for="step-done-comment">
                {t('student.home.completeDialogCommentLabel')}
              </TextFieldLabel>
              <TextFieldTextArea
                id="step-done-comment"
                value={doneComment()}
                onInput={(event) => setDoneComment(event.currentTarget.value)}
                rows={4}
                disabled={submittingComplete()}
              />
            </TextField>

            <TextField>
              <TextFieldLabel for="step-done-link">
                {t('student.home.completeDialogLinkLabel')}
              </TextFieldLabel>
              <TextFieldInput
                id="step-done-link"
                type="url"
                value={doneLink()}
                onInput={(event) => setDoneLink(event.currentTarget.value)}
                placeholder={t('student.home.completeDialogLinkPlaceholder')}
                disabled={submittingComplete()}
              />
            </TextField>

            <details class="rounded-[var(--radius-md)] border border-border/70 p-3 text-sm">
              <summary class="cursor-pointer font-semibold">
                {t('student.home.completeDialogDriveHelpTitle')}
              </summary>
              <ol class="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>{t('student.home.completeDialogDriveHelpStep1')}</li>
                <li>{t('student.home.completeDialogDriveHelpStep2')}</li>
                <li>{t('student.home.completeDialogDriveHelpStep3')}</li>
                <li>{t('student.home.completeDialogDriveHelpStep4')}</li>
              </ol>
            </details>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeCompleteDialog} disabled={submittingComplete()}>
              {t('student.home.completeDialogCancel')}
            </Button>
            <Button onClick={() => void submitComplete()} disabled={submittingComplete()}>
              <Show when={submittingComplete()}>
                <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </Show>
              {t('student.home.completeDialogConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
