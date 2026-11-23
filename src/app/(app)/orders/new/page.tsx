'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Product } from '@/lib/types'
import { formatINR } from '@/lib/utils'
import { createOrder, getCustomersForOrderSelect, getProductsForOrderSelect } from '../actions'

interface ItemDraft {
  product_id?: string
  description: string
  qty: number
  unit_price: number
}

function NewOrderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customer_id') || ''

  const [customers, setCustomers] = useState<{ id: string; name: string; business_name: string; phone: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [customerId, setCustomerId] = useState(preselectedCustomerId)
  const [advanceAmount, setAdvanceAmount] = useState<number>(0)
  const [advanceDate, setAdvanceDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0)
  const [linkConfirmed, setLinkConfirmed] = useState<boolean>(false)
  const [notes, setNotes] = useState<string>('')
  const [items, setItems] = useState<ItemDraft[]>([
    { description: 'Classic Pro Card', qty: 1, unit_price: 980 },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function loadSelects() {
      try {
        const [cList, pList] = await Promise.all([
          getCustomersForOrderSelect(),
          getProductsForOrderSelect(),
        ])
        setCustomers(cList)
        setProducts(pList as Product[])
        if (preselectedCustomerId) {
          setCustomerId(preselectedCustomerId)
        } else if (cList.length > 0) {
          setCustomerId(cList[0].id)
        }
      } finally {
        setLoading(false)
      }
    }
    loadSelects()
  }, [preselectedCustomerId])

  function handleProductSelect(index: number, productId: string) {
    const prod = products.find((p) => p.id === productId)
    if (!prod) return
    const updated = [...items]
    updated[index] = {
      product_id: prod.id,
      description: prod.name,
      qty: updated[index].qty || 1,
      unit_price: prod.price,
    }
    setItems(updated)
  }

  function handleItemChange(index: number, field: keyof ItemDraft, val: unknown) {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      [field]: val,
    }
    setItems(updated)
  }

  function addItemRow() {
    setItems([...items, { description: '', qty: 1, unit_price: 0 }])
  }

  function removeItemRow(index: number) {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  // Calculations
  const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0)
  const grandTotal = itemsSubtotal + (Number(deliveryCharge) || 0)
  const balanceDue = grandTotal - (Number(advanceAmount) || 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (!customerId) {
      setErrorMsg('Please select a customer')
      return
    }

    if (items.length === 0 || items.some((it) => !it.description.trim() || it.qty <= 0)) {
      setErrorMsg('Please ensure all items have a description and valid quantity.')
      return
    }

    setSubmitting(true)
    try {
      const orderId = await createOrder(
        {
          customer_id: customerId,
          advance_amount: Number(advanceAmount) || 0,
          advance_date: advanceAmount > 0 ? advanceDate : undefined,
          delivery_charge: Number(deliveryCharge) || 0,
          link_confirmed: linkConfirmed,
          notes: notes.trim() || undefined,
        },
        items
      )
      router.push(`/orders/${orderId}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create order')
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted">Loading order form...</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/orders" className="text-xs text-muted hover:text-foreground">
          ← Back to Orders
        </Link>
        <span className="text-xs text-muted">Auto-numbering on save (e.g. DT-001)</span>
      </div>

      {errorMsg && (
        <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-lg text-xs">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Select */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-lime">Customer *</label>
          {customers.length === 0 ? (
            <div>
              <p className="text-xs text-muted mb-2">No customers exist yet.</p>
              <Link href="/customers" className="text-xs text-lime underline">
                Create a customer first
              </Link>
            </div>
          ) : (
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.business_name ? `(${c.business_name})` : ''} — {c.phone || 'No phone'}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-lime uppercase tracking-wider">
              Order Items
            </span>
            <button
              type="button"
              onClick={addItemRow}
              className="text-xs text-lime hover:underline px-2 py-1 bg-lime/10 rounded"
            >
              + Add Item Row
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="p-3 bg-black/60 border border-border rounded-lg space-y-2 text-xs"
              >
                <div className="flex gap-2 items-center">
                  <select
                    onChange={(e) => handleProductSelect(idx, e.target.value)}
                    value={it.product_id || ''}
                    className="flex-1 px-2.5 py-1.5 bg-black border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                  >
                    <option value="">-- Quick select product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatINR(p.price)})
                      </option>
                    ))}
                  </select>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="text-danger hover:text-danger/80 px-2 py-1"
                      title="Remove item"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    required
                    value={it.description}
                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                    placeholder="Item description"
                    className="col-span-6 px-2.5 py-1.5 bg-black border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                  <div className="col-span-2">
                    <input
                      type="number"
                      min={1}
                      required
                      value={it.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                      placeholder="Qty"
                      className="w-full px-2 py-1.5 bg-black border border-border rounded text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                  <div className="col-span-4 flex items-center gap-1">
                    <span className="text-muted">₹</span>
                    <input
                      type="number"
                      min={0}
                      required
                      value={it.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                      placeholder="Unit Price"
                      className="w-full px-2 py-1.5 bg-black border border-border rounded text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                </div>

                <div className="text-right text-[11px] text-muted">
                  Subtotal: <span className="text-foreground font-semibold">{formatINR((it.qty || 0) * (it.unit_price || 0))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Financials & Advance */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <span className="text-xs font-semibold text-lime uppercase tracking-wider block">
            Payment & Totals
          </span>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">
                Advance Paid (₹)
              </label>
              <input
                type="number"
                min={0}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
              />
              <p className="text-[10px] text-muted mt-1">
                {advanceAmount > 0 ? 'Status will start at "In Progress"' : 'Status will start at "Awaiting Advance"'}
              </p>
            </div>

            {advanceAmount > 0 && (
              <div>
                <label className="block text-xs text-muted mb-1">Advance Received Date</label>
                <input
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-muted mb-1">
                Delivery Charge (₹)
              </label>
              <input
                type="number"
                min={0}
                value={deliveryCharge}
                onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
              />
              <p className="text-[10px] text-muted mt-1">Charged at actual cost, kept separate.</p>
            </div>
          </div>

          {/* Computed Summary Box */}
          <div className="p-3 bg-black rounded-lg border border-border space-y-1.5 text-xs">
            <div className="flex justify-between text-muted">
              <span>Items Total:</span>
              <span className="text-foreground">{formatINR(itemsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Delivery Charge:</span>
              <span className="text-foreground">{formatINR(deliveryCharge)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border/60">
              <span>Grand Total:</span>
              <span className="text-lime">{formatINR(grandTotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Advance Paid:</span>
              <span className="text-foreground">{formatINR(advanceAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
              <span>Balance Due:</span>
              <span className={balanceDue > 0 ? 'text-danger' : 'text-lime'}>
                {formatINR(balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {/* Business Rule: Link confirmed checkbox */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="linkConfirmed"
              checked={linkConfirmed}
              onChange={(e) => setLinkConfirmed(e.target.checked)}
              className="w-5 h-5 accent-lime rounded mt-0.5 shrink-0"
            />
            <label htmlFor="linkConfirmed" className="text-xs text-foreground cursor-pointer">
              <span className="font-semibold block text-lime">Customer confirmed the link in writing</span>
              The link written on an NFC Link card is permanent and cannot be changed later.
            </label>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Card color preferences, print instructions..."
              className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || customers.length === 0}
          className="w-full py-3 bg-lime text-black font-bold text-sm rounded-xl hover:bg-lime-dark disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Creating Order...' : 'Create Order'}
        </button>
      </form>
    </div>
  )
}

export default function NewOrderPage() {
  return (
    <>
      <Header title="New Order" />
      <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
        <NewOrderContent />
      </Suspense>
    </>
  )
}
