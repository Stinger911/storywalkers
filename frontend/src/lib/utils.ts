import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(value?: Date | string | number | null | { toDate?: () => Date }) {
  if (!value) return ''
  const date =
    value instanceof Date
      ? value
      : typeof value === 'object' && value?.toDate
        ? value.toDate()
        : new Date(value as string | number)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

export function percent(done: number, total: number) {
  if (!total) return 0
  return Math.round((done / total) * 100)
}

export function clampText(text: string, maxLength = 80) {
  const value = text ?? ''
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

export function clampWords(text: string, maxWords = 20) {
  const value = (text ?? '').trim()
  if (!value) return ''
  const words = value.split(/\s+/)
  if (words.length <= maxWords) return value
  return `${words.slice(0, maxWords).join(' ')}…`
}
