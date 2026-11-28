import fs from 'fs/promises'
import path from 'path'
import {
  Product,
  Lead,
  Customer,
  Order,
  OrderItem,
  Activity,
  Settings,
  WhatsAppTemplate,
  Transaction,
  SEED_PRODUCTS,
  SEED_WA_TEMPLATES,
} from './types'
import { connectToDatabase, isMongoConfigured } from './mongodb'
import { Db } from 'mongodb'

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

export interface DatabaseSchema {
  products: Product[]
  leads: Lead[]
  customers: Customer[]
  orders: Order[]
  order_items: OrderItem[]
  activities: Activity[]
  settings: Settings['data']
  whatsapp_templates: WhatsAppTemplate[]
  transactions: Transaction[]
  order_counter: number
}

const DEFAULT_SETTINGS: Settings['data'] = {
  business_name: 'Double Tap NFC',
  business_phone: '+91 8304830149',
  business_email: 'hello@doubletapnfc.com',
  business_address: 'Calicut, Kerala, India',
  payment_details:
    'Bank: State Bank of India\nAccount: 123456789012\nIFSC: SBIN0001234\nUPI ID: 8304830149@upi\nGoogle Pay / PhonePe: +91 8304830149',
}

export function getDefaultDB(): DatabaseSchema {
  const now = new Date().toISOString()
  return {
    products: SEED_PRODUCTS.map((p, i) => ({
      ...p,
      id: `prod_${i + 1}`,
      user_id: 'owner',
      created_at: now,
    })),
    leads: [],
    customers: [],
    orders: [],
    order_items: [],
    activities: [],
    settings: DEFAULT_SETTINGS,
    whatsapp_templates: SEED_WA_TEMPLATES.map((t, i) => ({
      ...t,
      id: `tpl_${i + 1}`,
      user_id: 'owner',
      created_at: now,
    })),
    transactions: [],
    order_counter: 0,
  }
}

async function readLocalFileDB(): Promise<DatabaseSchema> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    const localDB: DatabaseSchema = {
      ...getDefaultDB(),
      ...parsed,
      leads: parsed.leads || [],
      customers: parsed.customers || [],
      orders: parsed.orders || [],
      order_items: parsed.order_items || [],
      activities: parsed.activities || [],
      transactions: parsed.transactions || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    }

    // Auto-sync won leads into customers locally as well
    let modified = false
    for (const lead of localDB.leads) {
      if (lead.stage === 'Won') {
        const hasCustomer = localDB.customers.some(
          (c) => c.lead_id === lead.id || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
        )
        if (!hasCustomer) {
          localDB.customers.unshift({
            id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            user_id: 'owner',
            name: lead.name,
            business_name: lead.business_name || null,
            phone: lead.phone || null,
            email: null,
            address: null,
            lead_id: lead.id,
            notes: lead.notes || null,
            created_at: lead.created_at || new Date().toISOString(),
          })
          modified = true
        }
      }
    }
    if (modified) {
      await writeLocalFileDB(localDB)
    }

    return localDB
  } catch {
    const initial = getDefaultDB()
    await writeLocalFileDB(initial)
    return initial
  }
}

