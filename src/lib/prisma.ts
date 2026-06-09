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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
