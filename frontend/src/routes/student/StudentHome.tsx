import { Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { SectionCard } from '../../components/ui/section-card'
import { Skeleton } from '../../components/ui/skeleton'
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from '../../components/ui/text-field'
import { showToast } from '../../components/ui/toast'
import { useMe } from '../../lib/useMe'
import { useI18n } from '../../lib/i18n'
import { useMyPlan } from './studentPlanContext'
import { useStudentLayoutRail } from './StudentLayout'
import { StudentPathVisualization } from './StudentPathVisualization'

export function StudentHome(props: { readOnly?: boolean }) {
  const { me } = useMe()
  const { plan, steps, loading, error, progress, markStepDone, completeStep, openMaterial } = useMyPlan()
  const { t } = useI18n()
  const [completeDialogOpen, setCompleteDialogOpen] = createSignal(false)
  const [pendingStepId, setPendingStepId] = createSignal<string | null>(null)
  const [doneComment, setDoneComment] = createSignal('')
  const [doneLink, setDoneLink] = createSignal('')
  const [submittingComplete, setSubmittingComplete] = createSignal(false)
  const setStudentRail = useStudentLayoutRail()
  const firstName = createMemo(() => {
    const raw = me()?.displayName ?? ''
    return raw.trim().split(' ')[0] || t('student.home.fallbackName')
  })
  const currentStep = createMemo(() => steps().find((step) => !step.isDone) ?? null)
  const ownedCoursesCount = createMemo(
    () => me()?.selectedCourses?.filter((value) => typeof value === "string").length ?? 0,
  )
  const completedLessonsCount = createMemo(() => progress().done)
  const progressCards = createMemo(() => [
    {
      label: t('student.home.ongoingCourses'),
      value: String(ownedCoursesCount()).padStart(2, "0"),
      icon: "play_circle",
      iconClass: "text-primary",
    },
    {
      label: t('student.home.completedLessons'),
      value: String(completedLessonsCount()).padStart(2, "0"),
      icon: "task_alt",
      iconClass: "text-[#2a683a]",
    },
    {
      label: t('student.home.nextMilestone'),
      value: currentStep()?.title ?? t('student.home.currentStepEmpty'),
      icon: "auto_stories",
      iconClass: "text-primary",
      meta: t('student.home.milestoneProgress', { done: progress().done, total: progress().total }),
      emphasis: true,
    },
  ])

  createEffect(() => {
    if (!setStudentRail) return

    setStudentRail(
      <div class="space-y-3">
        {progressCards().map((item) => (
          <div
            class={
              item.emphasis
                ? "overflow-hidden rounded-[calc(var(--radius-lg)+2px)] bg-primary px-4 py-4 text-white shadow-none"
                : "rounded-[calc(var(--radius-lg)+2px)] border border-border/70 bg-card px-4 py-4 shadow-none"
            }
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p
                  class={
                    item.emphasis
                      ? "text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(209,228,255,0.95)]"
                      : "text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
                  }
                >
                  {item.label}
                </p>
                <p
                  class={
                    item.emphasis
                      ? "mt-2 text-lg font-bold leading-6 tracking-[-0.03em]"
                      : "mt-2 text-3xl font-extrabold tracking-[-0.04em] text-foreground"
                  }
                >
                  {item.value}
                </p>
                <Show when={item.meta}>
                  <div class={item.emphasis ? "mt-3 text-xs text-white/85" : "mt-3 text-xs text-muted-foreground"}>
                    {item.meta}
                  </div>
                </Show>
              </div>
              <span class={`material-symbols-outlined text-3xl ${item.iconClass} ${item.emphasis ? '!text-white/80' : ''}`}>
                {item.icon}
              </span>
            </div>
          </div>
        ))}
      </div>,
    )

    onCleanup(() => {
      setStudentRail(null)
    })
  })

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
    <section class="space-y-8">
      <Show
        when={!loading()}
        fallback={
          <div class="space-y-6">
            <div class="space-y-3">
              <Skeleton class="h-4 w-36 rounded-[var(--radius-md)]" animate />
              <Skeleton class="h-12 w-80 rounded-[var(--radius-md)]" animate />
              <Skeleton class="h-6 w-96 rounded-[var(--radius-md)]" animate />
            </div>
            <div class="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_320px]">
              <Skeleton class="h-[22rem] rounded-[calc(var(--radius-lg)+6px)]" animate />
              <div class="space-y-4">
                <Skeleton class="h-28 rounded-[calc(var(--radius-lg)+2px)]" animate />
                <Skeleton class="h-28 rounded-[calc(var(--radius-lg)+2px)]" animate />
                <Skeleton class="h-28 rounded-[calc(var(--radius-lg)+2px)]" animate />
              </div>
            </div>
          </div>
        }
      >
        <div class="space-y-3">
          <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary">
            {t('student.home.greetingEyebrow')}
          </p>
          <div class="space-y-1.5">
            <h1 class="text-4xl font-extrabold tracking-[-0.05em] text-foreground sm:text-5xl">
              {t('student.home.welcomeBack', { name: firstName() })}
            </h1>
            <p class="max-w-3xl text-lg text-muted-foreground">
              {t('student.home.weeklyGoalProgress', { percent: progress().percent })}
            </p>
          </div>
        </div>

        <Show when={props.readOnly}>
          <div class="student-callout text-sm">
            Preview mode. This dashboard is read-only for admins.
          </div>
        </Show>

        <Show when={error()}>
          <div class="student-callout student-callout--error text-sm">
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
              <StudentPathVisualization
                steps={steps()}
                initialStepId={currentStep()?.id ?? steps()[0]?.id ?? null}
                currentStepId={currentStep()?.id ?? null}
                ariaLabel={t('student.home.pathMapAriaLabel')}
                openLabel={t('common.open')}
                markDoneLabel={t('student.home.markDone')}
                markNotDoneLabel={t('student.home.markNotDone')}
                lockedLabel={t('student.home.stepLocked')}
                doneCommentLabel={t('student.home.doneCommentLabel')}
                doneLinkLabel={t('student.home.doneLinkLabel')}
                materialLabel={t('student.home.currentStepMaterial')}
                onOpenMaterial={openMaterial}
                toggleDisabled={props.readOnly}
                onToggleStep={(step) => {
                  if (props.readOnly) return
                  if (step.isLocked) return
                  if (step.isDone) {
                    void markStepDone(step.id, false)
                    return
                  }
                  openCompleteDialog(step.id)
                }}
              />
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

            <details class="rounded-[calc(var(--radius-md)+2px)] border border-border/70 p-3 text-sm">
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
