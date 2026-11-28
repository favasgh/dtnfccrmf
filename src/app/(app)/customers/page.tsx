'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Customer } from '@/lib/types'
import { formatINR } from '@/lib/utils'
import { getCustomers, createCustomer, deleteCustomer } from './actions'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<(Customer & { orders_count?: number; total_spent?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  // Add Customer modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData(silent = false, forceFresh = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await getCustomers(search, forceFresh)
      setCustomers(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true)
      }
    }, 45000)

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
  }, [search])

  async function handleDirectDelete(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Delete customer "${name}" and all associated orders?`)) return
    try {
      await deleteCustomer(id)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete customer')
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadData()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await createCustomer({
        name: name.trim(),
        business_name: businessName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      setShowAddModal(false)
      setName('')
      setBusinessName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setNotes('')
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="Customers" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* Search & Actions */}
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search customers..."
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

          <button
            onClick={() => loadData(true, true)}
            disabled={refreshing}
            className="px-3 py-2 bg-card border border-border text-xs rounded-lg hover:bg-card-hover text-muted hover:text-foreground flex items-center justify-center"
            title="Sync fresh from cloud"
          >
            <span className={`inline-block text-xs ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark shrink-0"
          >
            + Add Customer
          </button>
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="text-center py-12 text-muted">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <p className="text-muted text-sm">No customers yet.</p>
            <p className="text-xs text-muted mt-1">Convert a won lead or add one directly.</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {customers.map((c) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="block p-4 bg-card border border-border rounded-xl hover:border-lime/40 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-base">{c.name}</h3>
                      {c.lead_id && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-lime/15 text-lime border border-lime/40 font-medium">
                          Won Lead
                        </span>
                      )}
                    </div>
                    {c.business_name && (
                      <p className="text-xs text-muted">{c.business_name}</p>
                    )}
                    {c.phone && <p className="text-xs text-lime font-mono mt-1">{c.phone}</p>}

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          window.location.href = `/orders/new?customer_id=${c.id}`
                        }}
                        className="px-2.5 py-1 bg-lime/10 hover:bg-lime/20 text-lime border border-lime/30 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Create a new order for this customer with full editing"
                      >
                        <span>📦</span> + Create Order
                      </button>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className="text-xs font-semibold text-foreground">
                      {formatINR(c.total_spent || 0)}
                    </span>
                    <span className="block text-[10px] text-muted">
                      {c.orders_count || 0} order{(c.orders_count || 0) === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDirectDelete(e, c.id, c.name)}
                      className="text-muted hover:text-danger text-xs mt-2 p-0.5"
                      title="Delete customer"
                    >
                      ✕ Delete
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Add Customer Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-lime">New Customer</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Asif Ali"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Business Name</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Malabar Cafe"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted mb-1">Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9999999999"
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="asif@gmail.com"
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Address (for delivery)</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calicut, Kerala..."
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Customer notes..."
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-lime text-black font-semibold rounded-lg text-sm hover:bg-lime-dark disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Customer'}
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
      </div>
    </>
  )
}
