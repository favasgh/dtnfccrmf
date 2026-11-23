'use server'

import { revalidatePath } from 'next/cache'
import { Product } from '@/lib/types'
import { readDB, writeDB } from '@/lib/db'

export async function getProducts(): Promise<Product[]> {
  const db = await readDB()
  return db.products.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export async function updateProduct(
  id: string,
  updates: { price: number; my_cost: number; active: boolean }
) {
  const db = await readDB()
  const idx = db.products.findIndex((p) => p.id === id)
  if (idx !== -1) {
    db.products[idx] = {
      ...db.products[idx],
      price: updates.price,
      my_cost: updates.my_cost,
      active: updates.active,
    }
    await writeDB(db)
  }
  revalidatePath('/products')
}
