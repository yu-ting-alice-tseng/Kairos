import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleCalendars } from '@/lib/calendar/google'

const OAUTH_PROVIDER_MAP: Record<string, { provider: string; name: string; color: string }> = {
  'google': { provider: 'GOOGLE', name: 'Google Calendar', color: '#4285F4' },
  'microsoft-entra-id': { provider: 'OUTLOOK', name: 'Outlook Calendar', color: '#0078D4' },
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  // Auto-backfill missing access tokens for existing CalendarAccounts from the OAuth Account table.
  // CalendarAccounts are created by the signIn callback (keyed by email). This only backfills tokens
  // if they went missing (e.g. token expired and wasn't refreshed).
  try {
    const oauthAccounts = await prisma.account.findMany({
      where: { userId, provider: { in: ['google', 'microsoft-entra-id'] } },
    })
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    for (const oauth of oauthAccounts) {
      const config = OAUTH_PROVIDER_MAP[oauth.provider]
      if (!config || !oauth.access_token) continue
      // Use the primary user email as fallback — but this only works for the sign-in account.
      // Additional Google accounts connected via calendar-connect already have their own CalendarAccount.
      const email = dbUser?.email
      if (!email) continue
      const existing = await prisma.calendarAccount.findFirst({
        where: { userId, provider: config.provider, name: email },
      })
      if (!existing) {
        // CalendarAccount missing — create it (fallback if signIn callback didn't run)
        await prisma.calendarAccount.create({
          data: {
            userId,
            provider: config.provider,
            name: email,
            color: config.color,
            accessToken: oauth.access_token,
            refreshToken: oauth.refresh_token ?? null,
            expiresAt: oauth.expires_at ? new Date(oauth.expires_at * 1000) : null,
          },
        })
      } else if (!existing.accessToken) {
        await prisma.calendarAccount.update({
          where: { id: existing.id },
          data: {
            accessToken: oauth.access_token,
            ...(oauth.refresh_token ? { refreshToken: oauth.refresh_token } : {}),
            ...(oauth.expires_at ? { expiresAt: new Date(oauth.expires_at * 1000) } : {}),
          },
        })
      }
    }
  } catch (err) {
    console.error('[accounts] Auto-populate from OAuth accounts failed:', err)
  }

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    include: { subCalendars: { orderBy: { name: 'asc' } } },
  })

  // Auto-clean stale sub-calendar records (calendars deleted from Google)
  await Promise.all(accounts.map(async (account) => {
    if (account.provider !== 'GOOGLE' || !account.accessToken || account.subCalendars.length === 0) return
    try {
      const providerCals = await listGoogleCalendars(account.id, account.accessToken, account.refreshToken, account.expiresAt)
      const providerIds = new Set(providerCals.map((c) => c.id ?? ''))
      const staleIds = account.subCalendars.filter((sc) => !providerIds.has(sc.externalId)).map((sc) => sc.id)
      if (staleIds.length > 0) {
        await prisma.subCalendar.deleteMany({ where: { id: { in: staleIds } } })
        account.subCalendars = account.subCalendars.filter((sc) => !staleIds.includes(sc.id))
      }
    } catch {
      // Non-fatal: skip cleanup if Google API fails
    }
  }))

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, name, color, accessToken, refreshToken, calendarId } = await req.json()

  const VALID_PROVIDERS = ['GOOGLE', 'OUTLOOK', 'NOTION']
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }
  if (!name || typeof name !== 'string' || name.length > 255) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }
  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json({ error: 'Invalid accessToken' }, { status: 400 })
  }

  const account = await prisma.calendarAccount.upsert({
    where: { userId_provider_name: { userId: session.user.id, provider, name } },
    create: {
      userId: session.user.id,
      provider,
      name,
      color: color ?? '#4F46E5',
      accessToken,
      refreshToken,
      calendarId,
      isActive: true,
    },
    update: {
      color: color ?? '#4F46E5',
      accessToken,
      refreshToken,
      calendarId,
      isActive: true,
    },
  })

  return NextResponse.json(account, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, color } = await req.json()
  const account = await prisma.calendarAccount.update({
    where: { id, userId: session.user.id },
    data: { ...(name ? { name } : {}), ...(color ? { color } : {}) },
  })
  return NextResponse.json(account)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.calendarAccount.update({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
