import { apiFetch } from './api'

type ApiList<T> = { items: T[]; nextCursor?: string | null }

type Category = {
  id: string
  name: string
  slug: string
  type: string
}

export type Goal = {
  id: string
  title: string
  description?: string | null
}

export type AdminCourse = {
  id: string
  title: string
  description?: string | null
  goalIds: string[]
  priceUsdCents: number
  isActive: boolean
  createdAt?: unknown
  updatedAt?: unknown
}

export type AdminLesson = {
  id: string
  title: string
  type: "video" | "text" | "task"
  content: string
  materialUrl?: string | null
  order: number
  isActive: boolean
  createdAt?: unknown
  updatedAt?: unknown
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

type GoalTemplateStep = {
  id: string
  title: string
  description: string
  materialUrl: string
  order: number
}

type Student = {
  uid: string
  email?: string
  displayName?: string
  role?: string
  status?: string
  progressPercent?: number
  stepsDone?: number
  stepsTotal?: number
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

type StepCompletion = {
  id: string
  stepId: string
  studentUid: string
  studentDisplayName?: string
  goalId?: string
  goalTitle?: string
  stepTitle?: string
  comment?: string | null
  link?: string | null
  status: 'completed' | 'revoked'
  completedAt?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

type PreviewResetFromGoalResponse = {
  existingSteps: number
  willCreateSteps: number
  willLoseProgressStepsDone: number
  sampleTitles: string[]
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

export async function listAdminCourses(params?: {
  isActive?: boolean
  goalId?: string
  q?: string
  limit?: number
  cursor?: string
}) {
  const query = new URLSearchParams()
  if (typeof params?.isActive === 'boolean') {
    query.set('isActive', String(params.isActive))
  }
  if (params?.goalId) query.set('goalId', params.goalId)
  if (params?.q) query.set('q', params.q)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.cursor) query.set('cursor', params.cursor)
  const suffix = query.toString()
  const response = await apiFetch(`/api/admin/courses${suffix ? `?${suffix}` : ''}`)
  return handleJson<ApiList<AdminCourse>>(response)
}

export async function createAdminCourse(payload: {
  title: string
  description?: string | null
  goalIds: string[]
  priceUsdCents: number
  isActive?: boolean
}) {
  const response = await apiFetch('/api/admin/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<AdminCourse>(response)
}

export async function patchAdminCourse(
  id: string,
  payload: {
    title?: string
    description?: string | null
    goalIds?: string[]
    priceUsdCents?: number
    isActive?: boolean
  },
) {
  const response = await apiFetch(`/api/admin/courses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<AdminCourse>(response)
}

export async function deleteAdminCourse(id: string) {
  const response = await apiFetch(`/api/admin/courses/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Delete failed')
  }
}

export async function listAdminCourseLessons(courseId: string) {
  const response = await apiFetch(`/api/admin/courses/${courseId}/lessons`)
  return handleJson<ApiList<AdminLesson>>(response)
}

export async function createAdminCourseLesson(
  courseId: string,
  payload: {
    title: string
    type: "video" | "text" | "task"
    content: string
    materialUrl?: string | null
    order?: number
    isActive?: boolean
  },
) {
  const response = await apiFetch(`/api/admin/courses/${courseId}/lessons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<AdminLesson>(response)
}

export async function patchAdminCourseLesson(
  courseId: string,
  lessonId: string,
  payload: {
    title?: string
    type?: "video" | "text" | "task"
    content?: string
    materialUrl?: string | null
    order?: number
    isActive?: boolean
  },
) {
  const response = await apiFetch(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<AdminLesson>(response)
}

export async function deleteAdminCourseLesson(courseId: string, lessonId: string) {
  const response = await apiFetch(`/api/admin/courses/${courseId}/lessons/${lessonId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Delete failed')
  }
}

export async function reorderAdminCourseLessons(
  courseId: string,
  payload: { items: { lessonId: string; order: number }[] },
) {
  const response = await apiFetch(`/api/admin/courses/${courseId}/lessons/reorder`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<{ updated: number }>(response)
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

export async function listGoalTemplateSteps(goalId: string) {
  const response = await apiFetch(`/api/admin/goals/${goalId}/template-steps`)
  return handleJson<ApiList<GoalTemplateStep>>(response)
}

export async function replaceGoalTemplateSteps(
  goalId: string,
  payload: { items: { id?: string | null; title: string; description: string; materialUrl: string; order: number }[] },
) {
  const response = await apiFetch(`/api/admin/goals/${goalId}/template-steps`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return handleJson<ApiList<GoalTemplateStep>>(response)
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

export async function updateStudent(
  uid: string,
  payload: { displayName?: string; status?: string; role?: string },
) {
  const response = await apiFetch(`/api/admin/students/${uid}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<Student>(response)
}

export async function deleteStudent(uid: string) {
  const response = await apiFetch(`/api/admin/students/${uid}`, {
    method: 'DELETE',
  })
  return handleJson<{
    deleted: string
    deletedSteps: number
    deletedCompletions: number
  }>(response)
}

export async function getStudent(uid: string) {
  const response = await apiFetch(`/api/admin/students/${uid}`)
  return handleJson<Student>(response)
}

export async function getStudentPlan(uid: string) {
  const response = await apiFetch(`/api/admin/students/${uid}/plan`)
  return handleJson<PlanResponse>(response)
}

export async function getStudentPlanSteps(uid: string) {
  const response = await apiFetch(`/api/admin/students/${uid}/plan/steps`)
  return handleJson<{ items: { stepId: string; title: string; description: string; materialUrl: string; order: number; isDone: boolean; doneAt?: unknown }[] }>(
    response,
  )
}

export async function assignPlan(
  uid: string,
  goalId: string,
  options?: { resetStepsFromGoalTemplate?: boolean; confirm?: string },
) {
  const response = await apiFetch(`/api/admin/students/${uid}/plan`, {
    method: 'POST',
    body: JSON.stringify({ goalId, ...(options ?? {}) }),
  })
  return handleJson<PlanResponse>(response)
}

export async function previewResetFromGoal(uid: string, goalId: string) {
  const response = await apiFetch(
    `/api/admin/students/${uid}/plan/preview-reset-from-goal`,
    {
      method: 'POST',
      body: JSON.stringify({ goalId }),
    },
  )
  return handleJson<PreviewResetFromGoalResponse>(response)
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

export async function deleteStudentPlanStep(uid: string, stepId: string) {
  const response = await apiFetch(
    `/api/admin/students/${uid}/plan/steps/${stepId}`,
    {
      method: 'DELETE',
    },
  )
  return handleJson<{ deleted: string }>(response)
}

export async function listStepCompletions(params?: {
  status?: 'completed' | 'revoked' | 'all'
  limit?: number
  cursor?: string
}) {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.cursor) query.set('cursor', params.cursor)
  const suffix = query.toString()
  const response = await apiFetch(
    `/api/admin/step-completions${suffix ? `?${suffix}` : ''}`,
  )
  return handleJson<ApiList<StepCompletion>>(response)
}

export async function patchStepCompletion(
  id: string,
  payload: { comment?: string | null; link?: string | null },
) {
  const response = await apiFetch(`/api/admin/step-completions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<{ status: 'updated'; id: string }>(response)
}

export async function revokeStepCompletion(id: string) {
  const response = await apiFetch(`/api/admin/step-completions/${id}/revoke`, {
    method: 'POST',
  })
  return handleJson<{ status: 'ok' }>(response)
}

export type {
  Category,
  StepTemplate,
  Student,
  PlanResponse,
  StepCompletion,
}
