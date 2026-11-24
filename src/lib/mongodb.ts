import { MongoClient, Db } from 'mongodb'
import dns from 'dns'

// Force Google & Cloudflare DNS to guarantee SRV resolution across all ISPs (e.g. Airtel, Jio)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch {
  // Ignore if custom DNS cannot be set
}

const dbName = process.env.MONGODB_DB || 'doubletap'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export function isMongoConfigured(): boolean {
  const currentUri = process.env.MONGODB_URI || ''
  return currentUri.trim().length > 0 && !currentUri.includes('YOUR_MONGODB_URI_HERE')
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  if (!isMongoConfigured()) {
    return null
  }

  const currentUri = process.env.MONGODB_URI || ''

  // If already connected and ping succeeds, return cached connection
  if (cachedClient && cachedDb) {
    try {
      await cachedDb.command({ ping: 1 })
      return { client: cachedClient, db: cachedDb }
    } catch {
      // Stale connection, reconnect
      cachedClient = null
      cachedDb = null
    }
  }

  try {
    const client = new MongoClient(currentUri, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      serverSelectionTimeoutMS: 10000,
    })

    await client.connect()
    const db = client.db(dbName)

    cachedClient = client
    cachedDb = db

    return { client, db }
  } catch (error) {
    cachedClient = null
    cachedDb = null
    console.error('❌ Failed to connect to MongoDB:', error)
    return null
  }
}
