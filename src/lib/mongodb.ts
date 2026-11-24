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

// Global caching for Next.js (dev server and serverless function reuse)
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<{ client: MongoClient; db: Db }> | undefined
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined
  // eslint-disable-next-line no-var
  var _mongoDb: Db | undefined
}

export function isMongoConfigured(): boolean {
  const currentUri = process.env.MONGODB_URI || DEFAULT_ATLAS_URI
  return currentUri.trim().length > 0 && !currentUri.includes('YOUR_MONGODB_URI_HERE')
}

async function getEffectiveUri(rawUri: string): Promise<string> {
  // If it's already a direct replica set URI, return directly without DNS SRV lookup
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
    console.warn('[MongoDB] Direct SRV resolution fallback error, using direct Atlas URI:', err)
    return DEFAULT_ATLAS_URI
  }
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db } | null> {
  if (!isMongoConfigured()) {
    return null
  }

  // Fast path: Reuse existing established client and database
  if (globalThis._mongoClient && globalThis._mongoDb) {
    return { client: globalThis._mongoClient, db: globalThis._mongoDb }
  }

  // If a connection attempt is already in flight, reuse the promise so concurrent requests don't duplicate
  if (!globalThis._mongoClientPromise) {
    globalThis._mongoClientPromise = (async () => {
      const currentUri = process.env.MONGODB_URI || DEFAULT_ATLAS_URI
      const effectiveUri = await getEffectiveUri(currentUri)

      const client = new MongoClient(effectiveUri, {
        connectTimeoutMS: 5000,
        socketTimeoutMS: 15000,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 1,
        maxIdleTimeMS: 60000,
      })

      await client.connect()
      const db = client.db(dbName)
      globalThis._mongoClient = client
      globalThis._mongoDb = db
      return { client, db }
    })().catch((err) => {
      globalThis._mongoClientPromise = undefined
      globalThis._mongoClient = undefined
      globalThis._mongoDb = undefined
      console.error('❌ Failed to connect to MongoDB in Next.js:', err)
      throw err
    })
  }

  try {
    return await globalThis._mongoClientPromise
  } catch {
    return null
  }
}
