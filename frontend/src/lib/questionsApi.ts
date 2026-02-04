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

export type { Question }