async function writeLocalFileDB(db: DatabaseSchema): Promise<void> {
  try {
    const dir = path.dirname(DB_PATH)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
  } catch (err) {
    console.error('Error writing local JSON backup:', err)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncCollection(db: Db, collectionName: string, items: any[]): Promise<void> {
  const col = db.collection(collectionName)
  if (!items || items.length === 0) {
    await col.deleteMany({})
    return
  }

  const ids = items.map((it) => it.id)
  await col.deleteMany({ id: { $nin: ids } })

  const ops = items.map((it) => {
    // Strip MongoDB internal _id to avoid "modifying immutable field _id" error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...cleanDoc } = it
    return {
      updateOne: {
        filter: { id: cleanDoc.id },
        update: { $set: cleanDoc },
        upsert: true,
      },
    }
  })
  if (ops.length > 0) {
    await col.bulkWrite(ops)
  }
}

async function writeMongoCollections(db: Db, data: DatabaseSchema): Promise<void> {
  await Promise.all([
    syncCollection(db, 'products', data.products),
    syncCollection(db, 'leads', data.leads),
    syncCollection(db, 'customers', data.customers),
    syncCollection(db, 'orders', data.orders),
    syncCollection(db, 'order_items', data.order_items),
    syncCollection(db, 'activities', data.activities),
    syncCollection(db, 'whatsapp_templates', data.whatsapp_templates),
    syncCollection(db, 'transactions', data.transactions),
    db.collection('settings').updateOne(
      { id: 'global' },
      { $set: { id: 'global', ...data.settings } },
      { upsert: true }
    ),
    db.collection('counters').updateOne(
      { id: 'order_counter' },
      { $set: { id: 'order_counter', count: data.order_counter || 0 } },
      { upsert: true }
    ),
  ])
}

declare global {
  // eslint-disable-next-line no-var
  var _dtDbCache: { data: DatabaseSchema; timestamp: number } | undefined
}

const CACHE_TTL_MS = 30000 // 30-second in-memory cache makes page navigation and reloads instant (0ms)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripMongoId(doc: any) {
  if (!doc) return doc
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...clean } = doc
  return clean
}

export async function readDB(forceFresh = false): Promise<DatabaseSchema> {
  const now = Date.now()
  if (!forceFresh && globalThis._dtDbCache && now - globalThis._dtDbCache.timestamp < CACHE_TTL_MS) {
    return globalThis._dtDbCache.data
  }

  if (isMongoConfigured()) {
    const mongo = await connectToDatabase()
    if (mongo) {
      try {
        const { db } = mongo

        // Fast-path: Single-query atomic snapshot (< 50ms vs 500ms+ for 10 collections)
        const snapshot = await db.collection('app_snapshot').findOne({ id: 'current' })
        if (snapshot && Array.isArray(snapshot.orders) && snapshot.orders.length > 0) {
          const result: DatabaseSchema = {
            products: (snapshot.products || []).map(stripMongoId),
            leads: (snapshot.leads || []).map(stripMongoId),
            customers: (snapshot.customers || []).map(stripMongoId),
            orders: (snapshot.orders || []).map(stripMongoId),
            order_items: (snapshot.order_items || []).map(stripMongoId),
            activities: (snapshot.activities || []).map(stripMongoId),
            settings: snapshot.settings ? stripMongoId(snapshot.settings) : DEFAULT_SETTINGS,
            whatsapp_templates: (snapshot.whatsapp_templates || []).map(stripMongoId),
            transactions: (snapshot.transactions || []).map(stripMongoId),
            order_counter: snapshot.order_counter || 0,
          }
          globalThis._dtDbCache = { data: result, timestamp: Date.now() }
          return result
        }

        const [
          products,
          leads,
          customers,
          orders,
          order_items,
          activities,
          settingsDoc,
          whatsapp_templates,
          transactions,
          counterDoc,
        ] = await Promise.all([
          db.collection('products').find({}).toArray(),
          db.collection('leads').find({}).toArray(),
          db.collection('customers').find({}).toArray(),
          db.collection('orders').find({}).toArray(),
          db.collection('order_items').find({}).toArray(),
          db.collection('activities').find({}).toArray(),
          db.collection('settings').findOne({ id: 'global' }),
          db.collection('whatsapp_templates').find({}).toArray(),
          db.collection('transactions').find({}).toArray(),
          db.collection('counters').findOne({ id: 'order_counter' }),
        ])

        // First-time seed if database is empty
        if (products.length === 0) {
          const localData = await readLocalFileDB()
          await writeMongoCollections(db, localData)
          globalThis._dtDbCache = { data: localData, timestamp: Date.now() }
          return localData
        }

        const cleanLeads: Lead[] = leads.map(stripMongoId)
        const cleanCustomers: Customer[] = customers.map(stripMongoId)

        // Ensure all Won leads have a linked customer record
        let needSync = false
        for (const lead of cleanLeads) {
          if (lead.stage === 'Won') {
            const hasCustomer = cleanCustomers.some(
              (c) => c.lead_id === lead.id || (lead.phone && c.phone && c.phone.trim() === lead.phone.trim())
            )
            if (!hasCustomer) {
              const newCust: Customer = {
                id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                user_id: 'owner',
                name: lead.name,
                business_name: lead.business_name || null,
                phone: lead.phone || null,
                email: null,
                address: null,
                lead_id: lead.id,
                notes: lead.notes || null,
                created_at: lead.created_at || new Date().toISOString(),
              }
              cleanCustomers.unshift(newCust)
              needSync = true
            }
          }
        }
        if (needSync) {
          await syncCollection(db, 'customers', cleanCustomers)
        }

        const result: DatabaseSchema = {
          products: products.map(stripMongoId),
          leads: cleanLeads,
          customers: cleanCustomers,
          orders: orders.map(stripMongoId),
          order_items: order_items.map(stripMongoId),
          activities: activities.map(stripMongoId),
          settings: settingsDoc ? stripMongoId(settingsDoc) : DEFAULT_SETTINGS,
          whatsapp_templates: whatsapp_templates.map(stripMongoId),
          transactions: transactions.map(stripMongoId),
          order_counter: counterDoc?.count || 0,
        }

        // Cache snapshot in MongoDB for lightning fast subsequent reads
        await db.collection('app_snapshot').updateOne(
          { id: 'current' },
          { $set: { id: 'current', ...result } },
          { upsert: true }
        )

        globalThis._dtDbCache = { data: result, timestamp: Date.now() }
        return result
      } catch (err) {
        console.error('Error querying MongoDB, falling back to local file storage:', err)
        const fallback = await readLocalFileDB()
        globalThis._dtDbCache = { data: fallback, timestamp: Date.now() }
        return fallback
      }
    }
  }

  const fallback = await readLocalFileDB()
  globalThis._dtDbCache = { data: fallback, timestamp: Date.now() }
  return fallback
}

