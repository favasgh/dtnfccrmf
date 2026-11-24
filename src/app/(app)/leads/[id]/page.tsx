'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Lead, LeadStage, LeadSource, LEAD_STAGES, LEAD_SOURCES, Activity, WhatsAppTemplate, Product } from '@/lib/types'
import { waLink, fillTemplate, relativeDate } from '@/lib/utils'
import {
  getLead,
  updateLead,
  deleteLead,
  convertToCustomer,
  getWonLeadCustomer,
  getLeadActivities,
  addLeadActivity,
} from '../actions'
import { getWhatsAppTemplates } from '../../settings/actions'
import { getProducts } from '../../products/actions'

export default function LeadDetailPage({ params }: { params?: Promise<{ id: string }> }) {
  const routeParams = useParams()
  const id = (routeParams?.id as string) || ''
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)
  const [msg, setMsg] = useState('')

  // Editable fields
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [phone, setPhone] = useState('')
  const [sourceCategory, setSourceCategory] = useState<string>('Instagram')
  const [sourceDetail, setSourceDetail] = useState<string>('')
  const [stage, setStage] = useState<LeadStage>('New')
  const [nextFollowUp, setNextFollowUp] = useState('')
  const [notes, setNotes] = useState('')
  const [objection, setObjection] = useState('')
  const [product, setProduct] = useState('')

  // New activity form
  const [actType, setActType] = useState<Activity['type']>('note')
  const [actText, setActText] = useState('')
  const [addingAct, setAddingAct] = useState(false)

  // WhatsApp template selector
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  async function loadData() {
    setLoading(true)
    try {
      const l = await getLead(id)
      if (!l) return
      setLead(l)
      setName(l.name || '')
      setBusinessName(l.business_name || '')
      setBusinessType(l.business_type || '')
      setPhone(l.phone || '')
      const s = l.source || ''
      const match = s.match(/^([^(]+)\s*\((.+)\)$/)
      if (match) {
        setSourceCategory(match[1].trim())
        setSourceDetail(match[2].trim())
      } else {
        setSourceCategory(s || 'Instagram')
        setSourceDetail('')
      }
      setStage(l.stage)
      setNextFollowUp(l.next_follow_up_date || '')
      setNotes(l.notes || '')
      setObjection(l.objection || '')
      setProduct(l.interested_product || '')

      const [acts, tpls, prods, linkedCust] = await Promise.all([
        getLeadActivities(id),
        getWhatsAppTemplates(),
        getProducts(),
        getWonLeadCustomer(id),
      ])
      setActivities(acts)
      if (tpls) setTemplates(tpls as WhatsAppTemplate[])
      if (prods) setProducts(prods as Product[])
      setLinkedCustomerId(linkedCust)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  async function handleQuickSaveStage(newStage: LeadStage) {
    setStage(newStage)
    try {
      await updateLead(id, { stage: newStage })
      await addLeadActivity(id, 'note', `Stage updated to ${newStage}`)
      setMsg(`Stage updated to ${newStage}`)
      setTimeout(() => setMsg(''), 3000)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating stage')
    }
  }

  async function handleSaveChanges(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!name.trim()) {
      alert('Lead Name is required')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      const effectiveSource = sourceDetail.trim()
        ? sourceCategory === 'Other'
          ? sourceDetail.trim()
          : `${sourceCategory} (${sourceDetail.trim()})`
        : sourceCategory

      await updateLead(id, {
        name: name.trim(),
        business_name: businessName.trim() || null,
        business_type: businessType.trim() || null,
        phone: phone.trim() || null,
        source: effectiveSource,
        stage,
        next_follow_up_date: nextFollowUp || null,
        notes: notes.trim() || null,
        objection: objection.trim() || null,
        interested_product: product.trim() || null,
      })
      setMsg('All lead changes saved successfully!')
      setTimeout(() => setMsg(''), 3000)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error saving changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!actText.trim()) return
    setAddingAct(true)
    try {
      await addLeadActivity(id, actType, actText.trim())
      setActText('')
      const updated = await getLeadActivities(id)
      setActivities(updated)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error adding activity')
    } finally {
      setAddingAct(false)
    }
  }

  async function handleConvertToCustomer() {
    if (!confirm('Convert this lead to a customer?')) return
    setConverting(true)
    try {
      const customerId = await convertToCustomer(id)
      router.push(`/customers/${customerId}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Conversion failed')
      setConverting(false)
    }
  }

  async function handleDeleteLead() {
    if (!confirm(`Are you sure you want to delete lead "${name || lead?.name}"?`)) return
    try {
      await deleteLead(id)
      router.push('/leads')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function handleOpenWhatsApp() {
    if (!phone) {
      alert('No phone number recorded for this lead.')
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

    addLeadActivity(id, 'whatsapp', `Opened WhatsApp with template: ${message || 'default'}`).then(() => {
      loadData()
    })
  }

  if (loading) {
    return (
      <>
        <Header title="Lead Details" />
        <div className="p-8 text-center text-muted">Loading details...</div>
      </>
    )
  }

  if (!lead) {
    return (
      <>
        <Header title="Not Found" />
        <div className="p-8 text-center">
          <p className="text-muted">Lead not found.</p>
          <Link href="/leads" className="mt-3 inline-block text-lime hover:underline">
            Back to Leads
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={`Edit: ${lead.name}`} />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Navigation & Top Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/leads" className="text-xs text-muted hover:text-foreground flex items-center gap-1">
            ← Back to Leads
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/orders/new?from_lead=${id}`)}
              className="px-3.5 py-1.5 bg-lime text-black text-xs font-semibold rounded-lg hover:bg-lime-dark flex items-center gap-1.5 shadow"
              title="Convert this lead to an order with full editing options"
            >
              <span>📦</span> Convert to Order
            </button>
            {linkedCustomerId ? (
              <Link
                href={`/customers/${linkedCustomerId}`}
                className="px-3 py-1.5 bg-card border border-border text-foreground hover:border-lime/40 text-xs font-semibold rounded-lg flex items-center gap-1"
              >
                <span>👤</span> View Customer
              </Link>
            ) : stage !== 'Won' ? (
              <button
                type="button"
                onClick={handleConvertToCustomer}
                disabled={converting}
                className="px-3 py-1.5 bg-card border border-border text-foreground hover:bg-card-hover text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {converting ? 'Converting...' : 'Convert to Customer'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDeleteLead}
              className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/30 text-xs font-semibold rounded-lg hover:bg-danger/20"
            >
              Delete Lead
            </button>
          </div>
        </div>

        {msg && (
          <div className="p-3 bg-lime/10 border border-lime text-lime rounded-xl text-xs font-medium">
            {msg}
          </div>
        )}

        {/* WhatsApp Direct Action Bar */}
        {phone && (
          <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="flex-1 px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
            >
              <option value="">No template (blank message)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}: {t.template.slice(0, 45)}...
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="px-4 py-2 bg-[#25D366] text-black font-semibold rounded-lg text-xs hover:bg-[#20ba5a] flex items-center justify-center gap-2"
            >
              <span>💬</span> Send WhatsApp
            </button>
          </div>
        )}

        {/* Lead Main Form */}
        <form onSubmit={handleSaveChanges} className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h2 className="font-bold text-sm text-lime uppercase tracking-wider">
                Lead Contact Information
              </h2>
              <div>
                <span className="text-[11px] text-muted mr-2">Stage:</span>
                <select
                  value={stage}
                  onChange={(e) => handleQuickSaveStage(e.target.value as LeadStage)}
                  className="px-2.5 py-1 bg-black border border-border rounded text-xs text-foreground font-semibold"
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Calicut Motors"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Business Type / Industry</label>
                <input
                  type="text"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g. Cafe, Real Estate, Automobile"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Lead Source (Dropdown)</label>
                <select
                  value={sourceCategory}
                  onChange={(e) => setSourceCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                >
                  <option value="Instagram">Instagram</option>
                  <option value="Google Maps">Google Maps</option>
                  <option value="Referral">Referral</option>
                  <option value="Walk-in">Walk-in</option>
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Printo Referral">Printo Referral</option>
                  <option value="Event / Expo">Event / Expo</option>
                  <option value="Other">Other / Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">
                  Additional Source Details (Text Box)
                </label>
                <input
                  type="text"
                  value={sourceDetail}
                  onChange={(e) => setSourceDetail(e.target.value)}
                  placeholder="e.g. Referred by Rahul, Instagram DM, Expo Stall #4..."
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Next Follow-up Date</label>
                <input
                  type="date"
                  value={nextFollowUp}
                  onChange={(e) => setNextFollowUp(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Interested Product / Service</label>
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                >
                  <option value="">-- Select Product or Service --</option>
                  {product && !products.some((p) => p.name === product) && (
                    <option value={product}>{product}</option>
                  )}
                  <optgroup label="NFC Cards">
                    {products
                      .filter((p) => p.category === 'card' && p.active)
                      .map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} (₹{p.price})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Services">
                    {products
                      .filter((p) => p.category === 'service' && p.active)
                      .map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} (₹{p.price})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Objection / Notes on Pricing</label>
                <input
                  type="text"
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                  placeholder="e.g. Asking for quantity discount"
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-muted mb-1">General Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes from calls, customer requirements, links..."
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark disabled:opacity-50 shadow"
              >
                {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </form>

        {/* Activity Timeline */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm text-lime uppercase tracking-wider">
            Activity Timeline & Notes
          </h2>

          <form onSubmit={handleAddActivity} className="space-y-2">
            <div className="flex gap-2">
              <select
                value={actType}
                onChange={(e) => setActType(e.target.value as Activity['type'])}
                className="px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              >
                <option value="note">📝 Note</option>
                <option value="call">📞 Call</option>
                <option value="whatsapp">💬 WhatsApp</option>
                <option value="follow_up">⏰ Follow-up</option>
              </select>

              <input
                type="text"
                required
                value={actText}
                onChange={(e) => setActText(e.target.value)}
                placeholder="Log activity details or customer request..."
                className="flex-1 px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />

              <button
                type="submit"
                disabled={addingAct}
                className="px-4 py-2 bg-card border border-border rounded-lg text-xs hover:bg-card-hover font-medium disabled:opacity-50"
              >
                {addingAct ? '...' : 'Add'}
              </button>
            </div>
          </form>

          {/* Activities list */}
          <div className="space-y-3 pt-2">
            {activities.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No activities logged yet.</p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="p-3 bg-black/50 border border-border/60 rounded-lg text-xs">
                  <div className="flex justify-between items-center text-muted text-[10px] mb-1">
                    <span className="capitalize font-semibold text-foreground">
                      {a.type === 'whatsapp' ? '💬 WhatsApp' : a.type === 'call' ? '📞 Call' : a.type === 'follow_up' ? '⏰ Follow-up' : '📝 Note'}
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
