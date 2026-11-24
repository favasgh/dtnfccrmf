// ============================================================
// TypeScript types for the Double Tap CRM
// These mirror the Supabase database tables.
// ============================================================

export type ProductCategory = 'card' | 'service'

export type LeadSource = 'instagram' | 'google_maps' | 'referral' | 'meta_ad' | 'walk_in' | 'other' | (string & {})

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Replied'
  | 'Interested'
  | 'Sample Shown'
  | 'Negotiating'
  | 'Won'
  | 'Lost'
  | 'Follow Up Later'

export const LEAD_STAGES: LeadStage[] = [
  'New', 'Contacted', 'Replied', 'Interested',
  'Sample Shown', 'Negotiating', 'Won', 'Lost', 'Follow Up Later',
]

export const LEAD_SOURCES: LeadSource[] = [
  'instagram', 'google_maps', 'referral', 'meta_ad', 'walk_in', 'other',
]

export type OrderStatus =
  | 'Awaiting Advance'
  | 'In Progress'
  | 'At Printo'
  | 'Ready'
  | 'Delivered'
  | 'Closed'
  | 'Cancelled'

export const ORDER_STATUSES: OrderStatus[] = [
  'Awaiting Advance', 'In Progress', 'At Printo',
  'Ready', 'Delivered', 'Closed', 'Cancelled',
]

export type ActivityType = 'call' | 'whatsapp' | 'note' | 'follow_up'

// ---------- Table row types ----------

export interface Product {
  id: string
  user_id: string
  name: string
  price: number
  my_cost: number
  category: ProductCategory
  active: boolean
  created_at: string
}

export interface Lead {
  id: string
  user_id: string
  name: string
  business_name: string | null
  business_type: string | null
  phone: string | null
  source: LeadSource | null
  stage: LeadStage
  interested_product: string | null
  objection: string | null
  notes: string | null
  next_follow_up_date: string | null
  created_at: string
}

export interface Customer {
  id: string
  user_id: string
  name: string
  business_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  lead_id: string | null
  notes: string | null
  created_at: string
}

export interface Order {
  id: string
  user_id: string
  order_no: string
  customer_id: string
  order_date: string
  status: OrderStatus
  advance_amount: number
  advance_date: string | null
  discount?: number
  delivery_charge: number
  sent_to_printo_date: string | null
  card_ready_date: string | null
  encoding_done: boolean
  profile_ready: boolean
  delivery_date: string | null
  balance_received: boolean
  link_confirmed: boolean
  notes: string | null
  created_at: string
  // Computed from the view (orders_with_totals)
  total_amount?: number
  balance_due?: number
  profit?: number
}

export interface OrderItem {
  id: string
  user_id: string
  order_id: string
  product_id: string | null
  description: string
  qty: number
  unit_price: number
  created_at: string
  // Computed client-side
  amount?: number
  // Joined
  product?: Product
}

export interface Activity {
  id: string
  user_id: string
  lead_id: string | null
  customer_id: string | null
  type: ActivityType
  text: string
  created_at: string
}

export interface Settings {
  id: string
  user_id: string
  data: {
    business_name?: string
    business_phone?: string
    business_email?: string
    business_address?: string
    business_city?: string
    payment_details?: string   // Bank/UPI info shown on invoices
    bank_account_no?: string
    bank_ifsc?: string
    bank_holder_name?: string
    google_pay_number?: string
    invoice_prefix?: string
  }
  updated_at: string
}

export interface WhatsAppTemplate {
  id: string
  user_id: string
  name: string
  template: string
  created_at: string
}

export type TransactionType = 'income' | 'expense'

export type ExpenseCategory =
  | 'printo'
  | 'raw_materials'
  | 'packaging'
  | 'delivery'
  | 'marketing'
  | 'tools_software'
  | 'personal_draw'
  | 'other'

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'printo', label: 'Printo / UV Printing' },
  { id: 'raw_materials', label: 'Blank Cards & Chips' },
  { id: 'packaging', label: 'Packaging & Pouches' },
  { id: 'delivery', label: 'Courier & Delivery' },
  { id: 'marketing', label: 'Meta Ads & Marketing' },
  { id: 'tools_software', label: 'Software & Tools' },
  { id: 'personal_draw', label: 'Personal Draw / Salary' },
  { id: 'other', label: 'Other / Miscellaneous' },
]

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  category: string
  amount: number
  date: string
  payment_method: 'upi' | 'bank' | 'cash'
  description: string
  order_id?: string | null
  created_at: string
}

// ---------- Seed data ----------

export const SEED_PRODUCTS: Omit<Product, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Blank Card', price: 80, my_cost: 60, category: 'card', active: true },
  { name: 'UV Printing', price: 100, my_cost: 60, category: 'service', active: true },
  { name: 'Manufactured Card', price: 200, my_cost: 150, category: 'card', active: true },
  { name: 'Encoding', price: 300, my_cost: 0, category: 'service', active: true },
  { name: 'Custom Profile', price: 800, my_cost: 0, category: 'service', active: true },
  { name: 'Classic Link', price: 480, my_cost: 120, category: 'card', active: true },
  { name: 'Classic Pro', price: 980, my_cost: 120, category: 'card', active: true },
  { name: 'Signature Link', price: 500, my_cost: 150, category: 'card', active: true },
  { name: 'Signature Pro', price: 1000, my_cost: 150, category: 'card', active: true },
]

export const SEED_WA_TEMPLATES: Omit<WhatsAppTemplate, 'id' | 'user_id' | 'created_at'>[] = [
  {
    name: 'Intro',
    template:
      'Hi {name}, this is Muhammed from Double Tap. We make NFC smart cards: one tap opens your Google reviews, Instagram or a full profile. No yearly fee. I\'ve attached our brochure. Which card suits {business}?',
  },
  {
    name: 'Follow-up',
    template:
      'Hi {name}, just checking if you had a chance to look at the Double Tap brochure.',
  },
  {
    name: 'Advance request',
    template:
      'Thanks {name}! To start your order, please pay the advance of ₹{advance}. Work starts after the advance payment.',
  },
]
