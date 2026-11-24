'use server'

import { revalidatePath } from 'next/cache'
import { Customer, Activity, Order } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getCustomers(search?: string): Promise<(Customer & { orders_count?: number; total_spent?: number })[]> {
  const db = await readDB()

  // Auto-sync won leads into customers if not already present
  let modified = false
  const wonLeads = db.leads.filter((l) => l.stage === 'Won')
  for (const lead of wonLeads) {
    const existing = db.customers.find(
      (c) => c.lead_id === lead.id || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
    )
    if (!existing) {
      const newCust: Customer = {
        id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: 'owner',
        name: lead.name,
        business_name: lead.business_name,
        phone: lead.phone,
        email: null,
        address: null,
        lead_id: lead.id,
        notes: lead.notes,
        created_at: lead.created_at || new Date().toISOString(),
      }
      db.customers.unshift(newCust)
      db.activities.unshift({
        id: `act_${Date.now()}`,
        user_id: 'owner',
        customer_id: newCust.id,
        lead_id: null,
        type: 'note',
        text: `Customer auto-synced from Won lead (${lead.name})`,
        created_at: new Date().toISOString(),
      })
      modified = true
    } else if (!existing.lead_id) {
      existing.lead_id = lead.id
      modified = true
    }
  }

  if (modified) {
    await writeDB(db)
  }

  let list = [...db.customers]

  if (search?.trim()) {
    const s = search.trim().toLowerCase()
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.business_name?.toLowerCase().includes(s) ||
        c.phone?.toLowerCase().includes(s)
    )
  }

  return list.map((c) => {
    const cOrders = db.orders.filter((o) => o.customer_id === c.id && o.status !== 'Cancelled')
    const total_spent = cOrders.reduce((sum, o) => {
      const oItems = db.order_items.filter((it) => it.order_id === o.id)
      const itemsTotal = oItems.reduce((s, it) => s + (it.qty * it.unit_price), 0)
      return sum + itemsTotal + (o.delivery_charge || 0)
    }, 0)
    return {
      ...c,
      orders_count: cOrders.length,
      total_spent,
    }
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getCustomer(id: string): Promise<{
  customer: Customer | null
  orders: Order[]
  activities: Activity[]
}> {
  const db = await readDB()
  const customer = db.customers.find((c) => c.id === id) || null
  const orders = db.orders
    .filter((o) => o.customer_id === id)
    .map((o) => {
      const orderItems = db.order_items.filter((it) => it.order_id === o.id)
      const itemsTotal = orderItems.reduce((sum, it) => sum + (it.qty * it.unit_price), 0)
      const grandTotal = Math.max(0, itemsTotal + (o.delivery_charge || 0) - (o.discount || 0))
      const isClosedOrReceived = o.status === 'Closed' || Boolean(o.balance_received)
      const balanceDue = isClosedOrReceived ? 0 : Math.max(0, grandTotal - (o.advance_amount || 0))
      return {
        ...o,
        balance_received: isClosedOrReceived,
        total_amount: grandTotal,
        balance_due: balanceDue,
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const activities = db.activities.filter((a) => a.customer_id === id)

  return {
    customer,
    orders,
    activities,
  }
}

export async function createCustomer(formData: {
  name: string
  business_name?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}) {
  if (!formData.name?.trim()) throw new Error('Name is required')

  const db = await readDB()
  const newCust: Customer = {
    id: `cust_${Date.now()}`,
    user_id: 'owner',
    name: formData.name.trim(),
    business_name: formData.business_name || null,
    phone: formData.phone || null,
    email: formData.email || null,
    address: formData.address || null,
    lead_id: null,
    notes: formData.notes || null,
    created_at: new Date().toISOString(),
  }

  db.customers.unshift(newCust)
  await writeDB(db)
  revalidatePath('/customers')
  return newCust
}

export async function updateCustomer(id: string, updates: Partial<Customer>) {
  const db = await readDB()
  const idx = db.customers.findIndex((c) => c.id === id)
  if (idx !== -1) {
    db.customers[idx] = { ...db.customers[idx], ...updates }
    await writeDB(db)
  }
  revalidatePath('/customers')
  revalidatePath(`/customers/${id}`)
}

export async function deleteCustomer(id: string) {
  const db = await readDB()
  const cust = db.customers.find((c) => c.id === id)
  if (cust?.lead_id) {
    const linkedLead = db.leads.find((l) => l.id === cust.lead_id)
    if (linkedLead && linkedLead.stage === 'Won') {
      linkedLead.stage = 'Lost'
    }
  }

  const custOrders = db.orders.filter((o) => o.customer_id === id)
  const orderIds = custOrders.map((o) => o.id)
  db.order_items = db.order_items.filter((it) => !orderIds.includes(it.order_id))
  db.orders = db.orders.filter((o) => o.customer_id !== id)
  db.customers = db.customers.filter((c) => c.id !== id)
  db.activities = db.activities.filter((a) => a.customer_id !== id)
  await writeDB(db)
  revalidatePath('/customers')
  revalidatePath('/leads')
  revalidatePath('/orders')
  revalidatePath('/dashboard')
}

export async function addCustomerActivity(customerId: string, type: Activity['type'], text: string) {
  const db = await readDB()
  db.activities.unshift({
    id: `act_${Date.now()}`,
    user_id: 'owner',
    lead_id: null,
    customer_id: customerId,
    type,
    text,
    created_at: new Date().toISOString(),
  })
  await writeDB(db)
  revalidatePath(`/customers/${customerId}`)
}
