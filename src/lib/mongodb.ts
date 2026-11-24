import { MongoClient, Db } from 'mongodb'
import dns from 'dns'
import { promisify } from 'util'

const resolveSrvAsync = promisify(dns.resolveSrv)
const resolveTxtAsync = promisify(dns.resolveTxt)

try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch {
  // Ignore
}

const dbName = process.env.MONGODB_DB || 'doubletap'

const DEFAULT_ATLAS_URI =
  'mongodb://mfavax_db_user:BV2LeiA5YTPn85QG@ac-r4uff4o-shard-00-00.2apd5qu.mongodb.net:27017,ac-r4uff4o-shard-00-01.2apd5qu.mongodb.net:27017,ac-r4uff4o-shard-00-02.2apd5qu.mongodb.net:27017/doubletap?ssl=true&replicaSet=atlas-zm4nze-shard-0&authSource=admin&retryWrites=true&w=majority'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export function isMongoConfigured(): boolean {
  const currentUri = process.env.MONGODB_URI || DEFAULT_ATLAS_URI
  return currentUri.trim().length > 0 && !currentUri.includes('YOUR_MONGODB_URI_HERE')
}

async function getEffectiveUri(rawUri: string): Promise<string> {
  if (!rawUri.startsWith('mongodb+srv://')) {
    return rawUri
  }

  try {
    dns.setServers(['8.8.8.8', '1.1.1.1'])
    const withoutPrefix = rawUri.replace('mongodb+srv://', '')
    const [authAndHost, ...restQuery] = withoutPrefix.split('?')
    const atIdx = authAndHost.lastIndexOf('@')
    const auth = atIdx !== -1 ? authAndHost.slice(0, atIdx + 1) : ''
    const hostAndPath = atIdx !== -1 ? authAndHost.slice(atIdx + 1) : authAndHost
    const slashIdx = hostAndPath.indexOf('/')
    const hostname = slashIdx !== -1 ? hostAndPath.slice(0, slashIdx) : hostAndPath
    const pathPart = slashIdx !== -1 ? hostAndPath.slice(slashIdx) : '/doubletap'

    const addresses = await resolveSrvAsync(`_mongodb._tcp.${hostname}`)
    const hosts = addresses.map((a) => `${a.name}:${a.port}`).join(',')

    let options = 'ssl=true&authSource=admin&retryWrites=true&w=majority'
    try {
      const txt = await resolveTxtAsync(hostname)
      if (txt?.[0]?.[0]) {
        options = `${txt[0][0]}&ssl=true&retryWrites=true&w=majority`
      }
    } catch {
      // Ignore
    }

    const query = restQuery.length > 0 ? `?${restQuery.join('?')}&${options}` : `?${options}`
    return `mongodb://${auth}${hosts}${pathPart}${query}`
  } catch (err) {
    console.warn('[MongoDB] Direct SRV resolution fallback error, using raw URI:', err)
    return rawUri
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  const currentUri = process.env.MONGODB_URI || DEFAULT_ATLAS_URI

  if (!isMongoConfigured()) {
    console.warn('[MongoDB] isMongoConfigured returned false!')
    return null
  }

  // If already connected and ping succeeds, return cached connection
  if (cachedClient && cachedDb) {
    try {
      await cachedDb.command({ ping: 1 })
      return { client: cachedClient, db: cachedDb }
    } catch {
      cachedClient = null
      cachedDb = null
    }
  }

  try {
    const effectiveUri = await getEffectiveUri(currentUri)
    console.log('[MongoDB] Connecting to MongoDB with URI:', effectiveUri.replace(/:([^@]+)@/, ':****@'))

    const client = new MongoClient(effectiveUri, {
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      serverSelectionTimeoutMS: 10000,
    })

    await client.connect()
    const db = client.db(dbName)
    console.log('✅ [MongoDB] Successfully connected to database:', dbName)

    cachedClient = client
    cachedDb = db

    return { client, db }
  } catch (error) {
    cachedClient = null
    cachedDb = null
    console.error('❌ Failed to connect to MongoDB in Next.js:', error)
    return null
  }
}
