'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Order, OrderItem, Customer, Settings } from '@/lib/types'
import { getOrder, updateOrder } from '../../actions'
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

export default function InvoicePage({ params }: { params?: Promise<{ id: string }> }) {
  const routeParams = useParams()
  const id = (routeParams?.id as string) || ''
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [settings, setSettings] = useState<Settings['data']>({})
  const [loading, setLoading] = useState(true)

  async function handleSwitchPayment(method: 'bank' | 'cash') {
    if (!order) return
    setOrder({ ...order, payment_method: method })
    try {
      await updateOrder(id, { payment_method: method })
    } catch (e) {
      console.error(e)
    }
  }

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
    if (id) {
      loadInvoiceData()
    }
  }, [id])

  if (loading) {
    return <div className="p-8 text-center text-muted font-sans">Generating invoice...</div>
  }

  if (!order || !customer) {
    return (
      <div className="p-8 text-center text-muted space-y-3 font-sans">
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
    <div className="min-h-screen bg-black text-foreground py-3 sm:py-6 md:py-8 font-sans">
      {/* Top Action Bar (hidden when printing) */}
      <div className="no-print max-w-[210mm] mx-auto px-3 sm:px-4 mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/orders/${id}`} className="text-xs text-muted hover:text-foreground">
          ← Back to Order
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Payment Mode Selector */}
          <div className="bg-card border border-border rounded-lg p-0.5 flex items-center text-xs">
            <button
              onClick={() => handleSwitchPayment('bank')}
              className={`px-2.5 py-1 sm:py-1.5 rounded-md font-semibold text-xs flex items-center gap-1 transition-colors ${order.payment_method !== 'cash'
                  ? 'bg-lime text-black shadow-sm'
                  : 'text-muted hover:text-foreground'
                }`}
              title="Set payment mode to Bank / UPI"
            >
              <span>🏛️</span> Bank / UPI
            </button>
            <button
              onClick={() => handleSwitchPayment('cash')}
              className={`px-2.5 py-1 sm:py-1.5 rounded-md font-semibold text-xs flex items-center gap-1 transition-colors ${order.payment_method === 'cash'
                  ? 'bg-amber-400 text-black shadow-sm'
                  : 'text-muted hover:text-foreground'
                }`}
              title="Set payment mode to Cash in Hand"
            >
              <span>💵</span> Cash
            </button>
          </div>

          <Link
            href={`/orders/${id}/edit`}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-card border border-border text-foreground hover:border-lime/40 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <span>✏️</span> Edit Bill
          </Link>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-lime text-black font-bold text-xs rounded-lg hover:bg-lime-dark flex items-center gap-1.5 shadow"
          >
            <span>🖨️</span> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Printable Exact Invoice Sheet (A4 Proportion) */}
      <div className="max-w-[210mm] min-h-auto sm:min-h-[297mm] mx-auto bg-white text-black p-4 sm:p-8 md:p-10 shadow-2xl rounded-sm print:shadow-none print:p-6 print:m-0 flex flex-col justify-between font-sans">
        <div>
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-6">
            {/* Left: Brand Logo & Invoice title */}
            <div>
              <div className="w-14 sm:w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/doubletap-logo.png"
                  alt="double tap"
                  className="w-full h-auto object-contain"
                />
              </div>
              <div className="mt-2 sm:mt-3">
                <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-black">
                  Invoice
                </h1>
              </div>
            </div>

            {/* Right: Invoice details */}
            <div className="text-left sm:text-right text-[11px] sm:text-xs font-bold text-black space-y-1 pt-0 sm:pt-6 self-stretch sm:self-auto border-t sm:border-t-0 border-gray-100 pt-2 sm:pt-0">
              <div className="flex justify-between sm:justify-end gap-2.5">
                <span className="text-gray-600 font-semibold">Invoice No:</span>
                <span className="text-black font-mono">{order.order_no}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-2.5">
                <span className="text-gray-600 font-semibold">Issue Date:</span>
                <span className="text-black">{formatInvoiceDate(order.order_date)}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-2.5">
                <span className="text-gray-600 font-semibold">Due Date:</span>
                <span className="text-black">{formatInvoiceDate(order.delivery_date || order.order_date)}</span>
              </div>
              <div className="flex justify-between sm:justify-end gap-2.5">
                <span className="text-gray-600 font-semibold">Payment Mode:</span>
                <span className="text-black font-bold">
                  {order.payment_method === 'cash' ? 'Cash in Hand' : 'Bank Account / UPI'}
                </span>
              </div>
            </div>
          </div>

          {/* Main Gray Card Container */}
          <div className="mt-4 sm:mt-6 bg-[#F4F6F8] rounded-xl sm:rounded-2xl p-3 sm:p-5 space-y-4 sm:space-y-5">
            {/* Bright Fluorescent Lime Box */}
            <div className="bg-[#BAFF00] rounded-lg sm:rounded-xl p-3 sm:p-4 text-black grid grid-cols-2 gap-3 sm:gap-6 shadow-sm">
              <div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-black/80">Bill To</div>
                <div className="text-xs sm:text-sm font-bold text-black mt-1 break-words">{customer.name}</div>
                {customer.business_name && (
                  <div className="text-[11px] sm:text-xs font-semibold text-black/90 mt-0.5 break-words">{customer.business_name}</div>
                )}
                {formattedCustPhone && (
                  <div className="text-[11px] sm:text-xs font-semibold text-black/90 mt-0.5">{formattedCustPhone}</div>
                )}
              </div>

              <div>
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-black/80">From</div>
                <div className="text-xs sm:text-sm font-bold text-black mt-1">{businessName}</div>
                <div className="text-[11px] sm:text-xs font-semibold text-black/90 mt-0.5">{businessCity}</div>
                <div className="text-[11px] sm:text-xs font-semibold text-black/90 mt-0.5">{businessPhone}</div>
              </div>
            </div>

            {/* Item Description Table */}
            <div className="pt-1">
              <div className="grid grid-cols-12 pb-2 font-bold text-[10px] sm:text-xs text-black uppercase tracking-wider border-b border-gray-300">
                <div className="col-span-5 sm:col-span-6">Item Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right sm:text-center">
                  <span className="sm:hidden">Price</span>
                  <span className="hidden sm:inline">Unit Price</span>
                </div>
                <div className="col-span-3 sm:col-span-2 text-right">Amount</div>
              </div>

              <div className="divide-y divide-gray-200">
                {items.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 py-2 sm:py-2.5 font-bold text-xs sm:text-sm text-black items-center">
                    <div className="col-span-5 sm:col-span-6 pr-1 break-words">{it.description}</div>
                    <div className="col-span-2 text-center">{it.qty}</div>
                    <div className="col-span-2 text-right sm:text-center whitespace-nowrap">{formatUnitPrice(it.unit_price)}</div>
                    <div className="col-span-3 sm:col-span-2 text-right whitespace-nowrap">{formatRupees(it.qty * it.unit_price)}</div>
                  </div>
                ))}
              </div>
              <div className="border-b border-gray-300"></div>

              {/* Totals Section */}
              <div className="flex justify-end pt-3 sm:pt-4">
                <div className="w-full sm:w-60 space-y-1 text-xs sm:text-sm font-bold text-black">
                  <div className="flex justify-between items-center text-[11px] sm:text-xs text-gray-700">
                    <span>Subtotal:</span>
                    <span className="text-black font-bold">{formatRupees(itemsSubtotal)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-[11px] sm:text-xs text-gray-700">
                      <span>Discount:</span>
                      <span className="text-black font-bold">-{formatRupees(discountAmount)}</span>
                    </div>
                  )}

                  {deliveryCharge > 0 && (
                    <div className="flex justify-between items-center text-[11px] sm:text-xs text-gray-700">
                      <span>Delivery Charge:</span>
                      <span className="text-black font-bold">{formatRupees(deliveryCharge)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm sm:text-base font-bold pt-2 text-black border-t border-gray-300">
                    <span>Grand Total:</span>
                    <span>{formatRupees(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bank / Payment Details */}
        <div className="mt-6 sm:mt-8 text-[11px] sm:text-xs font-bold text-black leading-relaxed space-y-0.5">
          <div className="text-gray-600 font-semibold mb-0.5">
            Payment Mode :- <span className="text-black font-bold">{order.payment_method === 'cash' ? 'Cash in Hand' : 'Bank Account / UPI'}</span>
          </div>
          {order.payment_method === 'cash' ? (
            <div className="text-gray-700 font-semibold">Status :- Payment Received in Cash</div>
          ) : (
            <>
              <div>Account No. :- {bankAccountNo}</div>
              <div>IFSC Code :- {bankIfsc}</div>
              <div>Name :- {bankHolderName}</div>
              <div>Google Pay Number :- {googlePayNumber}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
