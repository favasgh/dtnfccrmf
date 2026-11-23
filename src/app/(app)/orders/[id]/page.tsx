'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Order, OrderItem, OrderStatus, ORDER_STATUSES, Product, Customer } from '@/lib/types'
import { formatINR, formatDate } from '@/lib/utils'
import { getOrder, updateOrder, addOrderItem, removeOrderItem, getProductsForOrderSelect } from '../actions'

const STATUS_COLORS: Record<OrderStatus, string> = {
  'Awaiting Advance': 'bg-amber-950 text-amber-300 border-amber-800',
  'In Progress': 'bg-blue-950 text-blue-300 border-blue-800',
  'At Printo': 'bg-purple-950 text-purple-300 border-purple-800',
  Ready: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  Delivered: 'bg-lime/20 text-lime border-lime/40',
  Closed: 'bg-gray-800 text-gray-300 border-gray-700',
  Cancelled: 'bg-red-950 text-red-300 border-red-800',
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<(OrderItem & { product?: Product })[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Add Item Modal / Row
  const [showAddItem, setShowAddItem] = useState(false)
  const [selectedProdId, setSelectedProdId] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newQty, setNewQty] = useState(1)
  const [newPrice, setNewPrice] = useState(0)
  const [addingItem, setAddingItem] = useState(false)

  // Checklist updates
  const [updatingChecklist, setUpdatingChecklist] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [res, pList] = await Promise.all([
        getOrder(id),
        getProductsForOrderSelect(),
      ])
      setOrder(res.order)
      setItems(res.items)
      setCustomer(res.customer)
      setProducts(pList as Product[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleStatusChange(newStatus: OrderStatus) {
    setErrorMsg('')
    setSuccessMsg('')

    // Business rule check: Work starts only after advance is paid
    if (newStatus !== 'Awaiting Advance' && newStatus !== 'Cancelled' && (order?.advance_amount || 0) <= 0) {
      setErrorMsg('⚠️ Business Rule Warning: Work cannot start and status cannot move past "Awaiting Advance" until an advance payment is recorded.')
      return
    }

    try {
      await updateOrder(id, { status: newStatus })
      setSuccessMsg(`Status updated to ${newStatus}`)
      loadData()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleUpdateField(fields: Partial<Order>) {
    setUpdatingChecklist(true)
    setErrorMsg('')
    try {
      await updateOrder(id, fields)
      loadData()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdatingChecklist(false)
    }
  }

  function handleProductPicker(prodId: string) {
    setSelectedProdId(prodId)
    const p = products.find((x) => x.id === prodId)
    if (p) {
      setNewDesc(p.name)
      setNewPrice(p.price)
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newDesc.trim()) return
    setAddingItem(true)
    try {
      await addOrderItem(id, {
        product_id: selectedProdId || undefined,
        description: newDesc.trim(),
        qty: Number(newQty) || 1,
        unit_price: Number(newPrice) || 0,
      })
      setShowAddItem(false)
      setNewDesc('')
      setNewPrice(0)
      setNewQty(1)
      setSelectedProdId('')
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setAddingItem(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!confirm('Remove this item?')) return
    try {
      await removeOrderItem(id, itemId)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Order Details" />
        <div className="p-8 text-center text-muted">Loading order...</div>
      </>
    )
  }

  if (!order) {
    return (
      <>
        <Header title="Order Not Found" />
        <div className="p-8 text-center">
          <p className="text-muted">Order could not be found.</p>
          <Link href="/orders" className="text-lime underline mt-2 inline-block">
            Back to Orders
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={`Order ${order.order_no}`} />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Navigation & Invoice Link */}
        <div className="flex justify-between items-center">
          <Link href="/orders" className="text-xs text-muted hover:text-foreground">
            ← Back to Orders
          </Link>
          <Link
            href={`/orders/${id}/invoice`}
            className="px-3 py-1.5 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark flex items-center gap-1.5"
          >
            <span>📄</span> View Printable Invoice
          </Link>
        </div>

        {errorMsg && (
          <div className="p-3 bg-danger/10 border border-danger/40 text-danger rounded-xl text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-lime/10 border border-lime text-lime rounded-xl text-xs">
            {successMsg}
          </div>
        )}

        {/* Order Header Card */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold font-mono">{order.order_no}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    STATUS_COLORS[order.status] || 'bg-card border-border'
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">Date: {formatDate(order.order_date)}</p>
              {customer && (
                <p className="text-sm text-foreground mt-2 font-medium">
                  Customer:{' '}
                  <Link href={`/customers/${customer.id}`} className="text-lime hover:underline">
                    {customer.name}
                  </Link>
                  {customer.business_name && (
                    <span className="text-muted text-xs"> ({customer.business_name})</span>
                  )}
                  {customer.phone && (
                    <span className="text-muted text-xs font-mono ml-2">· {customer.phone}</span>
                  )}
                </p>
              )}
            </div>

            {/* Change Status Dropdown */}
            <div>
              <label className="block text-[11px] text-muted mb-1">Update Status</label>
              <select
                value={order.status}
                onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                className="px-3 py-2 bg-black border border-border rounded-lg text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-lime uppercase tracking-wider">
              Order Items ({items.length})
            </h2>
            <button
              onClick={() => setShowAddItem(true)}
              className="text-xs px-2.5 py-1 bg-lime/10 text-lime rounded hover:bg-lime/20"
            >
              + Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium text-center">Qty</th>
                  <th className="pb-2 font-medium text-right">Unit Price</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                  <th className="pb-2 font-medium text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5 text-foreground font-medium">{it.description}</td>
                    <td className="py-2.5 text-center text-muted">{it.qty}</td>
                    <td className="py-2.5 text-right text-muted">{formatINR(it.unit_price)}</td>
                    <td className="py-2.5 text-right font-semibold text-foreground">
                      {formatINR(it.qty * it.unit_price)}
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        onClick={() => handleRemoveItem(it.id)}
                        className="text-danger hover:opacity-80 text-xs px-1"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Item Form Modal */}
          {showAddItem && (
            <form onSubmit={handleAddItem} className="p-3 bg-black border border-border rounded-lg space-y-2 mt-3">
              <span className="text-xs font-semibold text-lime">Add Item to Order</span>
              <div className="flex gap-2">
                <select
                  value={selectedProdId}
                  onChange={(e) => handleProductPicker(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-card border border-border rounded text-xs text-foreground"
                >
                  <option value="">Select from catalog</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatINR(p.price)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  required
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description"
                  className="col-span-6 px-2.5 py-1.5 bg-card border border-border rounded text-xs text-foreground"
                />
                <input
                  type="number"
                  min={1}
                  required
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value))}
                  placeholder="Qty"
                  className="col-span-2 px-2 py-1.5 bg-card border border-border rounded text-xs text-foreground text-center"
                />
                <input
                  type="number"
                  min={0}
                  required
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  placeholder="Price"
                  className="col-span-4 px-2 py-1.5 bg-card border border-border rounded text-xs text-foreground"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={addingItem}
                  className="px-3 py-1.5 bg-lime text-black font-semibold text-xs rounded hover:bg-lime-dark disabled:opacity-50"
                >
                  {addingItem ? 'Adding...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="px-3 py-1.5 bg-card text-muted text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Totals & Advance & Profit Summary */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Totals Breakdown */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-2 text-xs">
            <h2 className="text-xs font-semibold text-lime uppercase tracking-wider mb-2">
              Payment & Totals
            </h2>

            <div className="flex justify-between text-muted">
              <span>Items Total:</span>
              <span className="text-foreground">{formatINR(order.total_amount || 0)}</span>
            </div>

            <div className="flex justify-between items-center text-muted">
              <span>Delivery Charge:</span>
              <div className="flex items-center gap-1">
                <span>₹</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={order.delivery_charge}
                  onBlur={(e) => handleUpdateField({ delivery_charge: Number(e.target.value) || 0 })}
                  className="w-16 px-1.5 py-0.5 bg-black border border-border rounded text-right text-xs text-foreground"
                />
              </div>
            </div>

            <div className="flex justify-between text-muted pt-1 border-t border-border/40">
              <span>Advance Paid:</span>
              <div className="flex items-center gap-1">
                <span>₹</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={order.advance_amount}
                  onBlur={(e) => handleUpdateField({ advance_amount: Number(e.target.value) || 0 })}
                  className="w-20 px-1.5 py-0.5 bg-black border border-border rounded text-right text-xs text-foreground"
                />
              </div>
            </div>

            <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
              <span>Balance Due:</span>
              <span className={(order.balance_due || 0) > 0 ? 'text-danger' : 'text-lime'}>
                {formatINR(order.balance_due || 0)}
              </span>
            </div>
          </div>

          {/* Business Owner Profit Box (Visible only to you) */}
          <div className="bg-black border border-lime/30 rounded-xl p-5 space-y-2 text-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1 text-lime font-bold uppercase tracking-wider text-xs mb-1">
                <span>🔒</span> Profit on this Order (Private)
              </div>
              <p className="text-muted text-[11px]">
                Calculated from: sum of (item unit price - product cost).
              </p>

              <div className="mt-4">
                <span className="text-3xl font-bold text-lime font-mono">
                  {formatINR(order.profit || 0)}
                </span>
                <span className="block text-[11px] text-muted mt-1">
                  Margin:{' '}
                  {(order.total_amount || 0) > 0
                    ? `${(((order.profit || 0) / (order.total_amount || 1)) * 100).toFixed(0)}%`
                    : '0%'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-muted italic border-t border-border/50 pt-2">
              Only visible to you. Never included in invoices or exported to customers.
            </div>
          </div>
        </div>

        {/* Delivery & Production Checklist */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-semibold text-lime uppercase tracking-wider">
            Production & Delivery Checklist
          </h2>

          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            {/* Sent to Printo */}
            <div className="p-3 bg-black/50 border border-border rounded-lg space-y-1">
              <span className="font-medium text-foreground block">Sent to Printo</span>
              <input
                type="date"
                defaultValue={order.sent_to_printo_date || ''}
                onChange={(e) => handleUpdateField({ sent_to_printo_date: e.target.value || null })}
                className="w-full px-2 py-1 bg-black border border-border rounded text-xs text-foreground"
              />
            </div>

            {/* Card Ready */}
            <div className="p-3 bg-black/50 border border-border rounded-lg space-y-1">
              <span className="font-medium text-foreground block">Card Ready</span>
              <input
                type="date"
                defaultValue={order.card_ready_date || ''}
                onChange={(e) => handleUpdateField({ card_ready_date: e.target.value || null })}
                className="w-full px-2 py-1 bg-black border border-border rounded text-xs text-foreground"
              />
            </div>

            {/* Encoding Done */}
            <label className="p-3 bg-black/50 border border-border rounded-lg flex items-center justify-between cursor-pointer">
              <span className="font-medium text-foreground">Encoding Done</span>
              <input
                type="checkbox"
                defaultChecked={order.encoding_done}
                onChange={(e) => handleUpdateField({ encoding_done: e.target.checked })}
                className="w-4 h-4 accent-lime rounded"
              />
            </label>

            {/* Profile Ready */}
            <label className="p-3 bg-black/50 border border-border rounded-lg flex items-center justify-between cursor-pointer">
              <span className="font-medium text-foreground">Profile Ready</span>
              <input
                type="checkbox"
                defaultChecked={order.profile_ready}
                onChange={(e) => handleUpdateField({ profile_ready: e.target.checked })}
                className="w-4 h-4 accent-lime rounded"
              />
            </label>

            {/* Delivered Date */}
            <div className="p-3 bg-black/50 border border-border rounded-lg space-y-1">
              <span className="font-medium text-foreground block">Delivered Date</span>
              <input
                type="date"
                defaultValue={order.delivery_date || ''}
                onChange={(e) => handleUpdateField({ delivery_date: e.target.value || null })}
                className="w-full px-2 py-1 bg-black border border-border rounded text-xs text-foreground"
              />
            </div>

            {/* Balance Received */}
            <label className="p-3 bg-black/50 border border-border rounded-lg flex items-center justify-between cursor-pointer">
              <span className="font-medium text-foreground">Balance Received</span>
              <input
                type="checkbox"
                defaultChecked={order.balance_received}
                onChange={(e) => handleUpdateField({ balance_received: e.target.checked })}
                className="w-4 h-4 accent-lime rounded"
              />
            </label>
          </div>

          {/* Link Confirmed Checkbox */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={order.link_confirmed}
                onChange={(e) => handleUpdateField({ link_confirmed: e.target.checked })}
                className="w-4 h-4 accent-lime rounded mt-0.5"
              />
              <span className="text-xs text-foreground">
                <strong className="text-lime">Customer confirmed the link in writing.</strong>{' '}
                (Remember: link written on card cannot be changed later)
              </span>
            </label>
          </div>
        </div>
      </div>
    </>
  )
}
