'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Customer, Order, Activity, WhatsAppTemplate } from '@/lib/types'
import { formatINR, formatDate, waLink, fillTemplate, relativeDate } from '@/lib/utils'
import { getCustomer, updateCustomer, deleteCustomer, addCustomerActivity } from '../actions'
import { getWhatsAppTemplates } from '../../settings/actions'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit form fields
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  // New activity form
  const [actType, setActType] = useState<Activity['type']>('note')
  const [actText, setActText] = useState('')
  const [addingAct, setAddingAct] = useState(false)

  // WhatsApp template selector
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  async function loadData() {
    setLoading(true)
    try {
      const res = await getCustomer(id)
      if (!res.customer) return
      setCustomer(res.customer)
      setOrders(res.orders)
      setActivities(res.activities)

      setName(res.customer.name)
      setBusinessName(res.customer.business_name || '')
      setPhone(res.customer.phone || '')
      setEmail(res.customer.email || '')
      setAddress(res.customer.address || '')
      setNotes(res.customer.notes || '')

      const tpls = await getWhatsAppTemplates()
      if (tpls) setTemplates(tpls as WhatsAppTemplate[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleSaveCustomer() {
    setSaving(true)
    try {
      await updateCustomer(id, {
        name,
        business_name: businessName || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        notes: notes || null,
      })
      alert('Customer updated!')
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCustomer() {
    if (!confirm('Are you sure you want to delete this customer?')) return
    try {
      await deleteCustomer(id)
      router.push('/customers')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!actText.trim()) return
    setAddingAct(true)
    try {
      await addCustomerActivity(id, actType, actText.trim())
      setActText('')
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding note')
    } finally {
      setAddingAct(false)
    }
  }

  function handleOpenWhatsApp() {
    if (!phone) {
      alert('No phone number recorded.')
      return
    }

    let message = ''
    if (selectedTemplateId) {
      const tpl = templates.find((t) => t.id === selectedTemplateId)
      if (tpl) {
        message = fillTemplate(tpl.template, {
          name,
          business: businessName || 'your business',
          advance: '500',
        })
      }
    }

    const url = waLink(phone, message)
    window.open(url, '_blank')

    addCustomerActivity(id, 'whatsapp', `Opened WhatsApp with message: ${message || 'default'}`).then(() => {
      loadData()
    })
  }

  if (loading) {
    return (
      <>
        <Header title="Customer Details" />
        <div className="p-8 text-center text-muted">Loading...</div>
      </>
    )
  }

  if (!customer) {
    return (
      <>
        <Header title="Not Found" />
        <div className="p-8 text-center">
          <p className="text-muted">Customer not found.</p>
          <Link href="/customers" className="mt-3 inline-block text-lime hover:underline">
            Back to Customers
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={customer.name} />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Top actions */}
        <div className="flex justify-between items-center">
          <Link href="/customers" className="text-xs text-muted hover:text-foreground">
            ← Back to Customers
          </Link>
          <div className="flex gap-2">
            <Link
              href={`/orders/new?customer_id=${id}`}
              className="px-3 py-1.5 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark"
            >
              + New Order
            </Link>
            <button
              onClick={handleDeleteCustomer}
              className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/20 text-xs rounded-lg hover:bg-danger/20"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Customer Info Card */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <span className="text-xs font-semibold text-lime uppercase tracking-wider">
              Customer Details
            </span>
            {customer.lead_id && (
              <Link
                href={`/leads/${customer.lead_id}`}
                className="text-xs text-lime hover:underline flex items-center gap-1 font-medium bg-lime/10 px-2 py-0.5 rounded border border-lime/30"
              >
                <span>🏆</span> Converted from Won Lead
              </Link>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            {phone ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="px-2 py-1.5 bg-black border border-border rounded text-xs text-foreground"
                >
                  <option value="">Blank WhatsApp</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleOpenWhatsApp}
                  className="px-3 py-1.5 bg-[#25D366] text-black font-semibold rounded text-xs hover:bg-[#20ba5a]"
                >
                  💬 WhatsApp
                </button>
              </div>
            ) : <div />}

            <button
              onClick={handleSaveCustomer}
              disabled={saving}
              className="px-4 py-2 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </div>

        {/* Customer Orders */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm text-lime">Orders ({orders.length})</h2>
            <Link
              href={`/orders/new?customer_id=${id}`}
              className="text-xs text-lime hover:underline"
            >
              + Create Order
            </Link>
          </div>

          {orders.length === 0 ? (
            <p className="text-xs text-muted text-center py-4">No orders placed yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex justify-between items-center p-3 bg-black/50 border border-border rounded-lg hover:border-lime/40 transition-colors text-xs"
                >
                  <div>
                    <span className="font-semibold text-foreground mr-2">{o.order_no}</span>
                    <span className="text-muted">{formatDate(o.order_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-card border border-border text-foreground">
                      {o.status}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatINR(o.total_amount || 0)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Customer Activity Timeline */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm text-lime">Activity Timeline</h2>

          <form onSubmit={handleAddActivity} className="flex gap-2">
            <select
              value={actType}
              onChange={(e) => setActType(e.target.value as Activity['type'])}
              className="px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground"
            >
              <option value="note">📝 Note</option>
              <option value="call">📞 Call</option>
              <option value="whatsapp">💬 WhatsApp</option>
            </select>

            <input
              type="text"
              required
              value={actText}
              onChange={(e) => setActText(e.target.value)}
              placeholder="Add note or log call..."
              className="flex-1 px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
            />

            <button
              type="submit"
              disabled={addingAct}
              className="px-4 py-2 bg-card border border-border rounded-lg text-xs hover:bg-card-hover font-medium disabled:opacity-50"
            >
              {addingAct ? '...' : 'Add'}
            </button>
          </form>

          <div className="space-y-2 pt-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No activities logged.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="p-3 bg-black/50 border border-border/60 rounded-lg text-xs">
                  <div className="flex justify-between items-center text-muted text-[10px] mb-1">
                    <span className="capitalize font-semibold text-foreground">
                      {a.type}
                    </span>
                    <span>{relativeDate(a.created_at)}</span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{a.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
