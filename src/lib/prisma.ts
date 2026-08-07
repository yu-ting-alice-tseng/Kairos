import path from 'path'
import { PrismaClient } from '../generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function resolveLibsqlUrl(raw: string): string {
  // Remote URLs pass through unchanged
  if (!raw.startsWith('file:') || raw.startsWith('file:///')) return raw
  // Resolve relative file: paths to an absolute URI that libsql accepts on Windows
  const filePart = raw.slice('file:'.length).replace(/^\/\//, '')
  const absolute = path.resolve(filePart).replace(/\\/g, '/')
  // Percent-encode spaces (and only spaces — keep the rest as-is for libsql)
  return 'file:///' + absolute.replace(/ /g, '%20')
}

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? 'file:prisma/dev.db'
  const authToken = process.env.TURSO_AUTH_TOKEN
  const url = resolveLibsqlUrl(rawUrl)
  const adapter = new PrismaLibSql({ url, ...(authToken ? { authToken } : {}) })
  return new PrismaClient({ adapter } as never)
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

/**
 * True for a unique-constraint violation (Prisma P2002, or the raw libsql
 * message when the adapter surfaces the driver error). Lets a create that
 * lost a race against a concurrent identical create be treated as a no-op
 * instead of failing the whole sync.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  const code = (err as { code?: string })?.code
  if (code === 'P2002' || code === 'SQLITE_CONSTRAINT_UNIQUE') return true
  const message = (err as { message?: string })?.message ?? ''
  return message.includes('UNIQUE constraint failed')
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
