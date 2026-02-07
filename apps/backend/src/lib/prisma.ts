import { PrismaPg } from '@prisma/adapter-pg'
import type { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Create pg Pool for connection pooling
const pool = new pg.Pool({
  connectionString,
  max: 10,
})

// Create Prisma adapter
const adapter = new PrismaPg(pool)

const enableQueryLogging =
  process.env.PRISMA_LOG_QUERIES === 'true' || process.env.NODE_ENV !== 'production'

type PrismaClientWithEvents = PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel>

// Create Prisma client with adapter
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientWithEvents
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel>({
    adapter,
    log: enableQueryLogging
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  })

if (enableQueryLogging) {
  prisma.$on('query', (event) => {
    console.log('[prisma:query]', event.query, event.params)
  })
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
