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
    return {
      ...getDefaultDB(),
      ...parsed,
      transactions: parsed.transactions || [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    }
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

async function writeMongoCollections(db: Db, data: DatabaseSchema): Promise<void> {
  // Sync products
  await db.collection('products').deleteMany({})
  if (data.products?.length > 0) {
    await db.collection('products').insertMany(data.products.map((p) => ({ ...p })))
  }

  // Sync leads
  await db.collection('leads').deleteMany({})
  if (data.leads?.length > 0) {
    await db.collection('leads').insertMany(data.leads.map((l) => ({ ...l })))
  }

  // Sync customers
  await db.collection('customers').deleteMany({})
  if (data.customers?.length > 0) {
    await db.collection('customers').insertMany(data.customers.map((c) => ({ ...c })))
  }

  // Sync orders
  await db.collection('orders').deleteMany({})
  if (data.orders?.length > 0) {
    await db.collection('orders').insertMany(data.orders.map((o) => ({ ...o })))
  }

  // Sync order_items
  await db.collection('order_items').deleteMany({})
  if (data.order_items?.length > 0) {
    await db.collection('order_items').insertMany(data.order_items.map((i) => ({ ...i })))
  }

  // Sync activities
  await db.collection('activities').deleteMany({})
  if (data.activities?.length > 0) {
    await db.collection('activities').insertMany(data.activities.map((a) => ({ ...a })))
  }

  // Sync whatsapp_templates
  await db.collection('whatsapp_templates').deleteMany({})
  if (data.whatsapp_templates?.length > 0) {
    await db.collection('whatsapp_templates').insertMany(data.whatsapp_templates.map((t) => ({ ...t })))
  }

  // Sync transactions
  await db.collection('transactions').deleteMany({})
  if (data.transactions?.length > 0) {
    await db.collection('transactions').insertMany(data.transactions.map((t) => ({ ...t })))
  }

  // Sync settings
  await db.collection('settings').updateOne(
    { id: 'global' },
    { $set: { id: 'global', ...data.settings } },
    { upsert: true }
  )

  // Sync counter
  await db.collection('counters').updateOne(
    { id: 'order_counter' },
    { $set: { id: 'order_counter', count: data.order_counter || 0 } },
    { upsert: true }
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripMongoId(doc: any) {
  if (!doc) return doc
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...clean } = doc
  return clean
}

export async function readDB(): Promise<DatabaseSchema> {
  if (isMongoConfigured()) {
    const mongo = await connectToDatabase()
    if (mongo) {
      try {
        const { db } = mongo

        // Check if database is initialized
        const productsCount = await db.collection('products').countDocuments()
        if (productsCount === 0) {
          // Auto-migrate from existing local JSON DB
          const localData = await readLocalFileDB()
          await writeMongoCollections(db, localData)
          return localData
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

        return {
          products: products.map(stripMongoId),
          leads: leads.map(stripMongoId),
          customers: customers.map(stripMongoId),
          orders: orders.map(stripMongoId),
          order_items: order_items.map(stripMongoId),
          activities: activities.map(stripMongoId),
          settings: settingsDoc ? stripMongoId(settingsDoc) : DEFAULT_SETTINGS,
          whatsapp_templates: whatsapp_templates.map(stripMongoId),
          transactions: transactions.map(stripMongoId),
          order_counter: counterDoc?.count || 0,
        }
      } catch (err) {
        console.error('Error querying MongoDB, falling back to local file storage:', err)
        return readLocalFileDB()
      }
    }
  }

  return readLocalFileDB()
}

export async function writeDB(dbData: DatabaseSchema): Promise<void> {
  // Always maintain local backup
  await writeLocalFileDB(dbData)

  if (isMongoConfigured()) {
    const mongo = await connectToDatabase()
    if (mongo) {
      try {
        await writeMongoCollections(mongo.db, dbData)
      } catch (err) {
        console.error('Error writing to MongoDB:', err)
      }
    }
  }
}
