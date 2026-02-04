import { apiFetch } from './api'

type LibraryEntrySummary = {
  id: string
  categoryId: string
  title: string
  status: string
  updatedAt?: unknown
}

type LibraryEntry = {
  id: string
  categoryId: string
  title: string
  titleLower?: string | null
  content: string
  videoUrl?: string | null
  status: string
  keywords?: string[] | null
  sourceQuestionId?: string | null
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

export async function listLibrary(params?: {
  categoryId?: string
  q?: string
  status?: string
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params?.categoryId) query.set('categoryId', params.categoryId)
  if (params?.q) query.set('q', params.q)
  if (params?.status) query.set('status', params.status)
  if (params?.limit) query.set('limit', String(params.limit))
  const suffix = query.toString()
  const response = await apiFetch(`/api/library${suffix ? `?${suffix}` : ''}`)
  return handleJson<ApiList<LibraryEntrySummary>>(response)
}

export async function getLibraryEntry(id: string) {
  const response = await apiFetch(`/api/library/${id}`)
  return handleJson<LibraryEntry>(response)
}

export async function createLibraryEntry(payload: {
  categoryId: string
  title: string
  content: string
  videoUrl?: string | null
  status: 'draft' | 'published'
  keywords?: string[]
}) {
  const response = await apiFetch('/api/admin/library', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return handleJson<LibraryEntrySummary & { createdAt?: unknown }>(response)
}

export async function updateLibraryEntry(
  id: string,
  payload: {
    categoryId?: string
    title?: string
    content?: string
    videoUrl?: string | null
    status?: 'draft' | 'published'
    keywords?: string[]
  },
) {
  const response = await apiFetch(`/api/admin/library/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return handleJson<{ id: string; status: string; updatedAt?: unknown }>(response)
}

export type { LibraryEntry, LibraryEntrySummary }
