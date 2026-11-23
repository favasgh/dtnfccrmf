'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { WhatsAppTemplate } from '@/lib/types'
import {
  getSettings,
  updateSettings,
  getWhatsAppTemplates,
  createWhatsAppTemplate,
  updateWhatsAppTemplate,
  deleteWhatsAppTemplate,
} from './actions'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [msg, setMsg] = useState('')

  // Settings
  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [paymentDetails, setPaymentDetails] = useState('')

  // Templates
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [tplName, setTplName] = useState('')
  const [tplBody, setTplBody] = useState('')
  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [newTplName, setNewTplName] = useState('')
  const [newTplBody, setNewTplBody] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [st, tpls] = await Promise.all([getSettings(), getWhatsAppTemplates()])
      setBusinessName(st.business_name || '')
      setBusinessPhone(st.business_phone || '')
      setBusinessEmail(st.business_email || '')
      setBusinessAddress(st.business_address || '')
      setPaymentDetails(st.payment_details || '')
      setTemplates(tpls)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)
    setMsg('')
    try {
      await updateSettings({
        business_name: businessName,
        business_phone: businessPhone,
        business_email: businessEmail,
        business_address: businessAddress,
        payment_details: paymentDetails,
      })
      setMsg('Settings saved successfully!')
      setTimeout(() => setMsg(''), 3000)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleAddTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTplName.trim() || !newTplBody.trim()) return
    try {
      await createWhatsAppTemplate(newTplName, newTplBody)
      setNewTplName('')
      setNewTplBody('')
      setShowAddTemplate(false)
      const updated = await getWhatsAppTemplates()
      setTemplates(updated)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create template')
    }
  }

  function startEditTemplate(t: WhatsAppTemplate) {
    setEditingTemplateId(t.id)
    setTplName(t.name)
    setTplBody(t.template)
  }

  async function handleSaveEditedTemplate(id: string) {
    try {
      await updateWhatsAppTemplate(id, tplName, tplBody)
      setEditingTemplateId(null)
      const updated = await getWhatsAppTemplates()
      setTemplates(updated)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update template')
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this WhatsApp template?')) return
    try {
      await deleteWhatsAppTemplate(id)
      const updated = await getWhatsAppTemplates()
      setTemplates(updated)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete template')
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Settings" />
        <div className="p-8 text-center text-muted">Loading settings...</div>
      </>
    )
  }

  return (
    <>
      <Header title="Settings" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {msg && (
          <div className="p-3 bg-lime/10 border border-lime text-lime rounded-xl text-xs">
            {msg}
          </div>
        )}

        {/* Business Details (Invoice Header) */}
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-lime uppercase tracking-wider">
              Business Details (Shown on Invoices)
            </h2>

            <div className="grid sm:grid-cols-2 gap-3">
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
                <label className="block text-xs text-muted mb-1">WhatsApp / Phone</label>
                <input
                  type="text"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Email</label>
                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Address / Location</label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>
            </div>
          </div>

          {/* Invoice Payment Details (Bank / UPI) */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-lime uppercase tracking-wider">
                Invoice Payment Details (Bank & UPI)
              </h2>
            </div>
            <p className="text-xs text-muted">
              This text is rendered at the bottom of customer invoices. Never hard-coded.
            </p>

            <textarea
              rows={4}
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder="Bank account number, IFSC, UPI ID, Google Pay number..."
              className="w-full p-3 font-mono text-xs rounded-lg bg-black border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
            />

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2.5 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>

        {/* WhatsApp Message Templates */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-lime uppercase tracking-wider">
                WhatsApp Templates
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Dynamic variables available: <code className="text-lime">{'{name}'}</code>,{' '}
                <code className="text-lime">{'{business}'}</code>,{' '}
                <code className="text-lime">{'{advance}'}</code>
              </p>
            </div>
            <button
              onClick={() => setShowAddTemplate(true)}
              className="px-3 py-1.5 bg-lime/10 text-lime text-xs font-semibold rounded-lg hover:bg-lime/20"
            >
              + Add Template
            </button>
          </div>

          {showAddTemplate && (
            <form onSubmit={handleAddTemplate} className="p-3 bg-black border border-border rounded-lg space-y-3">
              <span className="text-xs font-semibold text-lime">New Template</span>
              <div>
                <label className="block text-[11px] text-muted mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="e.g. Card Ready Notification"
                  className="w-full px-3 py-2 bg-card border border-border rounded text-xs text-foreground"
                />
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1">Message Text</label>
                <textarea
                  rows={3}
                  required
                  value={newTplBody}
                  onChange={(e) => setNewTplBody(e.target.value)}
                  placeholder="Hi {name}, your card for {business} is ready!"
                  className="w-full p-2 bg-card border border-border rounded text-xs text-foreground font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-lime text-black font-semibold text-xs rounded hover:bg-lime-dark"
                >
                  Save Template
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTemplate(false)}
                  className="px-3 py-1.5 bg-card text-muted text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Templates List */}
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="p-3 bg-black/60 border border-border rounded-lg text-xs space-y-2">
                {editingTemplateId === tpl.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-card border border-border rounded text-xs text-foreground font-semibold"
                    />
                    <textarea
                      rows={3}
                      value={tplBody}
                      onChange={(e) => setTplBody(e.target.value)}
                      className="w-full p-2 bg-card border border-border rounded text-xs text-foreground font-mono"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveEditedTemplate(tpl.id)}
                        className="px-3 py-1 bg-lime text-black font-semibold text-xs rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingTemplateId(null)}
                        className="px-3 py-1 bg-card text-muted text-xs rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground text-sm">{tpl.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditTemplate(tpl)}
                          className="text-lime hover:underline text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id)}
                          className="text-danger hover:underline text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-muted font-mono whitespace-pre-wrap leading-relaxed text-[11px] bg-black/40 p-2 rounded border border-border/50">
                      {tpl.template}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