export async function writeDB(dbData: DatabaseSchema, changedCollections?: (keyof DatabaseSchema)[]): Promise<void> {
  // Update in-memory cache instantly so subsequent reads return fresh data immediately
  globalThis._dtDbCache = { data: dbData, timestamp: Date.now() }

  // Always maintain local backup
  await writeLocalFileDB(dbData)

  if (isMongoConfigured()) {
    const mongo = await connectToDatabase()
    if (mongo) {
      try {
        // Fast-path: Save single snapshot in 40ms so all read operations are instant
        await mongo.db.collection('app_snapshot').updateOne(
          { id: 'current' },
          { $set: { id: 'current', ...dbData } },
          { upsert: true }
        )

        if (changedCollections && changedCollections.length > 0) {
          const tasks: Promise<unknown>[] = []
          if (changedCollections.includes('products')) tasks.push(syncCollection(mongo.db, 'products', dbData.products))
          if (changedCollections.includes('leads')) tasks.push(syncCollection(mongo.db, 'leads', dbData.leads))
          if (changedCollections.includes('customers')) tasks.push(syncCollection(mongo.db, 'customers', dbData.customers))
          if (changedCollections.includes('orders')) tasks.push(syncCollection(mongo.db, 'orders', dbData.orders))
          if (changedCollections.includes('order_items')) tasks.push(syncCollection(mongo.db, 'order_items', dbData.order_items))
          if (changedCollections.includes('activities')) tasks.push(syncCollection(mongo.db, 'activities', dbData.activities))
          if (changedCollections.includes('whatsapp_templates')) tasks.push(syncCollection(mongo.db, 'whatsapp_templates', dbData.whatsapp_templates))
          if (changedCollections.includes('transactions')) tasks.push(syncCollection(mongo.db, 'transactions', dbData.transactions))
          if (changedCollections.includes('settings')) {
            tasks.push(
              mongo.db.collection('settings').updateOne(
                { id: 'global' },
                { $set: { id: 'global', ...dbData.settings } },
                { upsert: true }
              )
            )
          }
          if (changedCollections.includes('order_counter')) {
            tasks.push(
              mongo.db.collection('counters').updateOne(
                { id: 'order_counter' },
                { $set: { id: 'order_counter', count: dbData.order_counter || 0 } },
                { upsert: true }
              )
            )
          }
          await Promise.all(tasks)
        } else {
          await writeMongoCollections(mongo.db, dbData)
        }
      } catch (err) {
        console.error('Error writing to MongoDB:', err)
      }
    }
  }
}
