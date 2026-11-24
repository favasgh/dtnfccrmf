'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Order, OrderStatus, ORDER_STATUSES } from '@/lib/types'
import { formatINR, formatDate } from '@/lib/utils'
import { getOrders, deleteOrder } from './actions'

const STATUS_COLORS: Record<OrderStatus, string> = {
  'Awaiting Advance': 'bg-amber-950 text-amber-300 border-amber-800',
  'In Progress': 'bg-blue-950 text-blue-300 border-blue-800',
  'At Printo': 'bg-purple-950 text-purple-300 border-purple-800',
  Ready: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  Delivered: 'bg-lime/20 text-lime border-lime/40',
  Closed: 'bg-gray-800 text-gray-300 border-gray-700',
  Cancelled: 'bg-red-950 text-red-300 border-red-800',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const data = await getOrders(statusFilter, search)
      setOrders(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadData()
  }

  async function handleDirectDelete(e: React.MouseEvent, id: string, orderNo: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Are you sure you want to delete order ${orderNo}?`)) return
    try {
      await deleteOrder(id)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete order')
    }
  }

  return (
    <>
      <Header title="Orders" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* Search & Actions */}
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search by DT-XXX or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-lime"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-card border border-border text-sm rounded-lg hover:bg-card-hover"
            >
              Search
            </button>
          </form>

          <Link
            href="/orders/new"
            className="px-4 py-2.5 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark shrink-0 flex items-center justify-center"
          >
            + New Order
          </Link>
        </div>

        {/* Status Filters Horizontal Scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              statusFilter === 'ALL' ? 'bg-lime text-black' : 'bg-card border border-border text-muted hover:text-foreground'
            }`}
          >
            All Orders
          </button>
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                statusFilter === st ? 'bg-lime text-black' : 'bg-card border border-border text-muted hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="text-center py-12 text-muted">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <p className="text-muted text-sm">No orders found.</p>
            <Link
              href="/orders/new"
              className="mt-3 inline-block px-4 py-2 bg-lime text-black text-xs font-semibold rounded-lg hover:bg-lime-dark"
            >
              Create New Order
            </Link>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {orders.map((o) => {
              const cust = (o as unknown as { customer?: { name: string; business_name: string } }).customer
              const hasBalance = (o.balance_due || 0) > 0 && o.status !== 'Cancelled' && o.status !== 'Closed'

              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="block p-4 bg-card border border-border rounded-xl hover:border-lime/40 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground font-mono">{o.order_no}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            STATUS_COLORS[o.status] || 'bg-card border-border'
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-1 font-medium">
                        {cust?.name || 'Customer'}
                        {cust?.business_name && (
                          <span className="text-muted text-xs"> · {cust.business_name}</span>
                        )}
                      </p>
                      <span className="text-xs text-muted block mt-0.5">{formatDate(o.order_date)}</span>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-base font-bold text-foreground block">
                        {formatINR(o.total_amount || 0)}
                      </span>
                      {hasBalance && (
                        <span className="text-[11px] font-semibold text-danger block mt-0.5">
                          Due: {formatINR(o.balance_due || 0)}
                        </span>
                      )}
                      <button
                        onClick={(e) => handleDirectDelete(e, o.id, o.order_no)}
                        className="mt-2 text-xs text-muted hover:text-danger p-1 rounded hover:bg-card-hover"
                        title="Delete Order"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
