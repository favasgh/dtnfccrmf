// Shared utility functions

/** Format a number as Indian Rupees: ₹1,000 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Format a date string as DD MMM YYYY */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Format a date string as relative ("2 days ago", "today", etc.) */
export function relativeDate(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dateStr) < today
}

/** Check if a follow-up date is today */
export function isDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

/** Clean a phone number for wa.me links (strip spaces, dashes, keep +) */
export function cleanPhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, '')
}

/** Build a WhatsApp link with an optional pre-filled message */
export function waLink(phone: string, message?: string): string {
  const clean = cleanPhone(phone)
  const base = `https://wa.me/${clean.startsWith('+') ? clean.slice(1) : clean}`
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
