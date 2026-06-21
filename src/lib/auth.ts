import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import NotionProvider from 'next-auth/providers/notion'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const DEMO_USER_ID = 'demo-user-flowplan'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma) as never,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: {
            params: {
              scope: 'openid email profile https://www.googleapis.com/auth/calendar',
              access_type: 'offline',
              prompt: 'select_account',
            },
          },
          checks: [],
        })]
      : []),
    ...(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET
      ? [NotionProvider({
          clientId: process.env.NOTION_CLIENT_ID,
          clientSecret: process.env.NOTION_CLIENT_SECRET,
          redirectUri: `${process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/api/auth/callback/notion`,
        })]
      : []),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 365 * 24 * 60 * 60,    // 1 year — stay logged in
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // On Google sign-in, upsert the CalendarAccount tokens.
      // Search by email globally (no userId filter) because B/C/D accounts
      // are sub-calendars stored under User A's userId, not their own userId.
      if (!user?.id || !account?.access_token) return true
      if (account.provider !== 'google') return true
      const email = (profile as { email?: string } | undefined)?.email ?? (user as { email?: string }).email
      if (!email) return true
      try {
        const tokenData = {
          accessToken: account.access_token,
          ...(account.refresh_token ? { refreshToken: account.refresh_token } : {}),
          ...(account.expires_at ? { expiresAt: new Date(account.expires_at * 1000) } : {}),
        }
        // Search globally by email — sub-calendar accounts live under the primary user's userId
        const exactMatch = await prisma.calendarAccount.findFirst({
          where: { provider: 'GOOGLE', name: email },
        })
        if (exactMatch) {
          await prisma.calendarAccount.update({ where: { id: exactMatch.id }, data: tokenData })
        } else {
          // No CalendarAccount for this email yet — create one under the current sign-in user
          await prisma.calendarAccount.create({
            data: { userId: user.id, provider: 'GOOGLE', name: email, color: '#4285F4', ...tokenData },
          })
        }
      } catch (err) {
        console.error('[auth] CalendarAccount sync failed:', err)
      }
      return true
    },
    async jwt({ token, user, account, profile }) {
      if (user?.id) token.sub = user.id
      // On Google sign-in: if this email is a sub-calendar of a different primary user,
      // redirect the session to that primary user so all data loads correctly.
      if (account?.provider === 'google') {
        const email = (profile as { email?: string } | undefined)?.email
        if (email) {
          try {
            const calAccount = await prisma.calendarAccount.findFirst({
              where: { provider: 'GOOGLE', name: email },
              select: { userId: true },
            })
            if (calAccount && calAccount.userId !== token.sub) {
              token.sub = calAccount.userId
            }
          } catch { /* non-fatal — keep the default sub */ }
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
