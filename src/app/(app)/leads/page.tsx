'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Lead, LeadStage, LeadSource, LEAD_STAGES, LEAD_SOURCES, Product } from '@/lib/types'
import { formatDate, isOverdue, isDueToday } from '@/lib/utils'
import { getLeads, createLead, deleteLead, importLeadsFromCsv } from './actions'
import { getProducts } from '../products/actions'

const STAGE_COLORS: Record<LeadStage, string> = {
  New: 'bg-gray-800 text-gray-300 border-gray-700',
  Contacted: 'bg-blue-950 text-blue-300 border-blue-800',
  Replied: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  Interested: 'bg-yellow-950 text-yellow-300 border-yellow-800',
  'Sample Shown': 'bg-purple-950 text-purple-300 border-purple-800',
  Negotiating: 'bg-orange-950 text-orange-300 border-orange-800',
  Won: 'bg-lime/20 text-lime border-lime/40',
  Lost: 'bg-red-950 text-red-300 border-red-800',
  'Follow Up Later': 'bg-amber-950 text-amber-300 border-amber-800',
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [products, setProducts] = useState<Product[]>([])

  // Quick Add Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newBiz, setNewBiz] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newSource, setNewSource] = useState<string>('Instagram')
  const [newSourceDetail, setNewSourceDetail] = useState<string>('')
  const [newProduct, setNewProduct] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)

  // CSV Import Modal
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const [data, prods] = await Promise.all([
        getLeads({
          stage: stageFilter,
          source: sourceFilter,
          search,
        }),
        getProducts(),
      ])
      setLeads(data)
      setProducts(prods)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // 1. Initial load & filter change
  useEffect(() => {
    loadData()
  }, [stageFilter, sourceFilter])

  // 2. Multi-device live auto-sync (polls every 6 seconds & syncs on tab focus)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true)
    }, 6000)

    const handleFocus = () => loadData(true)
    window.addEventListener('focus', handleFocus)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [stageFilter, sourceFilter, search])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadData()
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const effectiveSource = newSourceDetail.trim()
        ? newSource === 'Other'
          ? newSourceDetail.trim()
          : `${newSource} (${newSourceDetail.trim()})`
        : newSource

      const created = await createLead({
        name: newName.trim(),
        business_name: newBiz.trim() || undefined,
        phone: newPhone.trim() || undefined,
        source: effectiveSource,
        interested_product: newProduct.trim() || undefined,
        notes: newNotes.trim() || undefined,
      })
      if (created) {
        setLeads((prev) => [created, ...prev.filter((l) => l.id !== created.id)])
      }
      setShowAddModal(false)
      setNewName('')
      setNewBiz('')
      setNewPhone('')
      setNewNotes('')
      setNewProduct('')
      setNewSource('Instagram')
      setNewSourceDetail('')
      setStageFilter('ALL')
      setSourceFilter('ALL')
      setSearch('')
      await loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating lead')
    } finally {
      setCreating(false)
    }
  }

  async function handleImportCsv(e: React.FormEvent) {
    e.preventDefault()
    if (!csvText.trim()) return
    setImporting(true)
    setImportResult(null)
    try {
      const res = await importLeadsFromCsv(csvText)
      setImportResult(res)
      if (res.imported > 0) {
        loadData()
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to import')
    } finally {
      setImporting(false)
    }
  }

  async function handleDirectDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete lead "${name}"?`)) return
    try {
      await deleteLead(id)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <>
      <Header title="Leads" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        {/* Top bar: Search, View switch, CSV import */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-lime"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-card border border-border text-sm rounded-lg hover:bg-card-hover"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2 justify-end items-center">
            <div className="bg-card border border-border rounded-lg p-1 flex">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${view === 'list' ? 'bg-lime text-black font-semibold' : 'text-muted hover:text-foreground'
                  }`}
              >
                List
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${view === 'kanban' ? 'bg-lime text-black font-semibold' : 'text-muted hover:text-foreground'
                  }`}
              >
                Kanban
              </button>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="px-2.5 py-2 bg-card border border-border text-xs rounded-lg hover:bg-card-hover text-muted hover:text-foreground flex items-center gap-1"
              title="Sync with cloud"
            >
              <span className={`inline-block text-xs ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
            </button>

            <button
              onClick={() => {
                setShowCsvModal(true)
                setImportResult(null)
              }}
              className="px-3 py-2 bg-card border border-border text-xs rounded-lg hover:bg-card-hover text-muted hover:text-foreground"
            >
              Import CSV
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark shrink-0 flex items-center justify-center gap-1 shadow"
            >
              <span>+</span> Add Lead
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
          >
            <option value="ALL">All Stages</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
          >
            <option value="ALL">All Sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="text-center py-12 text-muted">Loading leads...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <p className="text-muted text-sm">No leads found.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 px-4 py-2 bg-lime text-black text-xs font-semibold rounded-lg hover:bg-lime-dark"
            >
              Add First Lead
            </button>
          </div>
        ) : view === 'list' ? (
          /* List View */
          <div className="grid gap-2.5">
            {leads.map((lead) => {
              const overdue = isOverdue(lead.next_follow_up_date)
              const dueToday = isDueToday(lead.next_follow_up_date)

              async function handleDirectDelete(e: React.MouseEvent, id: string, name: string) {
                e.preventDefault()
                e.stopPropagation()
                if (!confirm(`Delete lead "${name}"?`)) return
                try {
                  await deleteLead(id)
                  loadData()
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to delete')
                }
              }

              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block p-4 bg-card border border-border rounded-xl hover:border-lime/40 transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{lead.name}</span>
                        {lead.business_name && (
                          <span className="text-xs text-muted">· {lead.business_name}</span>
                        )}
                      </div>
                      {lead.phone && <div className="text-xs text-muted mt-0.5">{lead.phone}</div>}
                    </div>

                    <div className="flex items-center gap-2">
                      {lead.stage === 'Won' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            router.push(`/orders/new?from_lead=${lead.id}`)
                          }}
                          className="px-2.5 py-1 bg-lime text-black text-[11px] font-semibold rounded-lg hover:bg-lime-dark flex items-center gap-1 shadow-sm transition-colors"
                          title="Convert this won lead to an order with full editing"
                        >
                          <span>📦</span> Convert to Order
                        </button>
                      )}
                      <span
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${STAGE_COLORS[lead.stage] || 'bg-card border-border text-foreground'
                          }`}
                      >
                        {lead.stage}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDirectDelete(e, lead.id, lead.name)}
                        className="text-muted hover:text-danger p-1 text-xs"
                        title="Delete lead"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs border-t border-border/50 pt-2 text-muted">
                    <span>Source: {lead.source || 'other'}</span>
                    {lead.next_follow_up_date && (
                      <span
                        className={
                          overdue
                            ? 'text-danger font-medium'
                            : dueToday
                              ? 'text-warning font-medium'
                              : ''
                        }
                      >
                        Follow-up: {formatDate(lead.next_follow_up_date)}
                        {overdue ? ' (Overdue)' : dueToday ? ' (Today)' : ''}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          /* Kanban View */
          <div className="kanban-scroll flex gap-3 pb-4">
            {LEAD_STAGES.map((stage) => {
              const stageLeads = leads.filter((l) => l.stage === stage)
              async function handleDirectDelete(e: React.MouseEvent, id: string, name: string) {
                e.preventDefault()
                e.stopPropagation()
                if (!confirm(`Delete lead "${name}"?`)) return
                try {
                  await deleteLead(id)
                  loadData()
                } catch (err: unknown) {
                  alert(err instanceof Error ? err.message : 'Failed to delete')
                }
              }

              return (
                <div
                  key={stage}
                  className="w-72 shrink-0 bg-card/60 border border-border rounded-xl p-3 flex flex-col max-h-[75vh]"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
                    <span className="font-semibold text-xs tracking-wider uppercase text-muted">
                      {stage}
                    </span>
                    <span className="text-xs bg-black px-2 py-0.5 rounded text-muted font-mono">
                      {stageLeads.length}
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {stageLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="block p-3 bg-black border border-border rounded-lg hover:border-lime/50 transition-colors text-xs"
                      >
                        <p className="font-medium text-foreground">{lead.name}</p>
                        {lead.business_name && (
                          <p className="text-muted text-[11px] truncate">{lead.business_name}</p>
                        )}
                        {lead.phone && <p className="text-muted text-[11px] mt-1">{lead.phone}</p>}
                        {lead.next_follow_up_date && (
                          <div
                            className={`mt-2 text-[10px] ${isOverdue(lead.next_follow_up_date)
                              ? 'text-danger'
                              : isDueToday(lead.next_follow_up_date)
                                ? 'text-warning'
                                : 'text-muted'
                              }`}
                          >
                            Due: {formatDate(lead.next_follow_up_date)}
                          </div>
                        )}
                        {lead.stage === 'Won' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              router.push(`/orders/new?from_lead=${lead.id}`)
                            }}
                            className="mt-2 w-full py-1 px-2 bg-lime text-black text-[10px] font-bold rounded flex items-center justify-center gap-1 hover:bg-lime-dark"
                            title="Convert to Order"
                          >
                            <span>📦</span> Convert to Order
                          </button>
                        )}
                      </Link>
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="text-center py-6 text-muted text-xs italic">Empty</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Floating Quick Add Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-20 right-5 md:bottom-8 md:right-8 w-14 h-14 rounded-full bg-lime text-black font-bold flex items-center justify-center shadow-lg hover:bg-lime-dark text-2xl z-40"
          title="Quick Add Lead"
        >
          +
        </button>

        {/* Quick Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-lime">Quick Add Lead</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleQuickAdd} className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Business Name</label>
                  <input
                    type="text"
                    value={newBiz}
                    onChange={(e) => setNewBiz(e.target.value)}
                    placeholder="e.g. Calicut Motors"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted mb-1">Source (Dropdown)</label>
                    <select
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
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
                    <label className="block text-xs text-muted mb-1">Interested Product / Service</label>
                    <select
                      value={newProduct}
                      onChange={(e) => setNewProduct(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    >
                      <option value="">-- Select Product / Service --</option>
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
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">
                    Source Details / Specifics (Additional Text Box)
                  </label>
                  <input
                    type="text"
                    value={newSourceDetail}
                    onChange={(e) => setNewSourceDetail(e.target.value)}
                    placeholder="e.g. Referred by Rahul, Instagram DM, Expo Stall #4..."
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Additional context..."
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 bg-lime text-black font-semibold rounded-lg text-sm hover:bg-lime-dark disabled:opacity-50"
                  >
                    {creating ? 'Saving...' : 'Create Lead'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 bg-black border border-border text-muted rounded-lg text-sm hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCsvModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-lime">Import Leads from CSV</h2>
                <button
                  onClick={() => setShowCsvModal(false)}
                  className="text-muted hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted">
                Paste CSV data below with a header row. Columns can include:{' '}
                <code className="text-lime">name, business_name, phone, source</code>.
              </p>

              <form onSubmit={handleImportCsv} className="space-y-3">
                <textarea
                  rows={6}
                  required
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`name,business_name,phone,source\nJohn Doe,Tech Hub,+919876543210,instagram`}
                  className="w-full p-3 font-mono text-xs rounded-lg bg-black border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
                />

                {importResult && (
                  <div className="p-3 bg-black rounded-lg border border-border text-xs space-y-1">
                    <p className="text-lime font-semibold">
                      Successfully imported: {importResult.imported} leads
                    </p>
                    {importResult.errors.length > 0 && (
                      <div className="text-danger space-y-0.5">
                        {importResult.errors.map((e, idx) => (
                          <p key={idx}>{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={importing}
                    className="flex-1 py-2.5 bg-lime text-black font-semibold rounded-lg text-sm hover:bg-lime-dark disabled:opacity-50"
                  >
                    {importing ? 'Importing...' : 'Start Import'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCsvModal(false)}
                    className="px-4 py-2.5 bg-black border border-border text-muted rounded-lg text-sm hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
