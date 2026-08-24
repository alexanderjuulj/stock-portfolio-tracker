export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>

/**
 * Join class names, skipping falsy values. Accepts strings, arrays, and
 * `{ className: condition }` objects (a minimal clsx replacement).
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = []
  for (const input of inputs) {
    if (!input && input !== 0) continue
    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input))
    } else if (Array.isArray(input)) {
      const nested = cn(...input)
      if (nested) classes.push(nested)
    } else if (typeof input === 'object') {
      for (const [key, condition] of Object.entries(input)) {
        if (condition) classes.push(key)
      }
    }
  }
  return classes.join(' ')
}

export function formatPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('et-EE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatSignedPrice(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('et-EE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    signDisplay: 'exceptZero',
  }).format(amount)
}

export function formatNumber(amount: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat('et-EE', {
    maximumFractionDigits: maxFractionDigits,
  }).format(amount)
}

/** `value` is 0–100, not a fraction: formatPercent(12.5) → "12,50%". */
export function formatPercent(value: number, signed = false): string {
  return new Intl.NumberFormat('et-EE', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value / 100)
}

/** Today's local date as YYYY-MM-DD (for date inputs). */
export function todayIsoDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Formats a YYYY-MM-DD date as a short local date, e.g. "23.08.2026". */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
