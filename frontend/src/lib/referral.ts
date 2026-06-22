const STORAGE_KEY = 'storywalkers:referral'
const TTL_MS = 90 * 24 * 60 * 60 * 1000

export type CapturedReferral = {
  code: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  landingPath: string
  capturedAt: number
}

export function captureReferralFromUrl(url: URL): void {
  const code = url.searchParams.get('ref')
  if (!code || !code.trim()) return
  const payload: CapturedReferral = {
    code: code.trim().toLowerCase(),
    utmSource: url.searchParams.get('utm_source') ?? undefined,
    utmMedium: url.searchParams.get('utm_medium') ?? undefined,
    utmCampaign: url.searchParams.get('utm_campaign') ?? undefined,
    landingPath: url.pathname,
    capturedAt: Date.now(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function getStoredReferral(): CapturedReferral | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CapturedReferral
    if (!parsed.code || Date.now() - parsed.capturedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearStoredReferral(): void {
  localStorage.removeItem(STORAGE_KEY)
}
