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
import { SectionCard } from '../../components/ui/section-card'
import { Skeleton } from '../../components/ui/skeleton'
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from '../../components/ui/text-field'
import { showToast } from '../../components/ui/toast'
import { Markdown } from '../../components/ui/markdown'
import { useMe } from '../../lib/useMe'
import { useI18n } from '../../lib/i18n'
import { useMyPlan } from './studentPlanContext'
import { StudentPathVisualization } from './StudentPathVisualization'
import { cn } from '../../lib/utils'
import { getYouTubeEmbedUrl } from '../../lib/youtube'

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
  const currentStepEmbedUrl = createMemo(() => getYouTubeEmbedUrl(currentStep()?.materialUrl))
  const ownedCoursesCount = createMemo(
    () => me()?.selectedCourses?.filter((value) => typeof value === "string").length ?? 0,
  )
  const completedLessonsCount = createMemo(() => progress().done)
  const recentActivity = createMemo(() => {
    const completed = steps().filter((step) => step.isDone).slice(0, 2)
    const items = [
      currentStep()
        ? {
            icon: "forum",
            title: currentStep()?.title ?? t("student.home.currentStepTitle"),
            description:
              currentStep()?.description || t("student.home.currentStepDescription"),
            meta: t("student.home.activityCurrentFocus"),
          }
        : null,
      ...completed.map((step) => ({
        icon: "assignment",
        title: step.title,
        description: step.doneComment || step.description,
        meta: t("student.home.activityCompletedStep"),
      })),
      goal()
        ? {
            icon: "star",
            title: goal()?.title ?? t("student.home.goalLabel"),
            description:
              goal()?.description || t("student.home.goalFallbackDescription"),
            meta: t("student.home.activityGoalProgress"),
          }
        : null,
    ].filter(Boolean)
    return items.slice(0, 3) as {
      icon: string
      title: string
      description: string
      meta: string
    }[]
  })
  const resourceItems = createMemo(() => {
    const items = []
    if (currentStep()?.materialUrl) {
      items.push({
        title: currentStep()?.title ?? t("student.home.currentStepMaterial"),
        meta: t("student.home.resourceLatestMaterial"),
        action: t("common.open"),
        onClick: () => openMaterial(currentStep()?.materialUrl),
        icon: "description",
      })
    }
    items.push({
      title: t("student.profileRail.library"),
      meta: t("student.home.resourceSavedDocuments"),
      action: t("common.view"),
      href: "/student/library",
      icon: "bookmark",
    })
    items.push({
      title: t("student.questions.askQuestion"),
      meta: t("student.home.resourceMentorSupport"),
      action: t("common.open"),
      href: "/student/questions/new",
      icon: "video_library",
    })
    return items.slice(0, 3)
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
                ariaLabel={t('student.home.pathMapAriaLabel')}
                openLabel={t('common.open')}
                markDoneLabel={t('student.home.markDone')}
                markNotDoneLabel={t('student.home.markNotDone')}
                lockedLabel={t('student.home.stepLocked')}
                doneCommentLabel={t('student.home.doneCommentLabel')}
                doneLinkLabel={t('student.home.doneLinkLabel')}
                materialLabel={t('student.home.currentStepMaterial')}
                onOpenMaterial={openMaterial}
                onToggleStep={(step) => {
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

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card class="student-stat-card border-0 shadow-none">
              <CardContent class="flex items-center justify-between p-6">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {t('student.home.ongoingCourses')}
                  </p>
                  <p class="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-foreground">
                    {String(ownedCoursesCount()).padStart(2, "0")}
                  </p>
                </div>
                <span class="material-symbols-outlined text-4xl text-primary">
                  play_circle
                </span>
              </CardContent>
            </Card>

            <Card class="student-stat-card border-0 shadow-none">
              <CardContent class="flex items-center justify-between p-6">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    {t('student.home.completedLessons')}
                  </p>
                  <p class="mt-2 text-4xl font-extrabold tracking-[-0.04em] text-foreground">
                    {String(completedLessonsCount()).padStart(2, "0")}
                  </p>
                </div>
                <span class="material-symbols-outlined text-4xl text-[#2a683a]">
                  task_alt
                </span>
              </CardContent>
            </Card>

            <Card class="overflow-hidden rounded-[calc(var(--radius-lg)+2px)] border-0 bg-primary text-white shadow-none">
              <CardContent class="relative p-6">
                <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(209,228,255,0.95)]">
                  {t('student.home.nextMilestone')}
                </p>
                <p class="mt-2 text-2xl font-bold tracking-[-0.04em]">
                  {currentStep()?.title ?? t('student.home.currentStepEmpty')}
                </p>
                <div class="mt-4 flex items-center gap-2 text-xs text-white/85">
                  <span class="material-symbols-outlined text-sm">flag</span>
                  <span>{t('student.home.milestoneProgress', { done: progress().done, total: progress().total })}</span>
                </div>
                <span class="material-symbols-outlined pointer-events-none absolute -bottom-3 -right-3 text-[7rem] text-white/10">
                  auto_stories
                </span>
              </CardContent>
            </Card>
          </div>

          <div class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_360px]">
            <Card class="rounded-[calc(var(--radius-lg)+6px)] border-0 bg-white shadow-card">
              <CardContent class="p-8">
                <div class="mb-8 flex items-center justify-between gap-4">
                  <h2 class="text-2xl font-bold tracking-[-0.03em] text-foreground">
                    {t('student.home.recentActivityTitle')}
                  </h2>
                  <a href="/student/questions" class="text-[11px] font-bold uppercase tracking-[0.16em] text-secondary">
                    {t('student.home.viewAll')}
                  </a>
                </div>
                <div class="space-y-7">
                  {recentActivity().map((item) => (
                    <div class="flex gap-5">
                      <div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[rgba(223,233,247,0.85)] text-primary">
                        <span class="material-symbols-outlined">{item.icon}</span>
                      </div>
                      <div class="min-w-0">
                        <p class="text-sm font-bold text-foreground">{item.title}</p>
                        <p class="mt-1 line-clamp-2 text-xs leading-6 text-muted-foreground">
                          {item.description}
                        </p>
                        <p class="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa3b2]">
                          {item.meta}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card class="rounded-[calc(var(--radius-lg)+6px)] border-0 bg-white shadow-card">
              <CardContent class="p-8">
                <h2 class="mb-8 text-2xl font-bold tracking-[-0.03em] text-foreground">
                  {t('student.home.resourcesTitle')}
                </h2>
                <div class="space-y-4">
                  {resourceItems().map((item) => (
                    <div class="student-resource-item rounded-[calc(var(--radius-md)+2px)] border border-[rgba(194,199,208,0.18)] px-4 py-4">
                      <div class="flex items-center gap-4">
                        <span class="material-symbols-outlined text-muted-foreground">
                          {item.icon}
                        </span>
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-bold text-foreground">{item.title}</p>
                          <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            {item.meta}
                          </p>
                        </div>
                        {"href" in item ? (
                          <a
                            href={item.href}
                            class="material-symbols-outlined text-muted-foreground transition-colors duration-300 hover:text-primary"
                          >
                            open_in_new
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => item.onClick()}
                            class="material-symbols-outlined text-muted-foreground transition-colors duration-300 hover:text-primary"
                          >
                            download
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div class="mt-8 pt-8">
                  <a
                    href="/student/library"
                    class="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[rgba(223,233,247,0.8)] px-5 py-3 text-sm font-bold text-primary transition-colors duration-300 hover:bg-secondary hover:text-white"
                  >
                    <span class="material-symbols-outlined text-lg">local_library</span>
                    {t('student.home.browseFullLibrary')}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

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
                <div
                  id="current-lesson-details"
                  class={cn(
                    'student-list-card rounded-[calc(var(--radius-lg)+2px)] border border-border/70 bg-card p-5 shadow-none',
                    step().isLocked && 'opacity-60',
                  )}
                >
                  <div class="flex flex-wrap items-start justify-between gap-4">
                    <div class="min-w-0">
                      <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t('student.home.currentStepLabel')}
                      </div>
                      <div
                        class={cn(
                          'mt-2 text-xl font-semibold tracking-[-0.03em]',
                          step().isLocked && 'text-muted-foreground',
                        )}
                      >
                        {step().title}
                      </div>
                      <Markdown
                        class="mt-2 text-sm text-muted-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:m-0 [&_ul]:ml-5 [&_ul]:list-disc"
                        content={step().description}
                      />
                      <Show when={step().isLocked}>
                        <div class="mt-2 text-xs font-medium text-muted-foreground">
                          {t('student.home.stepLocked')}
                        </div>
                      </Show>
                      <Show when={currentStepEmbedUrl() && !step().isLocked}>
                        <div class="mt-4 overflow-hidden rounded-[calc(var(--radius-md)+2px)] border border-border/70 bg-muted/30">
                          <div class="aspect-video">
                            <iframe
                              class="h-full w-full"
                              src={currentStepEmbedUrl() ?? undefined}
                              title={step().title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowfullscreen
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          </div>
                        </div>
                      </Show>
                      <Show when={step().materialUrl}>
                        <button
                          class="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                          onClick={() => openMaterial(step().materialUrl)}
                          disabled={step().isLocked}
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
                          disabled={step().isLocked}
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
                        disabled={step().isLocked}
                      >
                        {t('student.home.currentStepMarkDone')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
