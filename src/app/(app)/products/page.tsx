'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Product } from '@/lib/types'
import { formatINR } from '@/lib/utils'
import { getProducts, updateProduct } from './actions'

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<number>(0)
  const [editCost, setEditCost] = useState<number>(0)
  const [editActive, setEditActive] = useState<boolean>(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

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
    setEditPrice(product.price)
    setEditCost(product.my_cost)
    setEditActive(product.active)
    setMsg('')
  }

  async function handleSave(id: string) {
    setSaving(true)
    setMsg('')
    try {
      await updateProduct(id, {
        price: Number(editPrice),
        my_cost: Number(editCost),
        active: editActive,
      })
      setEditingId(null)
      await loadData()
      setMsg('Product updated successfully!')
      setTimeout(() => setMsg(''), 3000)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setMsg(err.message)
      } else {
        setMsg('Failed to update product')
      }
    } finally {
      setSaving(false)
    }
  }

  const cards = products.filter((p) => p.category === 'card')
  const services = products.filter((p) => p.category === 'service')

  return (
    <>
      <Header title="Products & Pricing" />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        {msg && (
          <div className="p-3 bg-lime/10 border border-lime text-lime rounded-lg text-sm">
            {msg}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-muted">Loading products...</div>
        ) : (
          <>
            {/* Cards section */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-lime">Cards</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {cards.map((product) => renderProductCard(product))}
              </div>
            </div>

            {/* Services section */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-lime">Services & Add-ons</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((product) => renderProductCard(product))}
              </div>
            </div>
          </>
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
        <div className="flex justify-between items-start gap-2 mb-2">
          <div>
            <h3 className="font-semibold text-base">{product.name}</h3>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${
                product.active ? 'bg-lime/20 text-lime font-medium' : 'bg-muted/20 text-muted'
              }`}
            >
              {product.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          {!isEditing && (
            <button
              onClick={() => startEdit(product)}
              className="text-xs text-lime hover:underline px-2 py-1 rounded bg-lime/10"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3 mt-3 pt-3 border-t border-border">
            <div>
              <label className="block text-xs text-muted mb-1">Selling Price (₹)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">My Cost (₹)</label>
              <input
                type="number"
                value={editCost}
                onChange={(e) => setEditCost(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-black border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-lime"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`active-${product.id}`}
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="w-4 h-4 accent-lime rounded"
              />
              <label htmlFor={`active-${product.id}`} className="text-xs text-foreground">
                Active in Catalog
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleSave(product.id)}
                disabled={saving}
                className="flex-1 py-1.5 bg-lime text-black font-semibold text-xs rounded hover:bg-lime-dark disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-1.5 bg-card-hover text-muted text-xs rounded hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
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
        )}
      </div>
    )
  }
}
