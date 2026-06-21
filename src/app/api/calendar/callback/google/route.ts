import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const settingsUrl = `${base}/settings`

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(`${base}/auth/signin`)
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=access_denied`)
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get('cal_oauth_state')?.value
  cookieStore.delete('cal_oauth_state')

  if (!raw) return NextResponse.redirect(`${settingsUrl}?cal_error=state_missing`)
  const { nonce, accountId } = JSON.parse(raw) as { nonce: string; accountId: string | null }
  if (state !== nonce) return NextResponse.redirect(`${settingsUrl}?cal_error=state_mismatch`)

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: `${base}/api/calendar/callback/google`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json()
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null

  if (accountId) {
    // Re-authorizing an existing CalendarAccount — just update its tokens
    await prisma.calendarAccount.updateMany({
      where: { id: accountId, userId: session.user.id },
      data: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      },
    })
    return NextResponse.redirect(`${settingsUrl}?cal_success=reauthorized`)
  }

  // Fetch Google profile to use as a friendly account name
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const profile = profileRes.ok ? await profileRes.json() : null
  const accountName = profile?.email ?? 'Google Calendar'

  // Search globally (no userId filter): if C signed in directly before being added via Settings,
  // a CalendarAccount for C's email may already exist under C's own userId.
  // Migrate it to the current primary user (session.user.id) so there is only one record.
  const existing = profile?.email
    ? await prisma.calendarAccount.findFirst({
        where: { provider: 'GOOGLE', name: profile.email },
      })
    : null

  if (existing) {
    await prisma.calendarAccount.update({
      where: { id: existing.id },
      data: {
        userId: session.user.id,   // consolidate to primary user if it was under another userId
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(expiresAt ? { expiresAt } : {}),
      },
    })
    return NextResponse.redirect(`${settingsUrl}?cal_success=reauthorized`)
  }

  await prisma.calendarAccount.create({
    data: {
      userId: session.user.id,
      provider: 'GOOGLE',
      name: accountName,
      color: '#4285F4',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
    },
  })

  return NextResponse.redirect(`${settingsUrl}?cal_success=connected`)
}
