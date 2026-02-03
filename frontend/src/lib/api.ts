import { auth } from './firebase'

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

function buildUrl(path: string) {
  const base = import.meta.env.VITE_API_BASE ?? ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${base}${path}`
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = await auth.currentUser?.getIdToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  })

  if (response.status === 401 && unauthorizedHandler) {
    unauthorizedHandler()
  }

  return response
}
