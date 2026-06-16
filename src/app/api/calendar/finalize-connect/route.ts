import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

const PROVIDER_MAP: Record<string, { provider: string; name: string; color: string }> = {
  'google': { provider: 'GOOGLE', name: 'Google Calendar', color: '#4285F4' },
  'microsoft-entra-id': { provider: 'OUTLOOK', name: 'Outlook Calendar', color: '#0078D4' },
}

// Maps the `provider` query param to the NextAuth provider ID
const OAUTH_KEY: Record<string, string> = {
  'google': 'google',
  'microsoft-entra-id': 'microsoft-entra-id',
}

export async function GET(req: NextRequest) {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const settingsUrl = `${base}/settings`

  const providerParam = req.nextUrl.searchParams.get('provider') ?? 'google'
  const oauthKey = OAUTH_KEY[providerParam] ?? providerParam

  const cookieStore = await cookies()
  const restoreToken = cookieStore.get('_cal_restore_session')?.value

  // Current session — set by NextAuth after the second OAuth flow completed
  const currentSession = await auth()
  if (!currentSession?.user?.id) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=unauthorized`)
  }

  const newUserId = currentSession.user.id

  // Determine which user to store the calendar for
  let targetUserId = newUserId

  if (restoreToken) {
    // A different user was signed in before — resolve them from the stored token
    const originalSession = await prisma.session.findUnique({
      where: { sessionToken: restoreToken },
    })
    if (originalSession?.userId && originalSession.userId !== newUserId) {
      targetUserId = originalSession.userId
    }
  }

  // Fetch the OAuth account record that NextAuth just stored for the signed-in user
  const oauthAccount = await prisma.account.findFirst({
    where: { userId: newUserId, provider: oauthKey },
    orderBy: { id: 'desc' }, // newest first in case there are duplicates
  })

  if (!oauthAccount?.access_token) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=no_token`)
  }

  const config = PROVIDER_MAP[oauthKey]
  if (!config) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=unknown_provider`)
  }

  // Fetch a friendly name from the provider's profile endpoint
  let accountName = config.name
  try {
    if (oauthKey === 'google') {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${oauthAccount.access_token}` },
      })
      if (res.ok) {
        const profile = await res.json()
        accountName = profile.email ?? config.name
      }
    } else if (oauthKey === 'microsoft-entra-id') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${oauthAccount.access_token}` },
      })
      if (res.ok) {
        const profile = await res.json()
        accountName = profile.userPrincipalName ?? profile.displayName ?? config.name
      }
    }
  } catch {
    // Non-fatal — fall back to provider name
  }

  // Upsert the CalendarAccount for the TARGET user (original or same) — keyed by
  // provider + name (the account's email) so multiple accounts of the same
  // provider don't collide and overwrite each other.
  const existing = await prisma.calendarAccount.findFirst({
    where: { userId: targetUserId, provider: config.provider, name: accountName, isActive: true },
  })

  if (!existing) {
    await prisma.calendarAccount.create({
      data: {
        userId: targetUserId,
        provider: config.provider,
        name: accountName,
        color: config.color,
        accessToken: oauthAccount.access_token,
        refreshToken: oauthAccount.refresh_token ?? null,
        expiresAt: oauthAccount.expires_at ? new Date(oauthAccount.expires_at * 1000) : null,
      },
    })
  } else {
    await prisma.calendarAccount.update({
      where: { id: existing.id },
      data: {
        accessToken: oauthAccount.access_token,
        ...(oauthAccount.refresh_token ? { refreshToken: oauthAccount.refresh_token } : {}),
        ...(oauthAccount.expires_at ? { expiresAt: new Date(oauthAccount.expires_at * 1000) } : {}),
      },
    })
  }

  // Build the redirect response
  const response = NextResponse.redirect(`${settingsUrl}?cal_success=connected`)

  // If we stored tokens for a DIFFERENT user, restore the original session
  if (restoreToken && targetUserId !== newUserId) {
    const isSecure = base.startsWith('https://')
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

    response.cookies.set(cookieName, restoreToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days — match NextAuth default
    })
  }

  // Clean up the restore token cookie regardless
  response.cookies.delete('_cal_restore_session')

  return response
}
