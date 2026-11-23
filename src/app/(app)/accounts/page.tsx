'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Transaction, TransactionType, ExpenseCategory, EXPENSE_CATEGORIES } from '@/lib/types'
import { formatINR, formatDate } from '@/lib/utils'
import { getTransactions, addTransaction, deleteTransaction, getFinancialSummary } from './actions'

export default function AccountsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState({
    totalInflow: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    pendingReceivables: 0,
    orderCashInflow: 0,
    categoryBreakdown: {} as Record<string, number>,
  })
  const [loading, setLoading] = useState(true)

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  // Add Transaction Modal
  const [showModal, setShowModal] = useState(false)
  const [formType, setFormType] = useState<TransactionType>('expense')
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('printo')
  const [formAmount, setFormAmount] = useState<number | ''>('')
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formMethod, setFormMethod] = useState<'upi' | 'bank' | 'cash'>('upi')
  const [formDesc, setFormDesc] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const [txList, sum] = await Promise.all([
        getTransactions({
          type: typeFilter,
          category: categoryFilter,
          search,
        }),
        getFinancialSummary(),
      ])
      setTransactions(txList)
      setSummary(sum)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [typeFilter, categoryFilter])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadData()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    if (!formAmount || Number(formAmount) <= 0) {
      setErrorMsg('Please enter a valid amount')
      return
    }
    if (!formDesc.trim()) {
      setErrorMsg('Please enter a description')
      return
    }

    setSubmitting(true)
    try {
      await addTransaction({
        type: formType,
        category: formCategory,
        amount: Number(formAmount),
        date: formDate,
        payment_method: formMethod,
        description: formDesc.trim(),
      })
      setShowModal(false)
      setFormAmount('')
      setFormDesc('')
      setFormCategory('printo')
      loadData()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add transaction')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return
    try {
      await deleteTransaction(id)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  function getCategoryLabel(catId: string): string {
    const found = EXPENSE_CATEGORIES.find((c) => c.id === catId)
    return found ? found.label : catId
  }

  return (
    <>
      <Header title="Accounts & Cash Flow" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Inflow */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">Total Cash Inflow</span>
            <span className="text-2xl font-bold text-lime font-mono block mt-1">
              {formatINR(summary.totalInflow)}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              Orders: {formatINR(summary.orderCashInflow)}
            </span>
          </div>

          {/* Total Expenses */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">Total Expenses</span>
            <span className="text-2xl font-bold text-danger font-mono block mt-1">
              {formatINR(summary.totalExpenses)}
            </span>
            <span className="text-[10px] text-muted block mt-1">Printo, materials, ads...</span>
          </div>

          {/* Net Cash Balance */}
          <div className="p-4 bg-black border border-lime/30 rounded-xl">
            <span className="text-xs text-lime font-medium flex items-center gap-1">
              <span>💳</span> Net Cash Balance
            </span>
            <span
              className={`text-2xl font-bold font-mono block mt-1 ${
                summary.netCashFlow >= 0 ? 'text-lime' : 'text-danger'
              }`}
            >
              {formatINR(summary.netCashFlow)}
            </span>
            <span className="text-[10px] text-muted block mt-1">Cash in hand / bank</span>
          </div>

          {/* Pending Receivables */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">Pending Receivables</span>
            <span className="text-2xl font-bold text-warning font-mono block mt-1">
              {formatINR(summary.pendingReceivables)}
            </span>
            <span className="text-[10px] text-muted block mt-1">Uncollected order balances</span>
          </div>
        </div>

        {/* Expense Category Breakdown */}
        {Object.keys(summary.categoryBreakdown).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-lime uppercase tracking-wider">
              Expense Breakdown by Category
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {Object.entries(summary.categoryBreakdown).map(([cat, amount]) => (
                <div key={cat} className="p-2.5 bg-black/50 border border-border/50 rounded-lg">
                  <span className="text-muted block text-[11px] truncate">{getCategoryLabel(cat)}</span>
                  <span className="font-bold text-foreground font-mono block mt-0.5">
                    {formatINR(amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search expenses or income..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-card border border-border text-xs rounded-lg hover:bg-card-hover font-medium"
            >
              Search
            </button>
          </form>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setFormType('expense')
                setShowModal(true)
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              <span>-</span> Add Expense
            </button>
            <button
              onClick={() => {
                setFormType('income')
                setShowModal(true)
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-lime text-black hover:bg-lime-dark text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              <span>+</span> Add Income
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 rounded font-medium ${
                typeFilter === 'ALL' ? 'bg-lime text-black' : 'text-muted hover:text-foreground'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1 rounded font-medium ${
                typeFilter === 'expense' ? 'bg-danger text-white' : 'text-muted hover:text-foreground'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1 rounded font-medium ${
                typeFilter === 'income' ? 'bg-lime text-black' : 'text-muted hover:text-foreground'
              }`}
            >
              Income
            </button>
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-lime"
          >
            <option value="ALL">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Transactions Table */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-lime uppercase tracking-wider">
            Transactions Ledger ({transactions.length})
          </h2>

          {loading ? (
            <div className="text-center py-8 text-muted text-xs">Loading ledger...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted text-xs">
              No transactions recorded yet. Click &quot;Add Expense&quot; to log your first vendor or Printo payment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium text-center">Method</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-black/30">
                      <td className="py-3 text-muted whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="py-3 font-medium text-foreground">{tx.description}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-black border border-border text-muted uppercase">
                          {getCategoryLabel(tx.category)}
                        </span>
                      </td>
                      <td className="py-3 text-center uppercase font-mono text-muted text-[10px]">
                        {tx.payment_method}
                      </td>
                      <td
                        className={`py-3 text-right font-bold font-mono text-sm ${
                          tx.type === 'expense' ? 'text-danger' : 'text-lime'
                        }`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}
                        {formatINR(tx.amount)}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="text-muted hover:text-danger text-xs px-1"
                          title="Delete entry"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Transaction Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-lime">
                  {formType === 'expense' ? 'Log Expense' : 'Log Income'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-danger/10 border border-danger/30 text-danger rounded-lg text-xs">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleAdd} className="space-y-3">
                {/* Type selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-black rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setFormType('expense')}
                    className={`py-1.5 text-xs font-semibold rounded ${
                      formType === 'expense' ? 'bg-danger text-white' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('income')}
                    className={`py-1.5 text-xs font-semibold rounded ${
                      formType === 'income' ? 'bg-lime text-black' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    Income (+)
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 600"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="e.g. UV Printing at Printo Calicut for 5 cards"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted mb-1">Payment Method</label>
                    <select
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value as 'upi' | 'bank' | 'cash')}
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    >
                      <option value="upi">UPI (GPay/PhonePe)</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1">Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-lime text-black font-semibold rounded-lg text-xs hover:bg-lime-dark disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Record Transaction'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-black border border-border text-muted rounded-lg text-xs hover:text-foreground"
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
