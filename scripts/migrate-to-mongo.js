const { MongoClient } = require('mongodb')
const fs = require('fs')
const path = require('path')
const dns = require('dns')

try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch (e) {}

// Load .env.local if present
const envLocalPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8')
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const val = match[2].trim()
      if (!process.env[key]) process.env[key] = val
    }
  })
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doubletap'
const dbName = process.env.MONGODB_DB || 'doubletap'
const dbJsonPath = path.join(__dirname, '..', 'data', 'db.json')

async function migrate() {
  console.log(`Connecting to MongoDB at: ${uri}...`)
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  console.log(`Connected to database "${dbName}".`)

  if (!fs.existsSync(dbJsonPath)) {
    console.error('db.json not found at:', dbJsonPath)
    await client.close()
    return
  }

  const raw = fs.readFileSync(dbJsonPath, 'utf8')
  const data = JSON.parse(raw)

  const collections = [
    { name: 'products', items: data.products || [] },
    { name: 'leads', items: data.leads || [] },
    { name: 'customers', items: data.customers || [] },
    { name: 'orders', items: data.orders || [] },
    { name: 'order_items', items: data.order_items || [] },
    { name: 'activities', items: data.activities || [] },
    { name: 'whatsapp_templates', items: data.whatsapp_templates || [] },
    { name: 'transactions', items: data.transactions || [] },
  ]

  for (const col of collections) {
    await db.collection(col.name).deleteMany({})
    if (col.items.length > 0) {
      await db.collection(col.name).insertMany(col.items.map((it) => ({ ...it })))
    }
    console.log(`✓ Migrated ${col.items.length} records into collection "${col.name}"`)
  }

  // Settings
  if (data.settings) {
    await db.collection('settings').updateOne(
      { id: 'global' },
      { $set: { id: 'global', ...data.settings } },
      { upsert: true }
    )
    console.log('✓ Settings stored in collection "settings"')
  }

  // Counters
  await db.collection('counters').updateOne(
    { id: 'order_counter' },
    { $set: { id: 'order_counter', count: data.order_counter || 0 } },
    { upsert: true }
  )
  console.log(`✓ Order counter set to ${data.order_counter || 0}`)

  console.log('\n🎉 ALL DATA SUCCESSFULLY MIGRATED TO MONGODB!')
  await client.close()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
