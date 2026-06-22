import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const [user, oauthAccounts, calendarAccounts] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
    prisma.account.findMany({ where: { userId }, select: { provider: true, providerAccountId: true, access_token: true } }).catch(() => 'error'),
    prisma.calendarAccount.findMany({ where: { userId }, select: { id: true, name: true, provider: true, isActive: true } }),
  ])

  return NextResponse.json({ userId, user, oauthAccounts, calendarAccounts })
}
