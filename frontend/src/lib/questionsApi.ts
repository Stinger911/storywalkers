import { apiFetch } from './api'

type Question = {
  id: string
  studentUid?: string
  categoryId: string
  title: string
  body?: string | null
  status?: string
  answer?: {
    expertUid?: string
    text?: string
    videoUrl?: string | null
    createdAt?: unknown
    publishToLibrary?: boolean
  } | null
  createdAt?: unknown
  updatedAt?: unknown
}

type ApiList<T> = { items: T[]; nextCursor?: string | null }

type AnswerQuestionRequest = {
  text: string
  videoUrl?: string | null
  publishToLibrary: boolean
  library?: {
    status?: 'draft' | 'published'
    categoryId?: string
    title?: string
    content?: string
    keywords?: string[]
  } | null
}

type AnswerQuestionResponse = {
  question: {
    id: string
    status: string
    updatedAt?: unknown
  }
  libraryEntry?: {
    id: string
    status: string
  } | null
}

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error?.message ?? 'Request failed')
  }
  return response.json() as Promise<T>
}

export async function listMyQuestions() {
  const response = await apiFetch('/api/questions')
  return handleJson<ApiList<Question>>(response)
}

export async function listQuestions(params?: {
  status?: string
  categoryId?: string
  studentName?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.categoryId) query.set('categoryId', params.categoryId)
  if (params?.studentName) query.set('studentName', params.studentName)
  if (params?.limit) query.set('limit', String(params.limit))
  const suffix = query.toString()
  const response = await apiFetch(`/api/questions${suffix ? `?${suffix}` : ''}`)
  return handleJson<ApiList<Question>>(response)
}

export async function createQuestion(payload: {
  categoryId: string
  title: string
  body?: string
}) {
  const response = await apiFetch('/api/questions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<Question>(response)
}

export async function getQuestion(id: string) {
  const response = await apiFetch(`/api/questions/${id}`)
  return handleJson<Question>(response)
}

export async function answerQuestion(id: string, payload: AnswerQuestionRequest) {
  const response = await apiFetch(`/api/admin/questions/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<AnswerQuestionResponse>(response)
}

export type { Question, AnswerQuestionRequest, AnswerQuestionResponse }
