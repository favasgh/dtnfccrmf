// Shared utility functions

/** Format a number as Indian Rupees: ₹1,000 */
export function formatINR(amount: number): string {
  const val = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val)
}

/** Format a date string as DD MMM YYYY */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Format a date string as relative ("2 days ago", "today", etc.) */
export function relativeDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return '—'
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return formatDate(dateStr)
}

/** Check if a follow-up date is overdue */
export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

/** Check if a follow-up date is today */
export function isDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

/** Clean a phone number for wa.me links (strip spaces, dashes, prepend India 91 if 10-digit) */
export function cleanPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '')
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = `91${cleaned}`
  }
  return cleaned
}

/** Build a WhatsApp link with an optional pre-filled message */
export function waLink(phone: string, message?: string): string {
  const clean = cleanPhone(phone)
  const base = `https://wa.me/${clean}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

/** Fill template variables: {name}, {business}, {advance} */
export function fillTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

/** Validate Indian phone number (10 digits, optionally prefixed with +91) */
export function isValidPhone(phone: string): boolean {
  return /^(\+91)?[6-9]\d{9}$/.test(phone.replace(/[\s\-]/g, ''))
}

/** Generate a class string from conditional classes */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
