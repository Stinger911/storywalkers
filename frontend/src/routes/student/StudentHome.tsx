import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import { Button } from '../../components/ui/button'
import { useAuth } from '../../lib/auth'
import { getMyPlan, getMyPlanSteps, updateMyStepProgress, type PlanStep as ApiPlanStep } from '../../lib/studentApi'
import { listGoals, type Goal } from '../../lib/adminApi'

type StudentPlan = {
  studentUid: string
  goalId: string
}

type PlanStep = {
  id: string
  title: string
  description: string
  materialUrl: string
  order: number
  isDone: boolean
  doneAt?: { toDate?: () => Date } | null
}

export function StudentHome() {
  const auth = useAuth()
  const [plan, setPlan] = createSignal<StudentPlan | null>(null)
  const [goal, setGoal] = createSignal<Goal | null>(null)
  const [steps, setSteps] = createSignal<PlanStep[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [planData, stepsData, goalsData] = await Promise.all([
        getMyPlan(),
        getMyPlanSteps(),
        listGoals(),
      ])
      setPlan({
        studentUid: planData.studentUid,
        goalId: planData.goalId,
      })
      const goalMatch = goalsData.items.find((g) => g.id === planData.goalId) || null
      setGoal(goalMatch)
      setSteps(
        stepsData.items.map((step: ApiPlanStep) => ({
          id: step.stepId,
          title: step.title,
          description: step.description,
          materialUrl: step.materialUrl,
          order: step.order,
          isDone: step.isDone,
          doneAt: step.doneAt as { toDate?: () => Date } | null,
        })),
      )
    } catch (err) {
      setError((err as Error).message)
      setPlan(null)
      setGoal(null)
      setSteps([])
    } finally {
      setLoading(false)
    }
  }

  createEffect(() => {
    void load()
  })

  const progress = createMemo(() => {
    const total = steps().length
    const done = steps().filter((step) => step.isDone).length
    const percent = total ? Math.round((done / total) * 100) : 0
    return { total, done, percent }
  })

  const toggleStep = async (step: PlanStep) => {
    const nextDone = !step.isDone
    try {
      await updateMyStepProgress(step.id, nextDone)
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section class="space-y-6">
      <div class="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 class="text-2xl font-semibold">My Path</h2>
        <p class="text-muted-foreground">
          Track your progress and mark steps as completed.
        </p>
        <Show when={auth.me()}>
          <div class="mt-3 text-sm text-muted-foreground">
            Signed in as{' '}
            <span class="font-medium text-foreground">
              {auth.me()?.displayName ?? auth.me()?.email}
            </span>
          </div>
        </Show>
      </div>

      <Show when={error()}>
        <div class="rounded-2xl border border-error bg-error/10 p-4 text-sm text-error-foreground">
          {error()}
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="text-sm">Loading plan…</div>}>
        <Show
          when={plan()}
          fallback={
            <div class="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
              No plan has been assigned yet. Check back later.
            </div>
          }
        >
          <div class="rounded-2xl border bg-card p-6">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 class="text-xl font-semibold">
                  {goal()?.title ?? 'Learning goal'}
                </h3>
                <p class="text-sm text-muted-foreground">
                  {goal()?.description ?? 'Your personalized learning path.'}
                </p>
              </div>
              <div class="rounded-full border px-4 py-2 text-sm font-medium">
                {progress().done}/{progress().total} · {progress().percent}%
              </div>
            </div>

            <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress().percent}%` }}
              />
            </div>
          </div>

          <div class="grid gap-4">
            <Show
              when={steps().length > 0}
              fallback={
                <div class="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
                  Steps will appear here once your plan is ready.
                </div>
              }
            >
              {steps().map((step) => (
                <div class="rounded-2xl border bg-card p-6 shadow-sm">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <h4 class="text-lg font-semibold">{step.title}</h4>
                      <p class="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                      <Show when={step.materialUrl}>
                        <a
                          class="mt-2 inline-block text-sm text-primary underline"
                          href={step.materialUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open material
                        </a>
                      </Show>
                    </div>
                    <Button
                      variant={step.isDone ? 'secondary' : 'default'}
                      onClick={() => void toggleStep(step)}
                    >
                      {step.isDone ? 'Completed' : 'Mark done'}
                    </Button>
                  </div>
                  <Show when={step.isDone && step.doneAt?.toDate}>
                    <div class="mt-3 text-xs text-muted-foreground">
                      Completed on {step.doneAt?.toDate?.().toLocaleDateString()}
                    </div>
                  </Show>
                </div>
              ))}
            </Show>
          </div>
        </Show>
      </Show>
    </section>
  )
}
