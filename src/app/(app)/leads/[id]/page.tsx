'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Lead, LeadStage, LEAD_STAGES, Activity, WhatsAppTemplate } from '@/lib/types'
import { formatDate, waLink, fillTemplate, relativeDate } from '@/lib/utils'
import {
  getLead,
  updateLead,
  deleteLead,
  convertToCustomer,
  getLeadActivities,
  addLeadActivity,
} from '../actions'
import { getWhatsAppTemplates } from '../../settings/actions'

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)

  // Edit fields
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
      setStage(l.stage)
      setNextFollowUp(l.next_follow_up_date || '')
      setNotes(l.notes || '')
      setObjection(l.objection || '')
      setProduct(l.interested_product || '')

      const acts = await getLeadActivities(id)
      setActivities(acts)

      // Fetch templates
      const tpls = await getWhatsAppTemplates()
      if (tpls) setTemplates(tpls as WhatsAppTemplate[])
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
      await addLeadActivity(id, 'note', `Stage changed to ${newStage}`)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating stage')
    }
  }

  async function handleSaveChanges() {
    setSaving(true)
    try {
      await updateLead(id, {
        stage,
        next_follow_up_date: nextFollowUp || null,
        notes: notes || null,
        objection: objection || null,
        interested_product: product || null,
      })
      alert('Changes saved')
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
      alert(err instanceof Error ? err.message : 'Error adding note')
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
    if (!confirm('Are you sure you want to delete this lead?')) return
    try {
      await deleteLead(id)
      router.push('/leads')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  function handleOpenWhatsApp() {
    if (!lead?.phone) {
      alert('No phone number recorded for this lead.')
      return
    }

    let message = ''
    if (selectedTemplateId) {
      const tpl = templates.find((t) => t.id === selectedTemplateId)
      if (tpl) {
        message = fillTemplate(tpl.template, {
          name: lead.name,
          business: lead.business_name || 'your business',
          advance: '500',
        })
      }
    }

    const url = waLink(lead.phone, message)
    window.open(url, '_blank')

    // Automatically record WhatsApp activity
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
      <Header title={lead.name} />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {/* Navigation & Actions Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/leads" className="text-xs text-muted hover:text-foreground flex items-center gap-1">
            ← Back to Leads
          </Link>
          <div className="flex gap-2">
            {lead.stage !== 'Won' && (
              <button
                onClick={handleConvertToCustomer}
                disabled={converting}
                className="px-3 py-1.5 bg-lime text-black text-xs font-semibold rounded-lg hover:bg-lime-dark disabled:opacity-50"
              >
                {converting ? 'Converting...' : 'Convert to Customer'}
              </button>
            )}
            <button
              onClick={handleDeleteLead}
              className="px-3 py-1.5 bg-danger/10 text-danger border border-danger/20 text-xs rounded-lg hover:bg-danger/20"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Lead Main Card */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-xl font-bold">{lead.name}</h1>
              {lead.business_name && (
                <p className="text-sm text-muted">{lead.business_name} {lead.business_type ? `(${lead.business_type})` : ''}</p>
              )}
              {lead.phone && <p className="text-sm text-lime mt-1 font-mono">{lead.phone}</p>}
            </div>

            {/* Stage Selector */}
            <div>
              <label className="block text-[11px] text-muted mb-1">Lead Stage</label>
              <select
                value={stage}
                onChange={(e) => handleQuickSaveStage(e.target.value as LeadStage)}
                className="px-3 py-2 bg-black border border-border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-lime"
              >
                {LEAD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* WhatsApp Direct Action Bar */}
          {lead.phone && (
            <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
                onClick={handleOpenWhatsApp}
                className="px-4 py-2 bg-[#25D366] text-black font-semibold rounded-lg text-xs hover:bg-[#20ba5a] flex items-center justify-center gap-2"
              >
                <span>💬</span> Open WhatsApp
              </button>
            </div>
          )}
        </div>

        {/* Details & Follow-up Settings */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm text-lime">Details & Follow-up</h2>

          <div className="grid sm:grid-cols-2 gap-3">
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
              <label className="block text-xs text-muted mb-1">Interested Product</label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="e.g. Signature Pro"
                className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Objection / Concerns</label>
            <input
              type="text"
              value={objection}
              onChange={(e) => setObjection(e.target.value)}
              placeholder="e.g. Asking for discount, checking with partner"
              className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">General Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes from call or chat..."
              className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="px-4 py-2 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm text-lime">Activity Timeline</h2>

          {/* Add Activity Form */}
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
                placeholder="Log activity details..."
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

          {/* List of activities */}
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
