import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'

let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

async function waitForAuthReady(timeoutMs = 5000) {
  if (auth.currentUser) return

  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    if (typeof auth.authStateReady === 'function') {
      await Promise.race<void | null>([
        auth.authStateReady(),
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), timeoutMs)
        }),
      ])
      return
    }

    await Promise.race<void | null>([
      new Promise<void>((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, () => {
          unsubscribe()
          resolve()
        })
      }),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function getIdTokenWithTimeout(timeoutMs = 5000) {
  await waitForAuthReady(timeoutMs)
  const user = auth.currentUser
  if (!user) return null
  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race<string | null>([
      user.getIdToken(),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
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
  const token = await getIdTokenWithTimeout()

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
