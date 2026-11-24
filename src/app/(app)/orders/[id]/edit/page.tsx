'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Order, OrderItem, OrderStatus, ORDER_STATUSES, Product, Customer } from '@/lib/types'
import { formatINR } from '@/lib/utils'
import { getOrder, updateCompleteOrder, getCustomersForOrderSelect, getProductsForOrderSelect } from '../../actions'

interface ItemDraft {
  id?: string
  product_id?: string | null
  description: string
  qty: number
  unit_price: number | ''
}

export default function EditOrderPage({ params }: { params?: Promise<{ id: string }> }) {
  const routeParams = useParams()
  const id = (routeParams?.id as string) || ''
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [customers, setCustomers] = useState<{ id: string; name: string; business_name: string; phone: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Editable Bill Fields
  const [orderNo, setOrderNo] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [orderDate, setOrderDate] = useState('')
  const [status, setStatus] = useState<OrderStatus>('Awaiting Advance')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [balanceReceived, setBalanceReceived] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash' | 'upi'>('bank')
  const [linkConfirmed, setLinkConfirmed] = useState(false)
  const [advanceAmount, setAdvanceAmount] = useState<number | ''>('')
  const [advanceDate, setAdvanceDate] = useState('')
  const [deliveryCharge, setDeliveryCharge] = useState<number | ''>('')
  const [discount, setDiscount] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const [orderRes, cList, pList] = await Promise.all([
        getOrder(id),
        getCustomersForOrderSelect(),
        getProductsForOrderSelect(),
      ])

      setCustomers(cList)
      setProducts(pList as Product[])

      if (orderRes.order) {
        const o = orderRes.order
        setOrder(o)
        setOrderNo(o.order_no)
        setCustomerId(o.customer_id)
        setOrderDate(o.order_date || new Date().toISOString().split('T')[0])
        setStatus(o.status)
        setDeliveryDate(o.delivery_date || '')
        setBalanceReceived(Boolean(o.balance_received))
        setPaymentMethod(o.payment_method || 'bank')
        setLinkConfirmed(Boolean(o.link_confirmed))
        setAdvanceAmount(o.advance_amount ? o.advance_amount : '')
        setAdvanceDate(o.advance_date || '')
        setDeliveryCharge(o.delivery_charge ? o.delivery_charge : '')
        setDiscount(o.discount ? o.discount : '')
        setNotes(o.notes || '')

        if (orderRes.items && orderRes.items.length > 0) {
          setItems(
            orderRes.items.map((it) => ({
              id: it.id,
              product_id: it.product_id,
              description: it.description,
              qty: it.qty,
              unit_price: it.unit_price ? it.unit_price : '',
            }))
          )
        } else {
          setItems([{ description: 'Classic Pro Card', qty: 1, unit_price: 980 }])
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  function handleProductSelect(index: number, productId: string) {
    const prod = products.find((p) => p.id === productId)
    if (!prod) return
    const updated = [...items]
    updated[index] = {
      ...updated[index],
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
    setItems([...items, { description: '', qty: 1, unit_price: '' }])
  }

  function removeItemRow(index: number) {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  // Live Calculations
  const itemsSubtotal = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
    0
  )
  const discountVal = Number(discount) || 0
  const deliveryVal = Number(deliveryCharge) || 0
  const grandTotal = Math.max(0, itemsSubtotal + deliveryVal - discountVal)
  const isClosedOrReceived = status === 'Closed' || balanceReceived
  const balanceDue = isClosedOrReceived ? 0 : Math.max(0, grandTotal - (Number(advanceAmount) || 0))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!customerId) {
      setErrorMsg('Please select a customer')
      return
    }

    if (items.length === 0 || items.some((it) => !it.description.trim() || it.qty <= 0)) {
      setErrorMsg('Please ensure all items have a description and valid quantity.')
      return
    }

    setSaving(true)
    try {
      const targetId = await updateCompleteOrder(id, {
        order_no: orderNo.trim(),
        customer_id: customerId,
        order_date: orderDate,
        status,
        advance_amount: Number(advanceAmount) || 0,
        advance_date: advanceAmount !== '' && Number(advanceAmount) > 0 ? (advanceDate || orderDate) : null,
        discount: Number(discount) || 0,
        delivery_charge: Number(deliveryCharge) || 0,
        delivery_date: deliveryDate || null,
        balance_received: balanceReceived,
        payment_method: paymentMethod,
        link_confirmed: linkConfirmed,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          id: it.id,
          product_id: it.product_id,
          description: it.description.trim(),
          qty: Number(it.qty) || 1,
          unit_price: Number(it.unit_price) || 0,
        })),
      })

      setSuccessMsg('Complete bill saved successfully!')
      setTimeout(() => {
        router.push(`/orders/${targetId}`)
      }, 1000)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save bill')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Edit Bill" />
        <div className="p-8 text-center text-muted">Loading bill editor...</div>
      </>
    )
  }

  if (!order) {
    return (
      <>
        <Header title="Order Not Found" />
        <div className="p-8 text-center space-y-3">
          <p className="text-muted">Order could not be found to edit.</p>
          <Link href="/orders" className="text-lime underline text-xs">
            Back to Orders
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={`Edit Bill: ${order.order_no}`} />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link href={`/orders/${id}`} className="text-xs text-muted hover:text-foreground">
            ← Back to Order Details
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${id}/invoice`}
              className="text-xs text-muted hover:text-lime flex items-center gap-1"
            >
              <span>📄</span> View Printable Invoice
            </Link>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-xl text-xs font-medium">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-lime/10 border border-lime text-lime rounded-xl text-xs font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Header Information */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-bold text-sm text-lime uppercase tracking-wider border-b border-border pb-3">
              1. Bill & Customer Information
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Invoice / Order No *</label>
                <input
                  type="text"
                  required
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="e.g. DT-001"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground font-mono focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-lime"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.business_name ? `(${c.business_name})` : ''} {c.phone ? `· ${c.phone}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Bill / Order Date *</label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Order Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs font-semibold text-foreground focus:ring-1 focus:ring-lime"
                >
                  {ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
              <div>
                <label className="block text-xs text-muted mb-1">Delivery Date (Optional)</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-lime"
                />
              </div>

              <div className="flex flex-col justify-center space-y-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={balanceReceived}
                    onChange={(e) => setBalanceReceived(e.target.checked)}
                    className="accent-lime rounded"
                  />
                  <span>Balance Payment Received in Full</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkConfirmed}
                    onChange={(e) => setLinkConfirmed(e.target.checked)}
                    className="accent-lime rounded"
                  />
                  <span>Link / Profile Confirmed by Customer</span>
                </label>
              </div>
            </div>
          </div>

          {/* 2. Items Table */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="font-bold text-sm text-lime uppercase tracking-wider">
                2. Bill Line Items ({items.length})
              </h2>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1.5 bg-lime/15 text-lime hover:bg-lime/25 border border-lime/30 text-xs font-semibold rounded-lg flex items-center gap-1"
              >
                <span>+</span> Add Line Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-black/60 border border-border rounded-xl space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <select
                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                      value={it.product_id || ''}
                      className="flex-1 px-2.5 py-1.5 bg-black border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-lime"
                    >
                      <option value="">-- Quick select product from catalog --</option>
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
                        className="px-2.5 py-1 text-danger hover:bg-danger/10 border border-danger/30 rounded text-xs font-semibold"
                        title="Remove item"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-2.5 items-center">
                    <div className="col-span-12 sm:col-span-6">
                      <label className="block text-[10px] text-muted mb-0.5">Item Description *</label>
                      <input
                        type="text"
                        required
                        value={it.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="e.g. Classic Pro Card"
                        className="w-full px-2.5 py-1.5 bg-black border border-border rounded text-xs text-foreground focus:ring-1 focus:ring-lime"
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] text-muted mb-0.5 text-center">Qty</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-black border border-border rounded text-xs text-foreground text-center focus:ring-1 focus:ring-lime"
                      />
                    </div>

                    <div className="col-span-8 sm:col-span-4">
                      <label className="block text-[10px] text-muted mb-0.5">Unit Price (₹)</label>
                      <div className="flex items-center gap-1">
                        <span className="text-muted">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={it.unit_price === 0 ? '' : it.unit_price}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              'unit_price',
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          className="w-full px-2 py-1.5 bg-black border border-border rounded text-xs text-foreground focus:ring-1 focus:ring-lime"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-muted pt-1 border-t border-border/40">
                    Row Total: <span className="text-foreground font-semibold">{formatINR((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Payment & Totals */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-bold text-sm text-lime uppercase tracking-wider border-b border-border pb-3">
              3. Payment & Totals
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted mb-1">Advance Paid (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Payment Method / Account</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      paymentMethod === 'bank' || paymentMethod === 'upi'
                        ? 'bg-lime/20 border-lime text-lime'
                        : 'bg-black border-border text-muted hover:border-border/80'
                    }`}
                  >
                    <span>🏛️</span> Bank / UPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      paymentMethod === 'cash'
                        ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                        : 'bg-black border-border text-muted hover:border-border/80'
                    }`}
                  >
                    <span>💵</span> Cash in Hand
                  </button>
                </div>
              </div>

              {advanceAmount !== '' && Number(advanceAmount) > 0 && (
                <div>
                  <label className="block text-xs text-muted mb-1">Advance Received Date</label>
                  <input
                    type="date"
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-lime"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1">Delivery Charge (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={deliveryCharge}
                  onChange={(e) => setDeliveryCharge(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-lime"
                />
                <p className="text-[10px] text-muted mt-1">Charged at actual cost, kept separate.</p>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Discount (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:ring-1 focus:ring-lime"
                />
                <p className="text-[10px] text-muted mt-1">Direct discount deducted from grand total.</p>
              </div>
            </div>

            {/* Live Summary Box */}
            <div className="p-4 bg-black rounded-xl border border-border space-y-2 text-xs">
              <div className="flex justify-between text-muted">
                <span>Items Subtotal:</span>
                <span className="text-foreground">{formatINR(itemsSubtotal)}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Discount:</span>
                  <span className="text-foreground">-{formatINR(discountVal)}</span>
                </div>
              )}
              {deliveryVal > 0 && (
                <div className="flex justify-between text-muted">
                  <span>Delivery Charge:</span>
                  <span className="text-foreground">{formatINR(deliveryVal)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-border/60">
                <span>Grand Total:</span>
                <span className="text-lime">{formatINR(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Advance Paid:</span>
                <span className="text-foreground">{formatINR(Number(advanceAmount) || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                <span>Balance Due:</span>
                <span className={balanceDue > 0 ? 'text-danger' : 'text-lime'}>
                  {isClosedOrReceived ? (
                    <span className="text-lime flex items-center gap-1 font-bold">
                      <span>✓</span> ₹0 (Full Amount Received)
                    </span>
                  ) : (
                    formatINR(balanceDue)
                  )}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Bill Notes / Instructions</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special notes or customer instructions on this bill..."
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:ring-1 focus:ring-lime"
              />
            </div>
          </div>

          {/* 4. Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/orders/${id}`}
              className="px-5 py-2.5 bg-card border border-border text-foreground hover:bg-card-hover rounded-xl text-xs font-semibold"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-lime text-black font-bold text-sm rounded-xl hover:bg-lime-dark disabled:opacity-50 shadow-lg flex items-center gap-2"
            >
              <span>💾</span> {saving ? 'Saving Bill...' : 'Save Complete Bill'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
