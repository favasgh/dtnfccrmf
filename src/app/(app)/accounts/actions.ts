'use server'

import { revalidatePath } from 'next/cache'
import { Transaction, TransactionType } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getTransactions(filters?: {
  type?: string
  category?: string
  search?: string
}): Promise<Transaction[]> {
  const db = await readDB()
  let list = [...(db.transactions || [])]

  if (filters?.type && filters.type !== 'ALL') {
    list = list.filter((t) => t.type === filters.type)
  }

  if (filters?.category && filters.category !== 'ALL') {
    list = list.filter((t) => t.category === filters.category)
  }

  if (filters?.search?.trim()) {
    const s = filters.search.trim().toLowerCase()
    list = list.filter(
      (t) =>
        t.description.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s)
    )
  }

  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function addTransaction(formData: {
  type: TransactionType
  category: string
  amount: number
  date: string
  payment_method: 'upi' | 'bank' | 'cash'
  description: string
}) {
  if (!formData.amount || formData.amount <= 0) {
    throw new Error('Amount must be greater than 0')
  }
  if (!formData.description?.trim()) {
    throw new Error('Description is required')
  }

  const db = await readDB()
  if (!db.transactions) db.transactions = []

  const newTx: Transaction = {
    id: `tx_${Date.now()}`,
    user_id: 'owner',
    type: formData.type,
    category: formData.category || 'other',
    amount: Number(formData.amount),
    date: formData.date || new Date().toISOString().split('T')[0],
    payment_method: formData.payment_method || 'upi',
    description: formData.description.trim(),
    created_at: new Date().toISOString(),
  }

  db.transactions.unshift(newTx)
  await writeDB(db)
  revalidatePath('/accounts')
  revalidatePath('/dashboard')
  return newTx
}

export async function updateTransaction(
  id: string,
  formData: {
    type?: TransactionType
    category?: string
    amount?: number
    date?: string
    payment_method?: 'upi' | 'bank' | 'cash'
    description?: string
  }
) {
  const db = await readDB()
  if (!db.transactions) db.transactions = []
  const idx = db.transactions.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error('Transaction not found')

  const current = db.transactions[idx]
  db.transactions[idx] = {
    ...current,
    type: formData.type || current.type,
    category: formData.category !== undefined ? formData.category : current.category,
    amount: formData.amount !== undefined ? Number(formData.amount) : current.amount,
    date: formData.date || current.date,
    payment_method: formData.payment_method || current.payment_method,
    description: formData.description !== undefined ? formData.description.trim() : current.description,
  }

  await writeDB(db)
  revalidatePath('/accounts')
  revalidatePath('/dashboard')
}

export async function deleteTransaction(id: string) {
  const db = await readDB()
  if (db.transactions) {
    db.transactions = db.transactions.filter((t) => t.id !== id)
    await writeDB(db)
  }
  revalidatePath('/accounts')
  revalidatePath('/dashboard')
}

export interface SalesSummaryItem {
  id: string
  order_no: string
  customer_name: string
  customer_business?: string
  order_date: string
  status: string
  total_amount: number
  advance_amount: number
  balance_due: number
  balance_received: boolean
  items_summary: string
}

export async function getFinancialSummary() {
  const db = await readDB()

  let totalSales = 0
  let totalOrdersCount = 0
  let orderCashInflow = 0
  let pendingReceivables = 0
  const salesOrders: SalesSummaryItem[] = []

  db.orders.forEach((o) => {
    if (o.status === 'Cancelled') return
    const orderItems = db.order_items.filter((it) => it.order_id === o.id)
    const itemsTotal = orderItems.reduce((sum, it) => sum + (it.qty * it.unit_price), 0)
    const grandTotal = Math.max(0, itemsTotal + (o.delivery_charge || 0) - (o.discount || 0))
    const advance = o.advance_amount || 0
    const isClosedOrReceived = o.status === 'Closed' || Boolean(o.balance_received)
    const balance = isClosedOrReceived ? 0 : Math.max(0, grandTotal - advance)

    totalSales += grandTotal
    totalOrdersCount += 1

    if (isClosedOrReceived) {
      orderCashInflow += grandTotal
    } else {
      orderCashInflow += advance
      pendingReceivables += balance
    }

    const cust = db.customers.find((c) => c.id === o.customer_id)
    const itemsDesc = orderItems.map((it) => `${it.qty}x ${it.description}`).join(', ')

    salesOrders.push({
      id: o.id,
      order_no: o.order_no,
      customer_name: cust?.name || 'Customer',
      customer_business: cust?.business_name || undefined,
      order_date: o.order_date,
      status: o.status,
      total_amount: grandTotal,
      advance_amount: advance,
      balance_due: balance,
      balance_received: isClosedOrReceived,
      items_summary: itemsDesc || 'Card Order',
    })
  })

  // Sort sales orders newest first
  salesOrders.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())

  // 2. Direct transactions
  const txs = db.transactions || []
  const directIncome = txs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = txs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalInflow = orderCashInflow + directIncome
  const netCashFlow = totalInflow - totalExpenses

  // Category breakdown for expenses
  const categoryBreakdown: Record<string, number> = {}
  txs.filter((t) => t.type === 'expense').forEach((t) => {
    categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount
  })

  return {
    totalSales,
    totalOrdersCount,
    orderCashInflow,
    directIncome,
    totalInflow,
    totalExpenses,
    netCashFlow,
    pendingReceivables,
    categoryBreakdown,
    salesOrders,
  }
}
