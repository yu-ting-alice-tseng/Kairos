import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Temporary diagnostic endpoint — remove after debugging
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const userId = session.user.id

  const [oauthAccounts, calendarAccounts] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      select: { provider: true, providerAccountId: true, access_token: true, refresh_token: true, expires_at: true },
    }),
    prisma.calendarAccount.findMany({
      where: { userId },
      select: { id: true, provider: true, name: true, isActive: true, accessToken: true },
    }),
  ])

  return NextResponse.json({
    userId,
    oauthAccounts: oauthAccounts.map(a => ({
      provider: a.provider,
      providerAccountId: a.providerAccountId,
      hasAccessToken: !!a.access_token,
      hasRefreshToken: !!a.refresh_token,
      expiresAt: a.expires_at,
    })),
    calendarAccounts: calendarAccounts.map(a => ({
      id: a.id,
      provider: a.provider,
      name: a.name,
      isActive: a.isActive,
      hasToken: !!a.accessToken,
    })),
  })
}
