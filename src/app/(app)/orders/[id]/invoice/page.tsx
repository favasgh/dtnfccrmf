'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { Order, OrderItem, Customer, Settings } from '@/lib/types'
import { getOrder } from '../../actions'
import { getSettings } from '../../../settings/actions'

function formatInvoiceDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatRupees(num: number): string {
  return `₹${Math.round(num || 0)}`
}

function formatUnitPrice(num: number): string {
  return `₹ ${Math.round(num || 0)}`
}

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
    return (
      <div className="p-8 text-center text-muted space-y-3">
        <p>Order or Customer not found.</p>
        <Link href="/orders" className="text-lime hover:underline text-xs">
          ← Back to Orders
        </Link>
      </div>
    )
  }

  const itemsSubtotal = items.reduce((sum, it) => sum + (it.qty || 0) * (it.unit_price || 0), 0)
  const discountAmount = order.discount || 0
  const deliveryCharge = order.delivery_charge || 0
  const grandTotal = Math.max(0, itemsSubtotal + deliveryCharge - discountAmount)

  // Fallback defaults matching the exact reference bill
  const bankAccountNo = settings.bank_account_no || '45362631688'
  const bankIfsc = settings.bank_ifsc || 'SBIN0070454'
  const bankHolderName = settings.bank_holder_name || 'Muhammed Favas'
  const googlePayNumber = settings.google_pay_number || '8086630149'

  const businessName = settings.business_name || 'Double tap NFC'
  const businessCity = settings.business_city || 'Calicut'
  const businessPhone = settings.business_phone || '+91 8304830149'

  // Format customer phone
  let formattedCustPhone = customer.phone || ''
  if (formattedCustPhone && !formattedCustPhone.startsWith('+')) {
    formattedCustPhone = `+91 ${formattedCustPhone.replace(/^(\+91|91)/, '').trim()}`
  }

  return (
    <div className="min-h-screen bg-black text-foreground md:py-8 font-sans">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print max-w-[210mm] mx-auto px-4 mb-4 flex items-center justify-between">
        <Link href={`/orders/${id}`} className="text-xs text-muted hover:text-foreground">
          ← Back to Order
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/orders/${id}/edit`}
            className="px-3.5 py-2 bg-card border border-border text-foreground hover:border-lime/40 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>✏️</span> Edit Bill
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-lime text-black font-bold text-xs rounded-lg hover:bg-lime-dark flex items-center gap-1.5 shadow"
          >
            <span>🖨️</span> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Exact Invoice Sheet (A4 Proportion) */}
      <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white text-black p-8 sm:p-12 md:p-16 shadow-2xl rounded-sm print:shadow-none print:p-6 print:m-0 flex flex-col justify-between">
        <div>
          {/* Top Header */}
          <div className="flex justify-between items-start">
            {/* Left: Brand & Invoice title */}
            <div>
              <div className="leading-tight">
                <span className="block text-3xl sm:text-4xl font-extrabold tracking-tight text-black leading-none">
                  double
                </span>
                <span className="block text-3xl sm:text-4xl font-extrabold tracking-tight text-black leading-none mt-1">
                  tap
                </span>
              </div>
              <div className="mt-8 sm:mt-10">
                <h1 className="text-5xl sm:text-6xl font-light tracking-tight text-black">
                  Invoice
                </h1>
              </div>
            </div>

            {/* Right: Invoice details */}
            <div className="text-right text-sm sm:text-base font-bold text-black space-y-1.5 pt-12 sm:pt-14">
              <div className="flex justify-end gap-3">
                <span className="text-black">Invoice No:</span>
                <span className="text-black">{order.order_no}</span>
              </div>
              <div className="flex justify-end gap-3">
                <span className="text-black">Issue Date:</span>
                <span className="text-black">{formatInvoiceDate(order.order_date)}</span>
              </div>
              <div className="flex justify-end gap-3">
                <span className="text-black">Due Date:</span>
                <span className="text-black">{formatInvoiceDate(order.delivery_date || order.order_date)}</span>
              </div>
            </div>
          </div>

          {/* Main Gray Card Container */}
          <div className="mt-8 sm:mt-10 bg-[#F4F6F8] rounded-[28px] sm:rounded-[34px] p-6 sm:p-10 space-y-8">
            {/* Bright Fluorescent Lime Box */}
            <div className="bg-[#BAFF00] rounded-2xl sm:rounded-[22px] p-6 sm:p-8 text-black grid grid-cols-2 gap-6 sm:gap-8 shadow-sm">
              <div>
                <div className="text-sm sm:text-base font-bold text-black">Bill To</div>
                <div className="text-base sm:text-lg font-bold text-black mt-3 sm:mt-4">{customer.name}</div>
                {customer.business_name && (
                  <div className="text-sm sm:text-base font-bold text-black mt-0.5">{customer.business_name}</div>
                )}
                {formattedCustPhone && (
                  <div className="text-sm sm:text-base font-bold text-black mt-0.5">{formattedCustPhone}</div>
                )}
              </div>

              <div>
                <div className="text-sm sm:text-base font-bold text-black">From</div>
                <div className="text-base sm:text-lg font-bold text-black mt-3 sm:mt-4">{businessName}</div>
                <div className="text-sm sm:text-base font-bold text-black mt-0.5">{businessCity}</div>
                <div className="text-sm sm:text-base font-bold text-black mt-0.5">{businessPhone}</div>
              </div>
            </div>

            {/* Item Description Table */}
            <div className="pt-2">
              <div className="grid grid-cols-12 pb-3 font-bold text-sm sm:text-base text-black border-b border-gray-300">
                <div className="col-span-6">Item Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-center">Unit Price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>

              <div className="divide-y divide-gray-200">
                {items.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 py-3.5 sm:py-4 font-bold text-sm sm:text-base text-black items-center">
                    <div className="col-span-6">{it.description}</div>
                    <div className="col-span-2 text-center">{it.qty}</div>
                    <div className="col-span-2 text-center">{formatUnitPrice(it.unit_price)}</div>
                    <div className="col-span-2 text-right">{formatRupees(it.qty * it.unit_price)}</div>
                  </div>
                ))}
              </div>
              <div className="border-b border-gray-300"></div>

              {/* Totals Section */}
              <div className="flex justify-end pt-6">
                <div className="w-64 sm:w-72 space-y-2 text-sm sm:text-base font-bold text-black">
                  <div className="flex justify-between items-center">
                    <span>Subtotal:</span>
                    <span>{formatRupees(itemsSubtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Discount</span>
                      <span>-{formatRupees(discountAmount)}</span>
                    </div>
                  )}

                  {deliveryCharge > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Delivery Charge:</span>
                      <span>{formatRupees(deliveryCharge)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xl sm:text-2xl font-bold pt-4 text-black">
                    <span>Grand Total:</span>
                    <span>{formatRupees(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bank / Payment Details */}
        <div className="mt-12 sm:mt-16 text-sm sm:text-base font-bold text-black leading-relaxed space-y-1">
          <div>Account No. :- {bankAccountNo}</div>
          <div>IFSC Code :- {bankIfsc}</div>
          <div>Name :- {bankHolderName}</div>
          <div>Google Pay Number :- {googlePayNumber}</div>
        </div>
      </div>
    </div>
  )
}
