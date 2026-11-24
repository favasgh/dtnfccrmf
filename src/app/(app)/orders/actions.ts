'use server'

import { revalidatePath } from 'next/cache'
import { Order, OrderItem, OrderStatus, Product, Customer } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

function computeOrderTotals(order: Order, items: OrderItem[], products: Product[]): Order {
  const orderItems = items.filter((it) => it.order_id === order.id)
  const total_amount = orderItems.reduce((sum, it) => sum + (it.qty * it.unit_price), 0)
  const balance_due = total_amount + (order.delivery_charge || 0) - (order.advance_amount || 0)
  const profit = orderItems.reduce((sum, it) => {
    const prod = products.find((p) => p.id === it.product_id)
    const cost = prod ? prod.my_cost : 0
    return sum + (it.qty * (it.unit_price - cost))
  }, 0)

  return {
    ...order,
    total_amount,
    balance_due,
    profit,
  }
}

export async function getOrders(statusFilter?: string, search?: string): Promise<Order[]> {
  const db = await readDB()
  let list = db.orders.map((o) => {
    const enriched = computeOrderTotals(o, db.order_items, db.products)
    const cust = db.customers.find((c) => c.id === o.customer_id)
    return {
      ...enriched,
      customer: cust ? { name: cust.name, business_name: cust.business_name || '', phone: cust.phone || '' } : undefined,
    }
  })

  if (statusFilter && statusFilter !== 'ALL') {
    list = list.filter((o) => o.status === statusFilter)
  }

  if (search?.trim()) {
    const s = search.trim().toLowerCase()
    list = list.filter((o) => {
      const cust = (o as unknown as { customer?: { name: string; business_name: string } }).customer
      return (
        o.order_no.toLowerCase().includes(s) ||
        cust?.name.toLowerCase().includes(s) ||
        cust?.business_name.toLowerCase().includes(s)
      )
    })
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function getOrder(id: string): Promise<{
  order: Order | null
  items: (OrderItem & { product?: Product })[]
  customer: Customer | null
}> {
  const db = await readDB()
  const rawOrder = db.orders.find((o) => o.id === id)
  if (!rawOrder) return { order: null, items: [], customer: null }

  const order = computeOrderTotals(rawOrder, db.order_items, db.products)
  const items = db.order_items
    .filter((it) => it.order_id === id)
    .map((it) => ({
      ...it,
      product: db.products.find((p) => p.id === it.product_id),
    }))
  const customer = db.customers.find((c) => c.id === order.customer_id) || null

  return {
    order,
    items,
    customer,
  }
}

export async function createOrder(
  orderData: {
    customer_id: string
    advance_amount: number
    advance_date?: string
    delivery_charge: number
    link_confirmed: boolean
    notes?: string
  },
  items: {
    product_id?: string
    description: string
    qty: number
    unit_price: number
  }[]
): Promise<string> {
  const db = await readDB()
  db.order_counter = (db.order_counter || 0) + 1
  const order_no = `DT-${String(db.order_counter).padStart(3, '0')}`

  const initialStatus: OrderStatus = orderData.advance_amount > 0 ? 'In Progress' : 'Awaiting Advance'
  const newOrder: Order = {
    id: `order_${Date.now()}`,
    user_id: 'owner',
    order_no,
    customer_id: orderData.customer_id,
    order_date: new Date().toISOString().split('T')[0],
    status: initialStatus,
    advance_amount: orderData.advance_amount,
    advance_date: orderData.advance_amount > 0 ? (orderData.advance_date || new Date().toISOString().split('T')[0]) : null,
    delivery_charge: orderData.delivery_charge,
    sent_to_printo_date: null,
    card_ready_date: null,
    encoding_done: false,
    profile_ready: false,
    delivery_date: null,
    balance_received: false,
    link_confirmed: orderData.link_confirmed,
    notes: orderData.notes || null,
    created_at: new Date().toISOString(),
  }

  db.orders.unshift(newOrder)

  items.forEach((it, idx) => {
    db.order_items.push({
      id: `item_${Date.now()}_${idx}`,
      user_id: 'owner',
      order_id: newOrder.id,
      product_id: it.product_id || null,
      description: it.description,
      qty: it.qty,
      unit_price: it.unit_price,
      created_at: new Date().toISOString(),
    })
  })

  db.activities.unshift({
    id: `act_${Date.now()}`,
    user_id: 'owner',
    customer_id: orderData.customer_id,
    lead_id: null,
    type: 'note',
    text: `Created order ${order_no} with ${items.length} item(s)`,
    created_at: new Date().toISOString(),
  })

  await writeDB(db)
  revalidatePath('/orders')
  revalidatePath('/dashboard')
  return newOrder.id
}

export async function updateOrder(id: string, updates: Partial<Order>) {
  const db = await readDB()
  const idx = db.orders.findIndex((o) => o.id === id)
  if (idx === -1) throw new Error('Order not found')

  const current = db.orders[idx]

  // Business rule check:
  if (updates.status && updates.status !== 'Awaiting Advance' && updates.status !== 'Cancelled') {
    const effAdvance = updates.advance_amount !== undefined ? updates.advance_amount : current.advance_amount || 0
    if (effAdvance <= 0) {
      throw new Error('Business Rule: Work starts only after advance payment. Cannot move past Awaiting Advance until advance is recorded.')
    }
  }

  db.orders[idx] = { ...current, ...updates }
  await writeDB(db)

  revalidatePath('/orders')
  revalidatePath(`/orders/${id}`)
  revalidatePath('/dashboard')
}

export async function addOrderItem(
  orderId: string,
  item: { product_id?: string; description: string; qty: number; unit_price: number }
) {
  const db = await readDB()
  db.order_items.push({
    id: `item_${Date.now()}`,
    user_id: 'owner',
    order_id: orderId,
    product_id: item.product_id || null,
    description: item.description,
    qty: item.qty,
    unit_price: item.unit_price,
    created_at: new Date().toISOString(),
  })
  await writeDB(db)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
}

export async function deleteOrder(id: string) {
  const db = await readDB()
  db.orders = db.orders.filter((o) => o.id !== id)
  db.order_items = db.order_items.filter((it) => it.order_id !== id)
  await writeDB(db)
  revalidatePath('/orders')
  revalidatePath('/dashboard')
  revalidatePath('/accounts')
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  updates: {
    description?: string
    qty?: number
    unit_price?: number
    product_id?: string | null
  }
) {
  const db = await readDB()
  const idx = db.order_items.findIndex((it) => it.id === itemId && it.order_id === orderId)
  if (idx === -1) throw new Error('Item not found')

  db.order_items[idx] = {
    ...db.order_items[idx],
    ...updates,
  }
  await writeDB(db)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  revalidatePath('/dashboard')
}

export async function removeOrderItem(orderId: string, itemId: string) {
  const db = await readDB()
  db.order_items = db.order_items.filter((it) => it.id !== itemId)
  await writeDB(db)
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
}

export async function getLeadDetailsForOrder(leadId: string) {
  const db = await readDB()
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) return null

  // Find or create customer
  let cust = db.customers.find(
    (c) => c.lead_id === leadId || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
  )

  if (!cust) {
    cust = {
      id: `cust_${Date.now()}`,
      user_id: 'owner',
      name: lead.name,
      business_name: lead.business_name,
      phone: lead.phone,
      email: null,
      address: null,
      lead_id: lead.id,
      notes: lead.notes,
      created_at: new Date().toISOString(),
    }
    db.customers.unshift(cust)
    lead.stage = 'Won'
    await writeDB(db)
  }

  return {
    customerId: cust.id,
    customerName: cust.name,
    customerBusiness: cust.business_name || '',
    leadName: lead.name,
    interestedProduct: lead.interested_product,
    notes: lead.notes || '',
  }
}

export async function getCustomersForOrderSelect() {
  const db = await readDB()
  return db.customers.map((c) => ({
    id: c.id,
    name: c.name,
    business_name: c.business_name || '',
    phone: c.phone || '',
  }))
}

export async function getProductsForOrderSelect() {
  const db = await readDB()
  return db.products.filter((p) => p.active)
}
