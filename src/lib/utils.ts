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

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
