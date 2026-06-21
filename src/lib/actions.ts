'use server'

import { auth, signOut } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function signOutAction() {
  await signOut({ redirectTo: '/auth/signin' })
}

/**
 * Stores the current session token in a short-lived cookie so the
 * finalize-connect route can restore the original session after the user
 * goes through a second OAuth flow for an additional calendar account.
 */
export async function prepareCalendarConnect() {
  const cookieStore = await cookies()
  const session = await auth()
  if (!session?.user?.id) return null

  const isSecure = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '').startsWith('https://')
  const opts = { httpOnly: true, sameSite: 'lax' as const, maxAge: 300, path: '/', secure: isSecure }

  // Store the primary user's ID directly — session.findUnique doesn't work with strategy:'jwt'
  cookieStore.set('_cal_restore_userid', session.user.id, opts)

  // Also preserve the JWT cookie so we can restore the session after OAuth
  const sessionToken =
    cookieStore.get('__Secure-authjs.session-token')?.value ??
    cookieStore.get('authjs.session-token')?.value
  if (sessionToken) cookieStore.set('_cal_restore_session', sessionToken, opts)

  return session.user.id
}
