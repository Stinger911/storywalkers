import { apiFetch } from './api'

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Request failed')
  }
  return response.json() as Promise<T>
}

export type PlanResponse = {
  planId: string
  studentUid: string
  goalId: string
  createdAt?: unknown
  updatedAt?: unknown
}

export type PlanStep = {
  stepId: string
  title: string
  description: string
  materialUrl: string
  order: number
  isDone: boolean
  doneAt?: unknown
  doneComment?: string | null
  doneLink?: string | null
}

export type CompleteStepRequest = {
  comment?: string
  link?: string
}

export type CompleteStepResponse = {
  status: string
  completionId: string
}

export async function getMyPlan() {
  const response = await apiFetch('/api/me/plan')
  return handleJson<PlanResponse>(response)
}

export async function getMyPlanSteps() {
  const response = await apiFetch('/api/me/plan/steps')
  return handleJson<{ items: PlanStep[] }>(response)
}

export async function updateMyStepProgress(stepId: string, isDone: boolean) {
  const response = await apiFetch(`/api/me/plan/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isDone }),
  })
  return handleJson<PlanStep>(response)
}

export async function completeMyStep(stepId: string, payload: CompleteStepRequest) {
  const response = await apiFetch(`/api/student/steps/${stepId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<CompleteStepResponse>(response)
}
