import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? 'file:dev.db'
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (authToken || url.startsWith('libsql:') || url.startsWith('https:')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } = require('@prisma/adapter-libsql')
    const adapter = new PrismaLibSql({ url, authToken })
    return new PrismaClient({ adapter } as never)
  }

  return new PrismaClient()
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
