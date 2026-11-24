import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
const dbName = process.env.MONGODB_DB || 'doubletap'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

export function isMongoConfigured(): boolean {
  const currentUri = process.env.MONGODB_URI || ''
  return currentUri.trim().length > 0 && !currentUri.includes('YOUR_MONGODB_URI_HERE')
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  if (!isMongoConfigured()) {
    return null
  }

  const currentUri = process.env.MONGODB_URI || ''

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  try {
    let clientPromise: Promise<MongoClient>

    if (process.env.NODE_ENV === 'development') {
      if (!global._mongoClientPromise) {
        const client = new MongoClient(currentUri)
        global._mongoClientPromise = client.connect()
      }
      clientPromise = global._mongoClientPromise
    } else {
      const client = new MongoClient(currentUri)
      clientPromise = client.connect()
    }

    const client = await clientPromise
    const db = client.db(dbName)

    cachedClient = client
    cachedDb = db

    return { client, db }
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error)
    return null
  }
}
