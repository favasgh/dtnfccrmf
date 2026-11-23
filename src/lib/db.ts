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

const DB_PATH = path.join(process.cwd(), 'data', 'db.json')

interface DatabaseSchema {
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

function getDefaultDB(): DatabaseSchema {
  const now = new Date().toISOString()
  return {
    products: SEED_PRODUCTS.map((p, i) => ({
      ...p,
      id: `prod_${i + 1}`,
      user_id: 'owner',
      created_at: now,
    })),
    leads: [
      {
        id: 'lead_1',
        user_id: 'owner',
        name: 'Rahul Sharma',
        business_name: 'Calicut Motors',
        business_type: 'Automobile',
        phone: '+91 9876543210',
        source: 'instagram',
        stage: 'Interested',
        interested_product: 'Signature Pro',
        objection: null,
        notes: 'Interested in NFC cards for showroom staff',
        next_follow_up_date: new Date().toISOString().split('T')[0],
        created_at: now,
      },
    ],
    customers: [
      {
        id: 'cust_1',
        user_id: 'owner',
        name: 'Asif Ali',
        business_name: 'Malabar Roasters',
        phone: '+91 8304830149',
        email: 'asif@malabar.com',
        address: 'SM Street, Calicut, Kerala',
        lead_id: null,
        notes: 'Premium client',
        created_at: now,
      },
    ],
    orders: [],
    order_items: [],
    activities: [
      {
        id: 'act_1',
        user_id: 'owner',
        lead_id: 'lead_1',
        customer_id: null,
        type: 'note',
        text: 'Initial contact via Instagram direct message',
        created_at: now,
      },
    ],
    settings: DEFAULT_SETTINGS,
    whatsapp_templates: SEED_WA_TEMPLATES.map((t, i) => ({
      ...t,
      id: `tpl_${i + 1}`,
      user_id: 'owner',
      created_at: now,
    })),
    transactions: [
      {
        id: 'tx_1',
        user_id: 'owner',
        type: 'expense',
        category: 'printo',
        amount: 600,
        date: new Date().toISOString().split('T')[0],
        payment_method: 'upi',
        description: 'UV Print run at Printo Calicut for sample cards',
        created_at: now,
      },
      {
        id: 'tx_2',
        user_id: 'owner',
        type: 'expense',
        category: 'raw_materials',
        amount: 1200,
        date: new Date().toISOString().split('T')[0],
        payment_method: 'bank',
        description: 'Batch of 20 blank PVC NFC cards',
        created_at: now,
      },
    ],
    order_counter: 0,
  }
}

export async function readDB(): Promise<DatabaseSchema> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8')
    const parsed = JSON.parse(data)
    return {
      ...getDefaultDB(),
      ...parsed,
      transactions: parsed.transactions || getDefaultDB().transactions,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    }
  } catch {
    const initial = getDefaultDB()
    await writeDB(initial)
    return initial
  }
}

export async function writeDB(db: DatabaseSchema): Promise<void> {
  const dir = path.dirname(DB_PATH)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}
