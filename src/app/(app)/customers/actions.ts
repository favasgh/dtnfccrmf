'use server'

import { revalidatePath } from 'next/cache'
import { Customer, Activity, Order } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getCustomers(search?: string): Promise<(Customer & { orders_count?: number; total_spent?: number })[]> {
  const db = await readDB()
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
    const total_spent = cOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
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
  const orders = db.orders.filter((o) => o.customer_id === id)
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
  if (db.orders.some((o) => o.customer_id === id)) {
    throw new Error('Cannot delete customer with existing orders.')
  }
  db.customers = db.customers.filter((c) => c.id !== id)
  db.activities = db.activities.filter((a) => a.customer_id !== id)
  await writeDB(db)
  revalidatePath('/customers')
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
