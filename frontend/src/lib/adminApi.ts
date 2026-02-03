import { apiFetch } from './api'

type ApiList<T> = { items: T[]; nextCursor?: string | null }

type Category = {
  id: string
  name: string
  slug: string
  type: string
}

type Goal = {
  id: string
  title: string
  description?: string | null
}

type StepTemplate = {
  id: string
  title: string
  description: string
  materialUrl: string
  categoryId?: string | null
  tags?: string[]
  isActive: boolean
}

type Student = {
  uid: string
  email?: string
  displayName?: string
  role?: string
  status?: string
  createdAt?: unknown
  updatedAt?: unknown
}

type PlanResponse = {
  planId: string
  studentUid: string
  goalId: string
  createdAt?: unknown
  updatedAt?: unknown
}

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Request failed')
  }
  return response.json() as Promise<T>
}

export async function listCategories() {
  const response = await apiFetch('/api/admin/categories')
  return handleJson<ApiList<Category>>(response)
}

export async function createCategory(payload: Omit<Category, 'id'>) {
  const response = await apiFetch('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<Category>(response)
}

export async function updateCategory(id: string, payload: Partial<Omit<Category, 'id'>>) {
  const response = await apiFetch(`/api/admin/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<Category>(response)
}

export async function deleteCategory(id: string) {
  const response = await apiFetch(`/api/admin/categories/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Delete failed')
  }
}

export async function listGoals() {
  const response = await apiFetch('/api/admin/goals')
  return handleJson<ApiList<Goal>>(response)
}

export async function createGoal(payload: Omit<Goal, 'id'>) {
  const response = await apiFetch('/api/admin/goals', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<Goal>(response)
}

export async function updateGoal(id: string, payload: Partial<Omit<Goal, 'id'>>) {
  const response = await apiFetch(`/api/admin/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<Goal>(response)
}

export async function deleteGoal(id: string) {
  const response = await apiFetch(`/api/admin/goals/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Delete failed')
  }
}

export async function listStepTemplates() {
  const response = await apiFetch('/api/admin/step-templates')
  return handleJson<ApiList<StepTemplate>>(response)
}

export async function createStepTemplate(payload: Omit<StepTemplate, 'id'>) {
  const response = await apiFetch('/api/admin/step-templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<StepTemplate>(response)
}

export async function updateStepTemplate(
  id: string,
  payload: Partial<Omit<StepTemplate, 'id'>>,
) {
  const response = await apiFetch(`/api/admin/step-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<StepTemplate>(response)
}

export async function deleteStepTemplate(id: string) {
  const response = await apiFetch(`/api/admin/step-templates/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Delete failed')
  }
}

export async function listStudents(params?: {
  status?: string
  role?: string
  q?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.role) query.set('role', params.role)
  if (params?.q) query.set('q', params.q)
  if (params?.limit) query.set('limit', String(params.limit))
  const response = await apiFetch(`/api/admin/students?${query.toString()}`)
  return handleJson<ApiList<Student>>(response)
}

export async function assignPlan(uid: string, goalId: string) {
  const response = await apiFetch(`/api/admin/students/${uid}/plan`, {
    method: 'POST',
    body: JSON.stringify({ goalId }),
  })
  return handleJson<PlanResponse>(response)
}

export async function bulkAddSteps(
  uid: string,
  payload: { append?: boolean; items: { templateId?: string; title?: string; description?: string; materialUrl?: string }[] },
) {
  const response = await apiFetch(`/api/admin/students/${uid}/plan/steps`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<{ created: unknown[] }>(response)
}

export async function reorderSteps(
  uid: string,
  payload: { items: { stepId: string; order: number }[] },
) {
  const response = await apiFetch(`/api/admin/students/${uid}/plan/steps/reorder`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<{ updated: number }>(response)
}

export type { Category, Goal, StepTemplate, Student, PlanResponse }
