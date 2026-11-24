'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Order, OrderItem, Customer, Settings } from '@/lib/types'
import { formatINR, formatDate } from '@/lib/utils'
import { getOrder } from '../../actions'
import { getSettings } from '../../../settings/actions'

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [settings, setSettings] = useState<Settings['data']>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadInvoiceData() {
      try {
        const [res, st] = await Promise.all([
          getOrder(id),
          getSettings(),
        ])
        setOrder(res.order)
        setItems(res.items)
        setCustomer(res.customer)
        if (st) setSettings(st)
      } finally {
        setLoading(false)
      }
    }
    loadInvoiceData()
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-muted">Generating invoice...</div>
  }

  if (!order || !customer) {
    return <div className="p-8 text-center text-muted">Order or Customer not found.</div>
  }

  const itemsSubtotal = items.reduce((sum, it) => sum + (it.qty || 0) * (it.unit_price || 0), 0)
  const deliveryCharge = order.delivery_charge || 0
  const grandTotal = itemsSubtotal + deliveryCharge
  const advancePaid = order.advance_amount || 0
  const balanceDue = Math.max(0, grandTotal - advancePaid)

  return (
    <div className="min-h-screen bg-black text-foreground md:py-8">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print max-w-[210mm] mx-auto px-4 mb-4 flex items-center justify-between">
        <Link href={`/orders/${id}`} className="text-xs text-muted hover:text-foreground">
          ← Back to Order
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-lime text-black font-bold text-xs rounded-lg hover:bg-lime-dark flex items-center gap-1.5 shadow"
        >
          <span>🖨️</span> Print / Save as PDF
        </button>
      </div>

      {/* Printable A4 Sheet */}
      <div className="max-w-[210mm] mx-auto bg-white text-black p-8 md:p-12 shadow-2xl rounded-sm print:shadow-none print:p-0 min-h-[297mm] flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6">
            <div>
              <div className="text-2xl font-black tracking-tight text-black">
                <span className="text-[#84ab00]">DOUBLE</span> TAP
              </div>
              <p className="text-xs text-gray-500 font-semibold tracking-wider uppercase mt-0.5">
                Create. Code. Connect.
              </p>
              <p className="text-xs text-gray-600 mt-2">
                NFC Smart Business Cards · Calicut, Kerala
              </p>
              <p className="text-xs text-gray-600">WhatsApp: +91 8304830149 · @doubletapnfc</p>
            </div>

            <div className="text-right">
              <h1 className="text-3xl font-black tracking-tight text-gray-900">INVOICE</h1>
              <div className="mt-2 text-xs space-y-0.5 text-gray-600 font-mono">
                <p>
                  <strong className="text-gray-900">Invoice No:</strong> {order.order_no}
                </p>
                <p>
                  <strong className="text-gray-900">Issue Date:</strong> {formatDate(order.order_date)}
                </p>
                <p>
                  <strong className="text-gray-900">Due Date:</strong> {formatDate(order.order_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Lime Rounded Container with Bill To & From */}
          <div className="bg-[#C5FF00] rounded-xl p-5 text-black grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-black tracking-wider uppercase text-gray-900 mb-1">
                Bill To:
              </h3>
              <p className="font-bold text-base">{customer.name}</p>
              {customer.business_name && (
                <p className="text-xs font-medium">{customer.business_name}</p>
              )}
              {customer.phone && <p className="text-xs">{customer.phone}</p>}
              {customer.email && <p className="text-xs">{customer.email}</p>}
              {customer.address && <p className="text-xs mt-0.5">{customer.address}</p>}
            </div>

            <div>
              <h3 className="text-xs font-black tracking-wider uppercase text-gray-900 mb-1">
                From:
              </h3>
              <p className="font-bold text-base">
                {settings.business_name || 'Double Tap NFC'}
              </p>
              <p className="text-xs">
                {settings.business_phone || '+91 8304830149'}
              </p>
              <p className="text-xs">
                {settings.business_email || 'hello@doubletapnfc.com'}
              </p>
              <p className="text-xs">
                {settings.business_address || 'Calicut, Kerala, India'}
              </p>
            </div>
          </div>

          {/* Item Table */}
          <div className="pt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-gray-900 text-gray-900">
                  <th className="py-2 font-bold w-10">#</th>
                  <th className="py-2 font-bold">Description</th>
                  <th className="py-2 font-bold text-center w-16">Qty</th>
                  <th className="py-2 font-bold text-right w-24">Unit Price</th>
                  <th className="py-2 font-bold text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((it, idx) => (
                  <tr key={it.id}>
                    <td className="py-3 text-gray-500 font-mono">{idx + 1}</td>
                    <td className="py-3 font-medium text-gray-900">{it.description}</td>
                    <td className="py-3 text-center text-gray-700">{it.qty}</td>
                    <td className="py-3 text-right text-gray-700 font-mono">
                      {formatINR(it.unit_price)}
                    </td>
                    <td className="py-3 text-right font-bold text-gray-900 font-mono">
                      {formatINR(it.qty * it.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculation & Summary Breakdown */}
          <div className="flex justify-end pt-4">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatINR(itemsSubtotal)}</span>
              </div>
              {deliveryCharge > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Charge:</span>
                  <span className="font-mono">{formatINR(deliveryCharge)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Discount:</span>
                <span className="font-mono">₹0</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-gray-900 border-t border-gray-200 pt-1.5">
                <span>Grand Total:</span>
                <span className="font-mono">{formatINR(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Advance Paid:</span>
                <span className="font-mono">-{formatINR(advancePaid)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-black border-t-2 border-gray-900 pt-1.5">
                <span>Balance Due:</span>
                <span className="font-mono">{formatINR(balanceDue)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details Block */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-xs">
            <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px]">
              Payment Details
            </h4>
            <div className="text-gray-700 whitespace-pre-line leading-relaxed font-mono">
              {settings.payment_details ||
                `Bank Transfer / UPI Accepted\nUPI ID: 8304830149@upi\nPhonePe / Google Pay: +91 8304830149`}
            </div>
          </div>
        </div>

        {/* Invoice Footer & Terms */}
        <div className="border-t border-gray-200 pt-6 mt-8 text-[11px] text-gray-500 space-y-1">
          <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
            Terms & Conditions:
          </p>
          <p>• Work starts only after advance payment has been received and confirmed.</p>
          <p>• The link written on a Link card is permanent and cannot be altered once encoded.</p>
          <p className="text-center text-gray-400 text-[10px] pt-4">
            Thank you for choosing Double Tap! — Create. Code. Connect.
          </p>
        </div>
      </div>
    </div>
  )
}
