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

  // Determine which user to store the calendar for.
  // Strategy:'jwt' stores no DB sessions, so read the primary userId from the cookie
  // set by prepareCalendarConnect() rather than looking it up in prisma.session.
  const restoreUserId = cookieStore.get('_cal_restore_userid')?.value
  cookieStore.delete('_cal_restore_userid')

  let targetUserId = restoreUserId && restoreUserId !== newUserId ? restoreUserId : newUserId

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

  const tokenData = {
    accessToken: oauthAccount.access_token,
    ...(oauthAccount.refresh_token ? { refreshToken: oauthAccount.refresh_token } : {}),
    ...(oauthAccount.expires_at ? { expiresAt: new Date(oauthAccount.expires_at * 1000) } : {}),
  }

  // Look for an existing CalendarAccount for this email under the target (primary) user
  const existingPrimary = await prisma.calendarAccount.findFirst({
    where: { userId: targetUserId, provider: config.provider, name: accountName },
  })

  if (existingPrimary) {
    // Already exists under primary user — just refresh tokens
    await prisma.calendarAccount.update({ where: { id: existingPrimary.id }, data: tokenData })
  } else {
    // The signIn callback may have created a CalendarAccount under newUserId during the OAuth flow.
    // Migrate it to targetUserId (and rename it to the real email) instead of creating a duplicate.
    const fromSignIn = newUserId !== targetUserId
      ? await prisma.calendarAccount.findFirst({
          where: { userId: newUserId, provider: config.provider },
        })
      : null

    if (fromSignIn) {
      await prisma.calendarAccount.update({
        where: { id: fromSignIn.id },
        data: { userId: targetUserId, name: accountName, ...tokenData },
      })
    } else {
      // No existing record anywhere — create fresh under target user
      await prisma.calendarAccount.create({
        data: {
          userId: targetUserId,
          provider: config.provider,
          name: accountName,
          color: config.color,
          ...tokenData,
        },
      })
    }
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
