'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { Transaction, TransactionType, ExpenseCategory, EXPENSE_CATEGORIES, OrderStatus } from '@/lib/types'
import { formatINR, formatDate } from '@/lib/utils'
import {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialSummary,
  SalesSummaryItem,
} from './actions'

const STATUS_COLORS: Record<string, string> = {
  'Awaiting Advance': 'bg-amber-950 text-amber-300 border-amber-800',
  'In Progress': 'bg-blue-950 text-blue-300 border-blue-800',
  'At Printo': 'bg-purple-950 text-purple-300 border-purple-800',
  Ready: 'bg-cyan-950 text-cyan-300 border-cyan-800',
  Delivered: 'bg-lime/20 text-lime border-lime/40',
  Closed: 'bg-gray-800 text-gray-300 border-gray-700',
  Cancelled: 'bg-red-950 text-red-300 border-red-800',
}

export default function AccountsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<{
    totalSales: number
    totalOrdersCount: number
    totalInflow: number
    totalExpenses: number
    netCashFlow: number
    pendingReceivables: number
    orderCashInflow: number
    directIncome: number
    categoryBreakdown: Record<string, number>
    salesOrders: SalesSummaryItem[]
  }>({
    totalSales: 0,
    totalOrdersCount: 0,
    totalInflow: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    pendingReceivables: 0,
    orderCashInflow: 0,
    directIncome: 0,
    categoryBreakdown: {},
    salesOrders: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Primary Tab: Sales vs Cash Transactions
  const [mainTab, setMainTab] = useState<'sales' | 'transactions'>('sales')

  // Filters
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [salesStatusFilter, setSalesStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  // Add / Edit Transaction Modal
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formType, setFormType] = useState<TransactionType>('expense')
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('printo')
  const [formAmount, setFormAmount] = useState<number | ''>('')
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formMethod, setFormMethod] = useState<'upi' | 'bank' | 'cash'>('upi')
  const [formDesc, setFormDesc] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
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
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [typeFilter, categoryFilter])

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
  }, [typeFilter, categoryFilter, search])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    loadData()
  }

  function handleOpenAdd(type: TransactionType) {
    setEditingId(null)
    setFormType(type)
    setFormCategory('printo')
    setFormAmount('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormMethod('upi')
    setFormDesc('')
    setErrorMsg('')
    setShowModal(true)
  }

  function handleOpenEdit(tx: Transaction) {
    setEditingId(tx.id)
    setFormType(tx.type)
    setFormCategory(tx.category as ExpenseCategory)
    setFormAmount(tx.amount)
    setFormDate(tx.date)
    setFormMethod(tx.payment_method)
    setFormDesc(tx.description)
    setErrorMsg('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
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
      if (editingId) {
        await updateTransaction(editingId, {
          type: formType,
          category: formCategory,
          amount: Number(formAmount),
          date: formDate,
          payment_method: formMethod,
          description: formDesc.trim(),
        })
      } else {
        await addTransaction({
          type: formType,
          category: formCategory,
          amount: Number(formAmount),
          date: formDate,
          payment_method: formMethod,
          description: formDesc.trim(),
        })
      }
      setShowModal(false)
      setEditingId(null)
      loadData()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save transaction')
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

  // Filter Sales Orders by search query & status
  const filteredSales = summary.salesOrders.filter((s) => {
    if (salesStatusFilter !== 'ALL' && s.status !== salesStatusFilter) {
      return false
    }
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      s.order_no.toLowerCase().includes(q) ||
      s.customer_name.toLowerCase().includes(q) ||
      (s.customer_business && s.customer_business.toLowerCase().includes(q)) ||
      s.items_summary.toLowerCase().includes(q)
    )
  })

  return (
    <>
      <Header title="Accounts & Sales" />
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Metric Cards - Includes Sales prominently */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Total Sales */}
          <div className="p-4 bg-card border border-border hover:border-lime/40 rounded-xl transition-colors">
            <span className="text-xs text-lime font-bold uppercase tracking-wider block">Total Sales</span>
            <span className="text-2xl font-black text-lime font-mono block mt-1">
              {formatINR(summary.totalSales)}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              {summary.totalOrdersCount} orders billed
            </span>
          </div>

          {/* Total Cash Inflow */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">Cash Collected</span>
            <span className="text-2xl font-bold text-foreground font-mono block mt-1">
              {formatINR(summary.totalInflow)}
            </span>
            <span className="text-[10px] text-muted block mt-1">
              Sales: {formatINR(summary.orderCashInflow)}
            </span>
          </div>

          {/* Total Expenses */}
          <div className="p-4 bg-card border border-border rounded-xl">
            <span className="text-xs text-muted font-medium block">Total Expenses</span>
            <span className="text-2xl font-bold text-danger font-mono block mt-1">
              {formatINR(summary.totalExpenses)}
            </span>
            <span className="text-[10px] text-muted block mt-1">Printo, ads, materials</span>
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
            <span className="text-[10px] text-muted block mt-1">Inflow - Expenses</span>
          </div>

          {/* Pending Receivables */}
          <div className="p-4 bg-card border border-border rounded-xl col-span-2 lg:col-span-1">
            <span className="text-xs text-muted font-medium block">Pending Due</span>
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

        {/* Main Section Navigation: Sales vs Transactions */}
        <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
          <button
            onClick={() => setMainTab('sales')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mainTab === 'sales' ? 'bg-lime text-black shadow' : 'text-muted hover:text-foreground'
            }`}
          >
            <span>🛒</span> Sales & Invoices ({summary.salesOrders.length})
          </button>
          <button
            onClick={() => setMainTab('transactions')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              mainTab === 'transactions' ? 'bg-lime text-black shadow' : 'text-muted hover:text-foreground'
            }`}
          >
            <span>💸</span> Expenses & Other Cash ({transactions.length})
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder={mainTab === 'sales' ? 'Search sales by customer, order no, or item...' : 'Search expenses or income...'}
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
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="px-3 py-2 bg-card border border-border text-xs rounded-lg hover:bg-card-hover text-muted hover:text-foreground flex items-center justify-center"
              title="Sync with cloud"
            >
              <span className={`inline-block text-xs ${refreshing ? 'animate-spin' : ''}`}>🔄</span>
            </button>

            {mainTab === 'sales' ? (
              <Link
                href="/orders/new"
                className="flex-1 sm:flex-none px-4 py-2.5 bg-lime text-black hover:bg-lime-dark text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
              >
                <span>+</span> New Sale / Order
              </Link>
            ) : (
              <>
                <button
                  onClick={() => handleOpenAdd('expense')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <span>-</span> Add Expense
                </button>
                <button
                  onClick={() => handleOpenAdd('income')}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-lime text-black hover:bg-lime-dark text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <span>+</span> Add Income
                </button>
              </>
            )}
          </div>
        </div>

        {/* 1. SALES & INVOICES TAB */}
        {mainTab === 'sales' && (
          <div className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <h2 className="text-sm font-semibold text-lime uppercase tracking-wider">
                Sales Ledger ({filteredSales.length})
              </h2>

              <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                {['ALL', 'Awaiting Advance', 'In Progress', 'Ready', 'Delivered', 'Closed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSalesStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      salesStatusFilter === st
                        ? 'bg-lime text-black font-semibold'
                        : 'bg-black/60 border border-border text-muted hover:text-foreground'
                    }`}
                  >
                    {st === 'ALL' ? 'All Statuses' : st}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted text-xs">Loading sales...</div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12 text-muted text-xs space-y-2">
                <p>No sales found.</p>
                <Link
                  href="/orders/new"
                  className="inline-block mt-2 px-3 py-1.5 bg-lime text-black font-semibold rounded-lg hover:bg-lime-dark text-xs"
                >
                  Create New Order / Sale
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="pb-2 font-medium">Order No</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Customer</th>
                      <th className="pb-2 font-medium">Items</th>
                      <th className="pb-2 font-medium text-center">Status</th>
                      <th className="pb-2 font-medium text-right">Bill Total</th>
                      <th className="pb-2 font-medium text-right">Advance Paid</th>
                      <th className="pb-2 font-medium text-right">Balance Due</th>
                      <th className="pb-2 font-medium text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredSales.map((s) => (
                      <tr key={s.id} className="hover:bg-black/30">
                        <td className="py-3 font-mono font-bold text-foreground">
                          <Link href={`/orders/${s.id}`} className="hover:text-lime hover:underline">
                            {s.order_no}
                          </Link>
                        </td>
                        <td className="py-3 text-muted whitespace-nowrap">{formatDate(s.order_date)}</td>
                        <td className="py-3 font-medium text-foreground">
                          <div>{s.customer_name}</div>
                          {s.customer_business && (
                            <div className="text-[10px] text-muted">{s.customer_business}</div>
                          )}
                        </td>
                        <td className="py-3 text-muted max-w-[200px] truncate" title={s.items_summary}>
                          {s.items_summary}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              STATUS_COLORS[s.status] || 'bg-card border-border'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold font-mono text-foreground">
                          {formatINR(s.total_amount)}
                        </td>
                        <td className="py-3 text-right font-mono text-muted">
                          {formatINR(s.advance_amount)}
                        </td>
                        <td className="py-3 text-right font-mono font-bold">
                          {s.balance_due > 0 ? (
                            <span className="text-danger">{formatINR(s.balance_due)}</span>
                          ) : (
                            <span className="text-lime text-[11px]">✓ Paid</span>
                          )}
                        </td>
                        <td className="py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <Link
                              href={`/orders/${s.id}/invoice`}
                              className="px-2 py-1 bg-black border border-border text-muted hover:text-foreground rounded text-[11px] font-medium flex items-center gap-1 hover:border-lime/40"
                              title="View Printable Invoice"
                            >
                              <span>📄</span> Bill
                            </Link>
                            <Link
                              href={`/orders/${s.id}/edit`}
                              className="px-2 py-1 bg-black border border-border text-muted hover:text-lime rounded text-[11px] font-medium flex items-center gap-1 hover:border-lime/40"
                              title="Edit Bill"
                            >
                              <span>✏️</span> Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2. TRANSACTIONS & EXPENSES TAB */}
        {mainTab === 'transactions' && (
          <div className="space-y-4">
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
                  Other Income
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
                Cash Transactions Ledger ({transactions.length})
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
                          <td className="py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEdit(tx)}
                              className="text-muted hover:text-lime text-xs px-1 mr-1"
                              title="Edit entry"
                            >
                              ✏️
                            </button>
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
          </div>
        )}

        {/* Add Transaction Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-lime">
                  {editingId ? 'Edit Transaction' : formType === 'expense' ? 'Log Expense' : 'Log Income'}
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

              <form onSubmit={handleSubmit} className="space-y-3">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1">Payment Method</label>
                    <select
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value as 'upi' | 'bank' | 'cash')}
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                    >
                      <option value="upi">UPI</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Description *</label>
                  <input
                    type="text"
                    required
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="e.g. 10 UV Printed cards Printo Calicut"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-card border border-border text-muted text-xs rounded-lg hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : editingId ? 'Update' : 'Save'}
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
