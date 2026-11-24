'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Product, ProductCategory } from '@/lib/types'
import { formatINR } from '@/lib/utils'
import { getProducts, createProduct, updateProduct, deleteProduct } from './actions'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState<string>('')
  const [editCategory, setEditCategory] = useState<ProductCategory>('card')
  const [editPrice, setEditPrice] = useState<number>(0)
  const [editCost, setEditCost] = useState<number>(0)
  const [editActive, setEditActive] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Add Product Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState<ProductCategory>('card')
  const [newPrice, setNewPrice] = useState<number | ''>('')
  const [newCost, setNewCost] = useState<number | ''>('')
  const [creating, setCreating] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const data = await getProducts()
      setProducts(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditName(product.name)
    setEditCategory(product.category)
    setEditPrice(product.price)
    setEditCost(product.my_cost)
    setEditActive(product.active)
    setMsg('')
  }

  async function handleSave(id: string) {
    if (!editName.trim()) {
      alert('Product name is required')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      await updateProduct(id, {
        name: editName.trim(),
        category: editCategory,
        price: Number(editPrice) || 0,
        my_cost: Number(editCost) || 0,
        active: editActive,
      })
      setEditingId(null)
      await loadData()
      setMsg('Product updated successfully!')
      setTimeout(() => setMsg(''), 3000)
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      await deleteProduct(id)
      setEditingId(null)
      await loadData()
      setMsg('Product deleted.')
      setTimeout(() => setMsg(''), 3000)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createProduct({
        name: newName.trim(),
        category: newCategory,
        price: Number(newPrice) || 0,
        my_cost: Number(newCost) || 0,
        active: true,
      })
      setShowAddModal(false)
      setNewName('')
      setNewPrice('')
      setNewCost('')
      setNewCategory('card')
      await loadData()
      setMsg('Product added successfully!')
      setTimeout(() => setMsg(''), 3000)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create product')
    } finally {
      setCreating(false)
    }
  }

  const cards = products.filter((p) => p.category === 'card')
  const services = products.filter((p) => p.category === 'service')

  return (
    <>
      <Header title="Products & Pricing" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted">
            Manage your card models, printing & encoding services, and cost prices.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-lime text-black font-semibold text-xs rounded-lg hover:bg-lime-dark shrink-0 shadow"
          >
            + Add Product
          </button>
        </div>

        {msg && (
          <div className="p-3 bg-lime/10 border border-lime text-lime rounded-xl text-xs font-medium">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted">Loading products...</div>
        ) : (
          <>
            {/* Cards section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-lime uppercase tracking-wider">
                  Cards ({cards.length})
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {cards.map((product) => renderProductCard(product))}
              </div>
            </div>

            {/* Services section */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-lime uppercase tracking-wider">
                  Services & Add-ons ({services.length})
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((product) => renderProductCard(product))}
              </div>
            </div>
          </>
        )}

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg text-lime">New Product / Service</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-muted hover:text-foreground text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Matte Black NFC Card"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                  />
                </div>

                <div>
                  <label className="block text-xs text-muted mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
                  >
                    <option value="card">Card (Physical Product)</option>
                    <option value="service">Service / Add-on</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted mb-1">Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">My Cost (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newCost}
                      onChange={(e) => setNewCost(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="e.g. 150"
                      className="w-full px-3 py-2 rounded-lg bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 bg-lime text-black font-semibold rounded-lg text-xs hover:bg-lime-dark disabled:opacity-50"
                  >
                    {creating ? 'Adding...' : 'Add to Catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
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

  function renderProductCard(product: Product) {
    const isEditing = editingId === product.id
    const margin = product.price > 0 ? (((product.price - product.my_cost) / product.price) * 100).toFixed(0) : '0'

    return (
      <div
        key={product.id}
        className={`p-4 rounded-xl border transition-all ${
          product.active ? 'bg-card border-border' : 'bg-card/50 border-border/50 opacity-60'
        }`}
      >
        {!isEditing ? (
          <>
            <div className="flex justify-between items-start gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-base text-foreground">{product.name}</h3>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] mt-1 ${
                    product.active ? 'bg-lime/20 text-lime font-medium' : 'bg-muted/20 text-muted'
                  }`}
                >
                  {product.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => startEdit(product)}
                  className="text-xs text-lime hover:underline px-2.5 py-1 rounded bg-lime/10 font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(product.id, product.name)}
                  className="text-xs text-danger hover:underline px-2 py-1 rounded bg-danger/10"
                  title="Delete product"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-1.5 bg-black/40 rounded">
                <span className="block text-muted text-[10px]">Price</span>
                <span className="font-semibold text-foreground">{formatINR(product.price)}</span>
              </div>
              <div className="p-1.5 bg-black/40 rounded">
                <span className="block text-muted text-[10px]">Cost</span>
                <span className="text-muted">{formatINR(product.my_cost)}</span>
              </div>
              <div className="p-1.5 bg-black/40 rounded">
                <span className="block text-muted text-[10px]">Margin</span>
                <span className="text-lime font-medium">{margin}%</span>
              </div>
            </div>
          </>
        ) : (
          /* Inline Edit Form */
          <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <span className="text-xs font-bold text-lime uppercase">Edit Product</span>
              <button
                type="button"
                onClick={() => handleDelete(product.id, product.name)}
                className="text-xs text-danger hover:underline font-medium"
              >
                Delete Product
              </button>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Product Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 rounded bg-black border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-lime"
              >
                <option value="card">Card (Physical Product)</option>
                <option value="service">Service / Add-on</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted mb-1">Selling Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">My Cost (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={editCost}
                  onChange={(e) => setEditCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id={`active-${product.id}`}
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="w-4 h-4 accent-lime rounded"
              />
              <label htmlFor={`active-${product.id}`} className="text-xs text-foreground cursor-pointer">
                Active in Catalog
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleSave(product.id)}
                disabled={saving}
                className="flex-1 py-2 bg-lime text-black font-semibold text-xs rounded hover:bg-lime-dark disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 bg-card-hover text-muted text-xs rounded hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
}
