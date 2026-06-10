'use server'

import { signOut } from '@/lib/auth'
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

  // NextAuth v5 uses different names depending on protocol
  const sessionToken =
    cookieStore.get('__Secure-authjs.session-token')?.value ??
    cookieStore.get('authjs.session-token')?.value

  if (!sessionToken) return null

  const isSecure = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '').startsWith('https://')

  cookieStore.set('_cal_restore_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300, // 5 minutes — enough for the OAuth round-trip
    path: '/',
    secure: isSecure,
  })

  return sessionToken
}
