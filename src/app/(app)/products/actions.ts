'use server'

import { revalidatePath } from 'next/cache'
import { Product, ProductCategory } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getProducts(): Promise<Product[]> {
  const db = await readDB()
  return db.products.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export async function createProduct(formData: {
  name: string
  price: number
  my_cost: number
  category: ProductCategory
  active?: boolean
}) {
  if (!formData.name?.trim()) throw new Error('Product name is required')

  const db = await readDB()
  const newProduct: Product = {
    id: `prod_${Date.now()}`,
    user_id: 'owner',
    name: formData.name.trim(),
    price: Number(formData.price) || 0,
    my_cost: Number(formData.my_cost) || 0,
    category: formData.category || 'card',
    active: formData.active !== undefined ? formData.active : true,
    created_at: new Date().toISOString(),
  }

  db.products.push(newProduct)
  await writeDB(db)
  revalidatePath('/products')
  return newProduct
}

export async function updateProduct(
  id: string,
  updates: {
    name?: string
    price?: number
    my_cost?: number
    category?: ProductCategory
    active?: boolean
  }
) {
  const db = await readDB()
  const idx = db.products.findIndex((p) => p.id === id)
  if (idx !== -1) {
    db.products[idx] = {
      ...db.products[idx],
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.price !== undefined ? { price: Number(updates.price) } : {}),
      ...(updates.my_cost !== undefined ? { my_cost: Number(updates.my_cost) } : {}),
      ...(updates.category !== undefined ? { category: updates.category } : {}),
      ...(updates.active !== undefined ? { active: updates.active } : {}),
    }
    await writeDB(db)
  }
  revalidatePath('/products')
}

export async function deleteProduct(id: string) {
  const db = await readDB()
  db.products = db.products.filter((p) => p.id !== id)
  await writeDB(db)
  revalidatePath('/products')
}
