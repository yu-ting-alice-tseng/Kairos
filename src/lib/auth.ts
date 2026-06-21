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
      // On Google sign-in, upsert a CalendarAccount using the OAuth profile email as unique key.
      // Must use profile.email (the actual Google account email), NOT user.email
      // (which is the DB User's email and may belong to a different linked account).
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
        // Find by the specific email so different Google accounts never overwrite each other
        const exactMatch = await prisma.calendarAccount.findFirst({
          where: { userId: user.id, provider: 'GOOGLE', name: email },
        })
        if (exactMatch) {
          // Refresh tokens for this specific account
          await prisma.calendarAccount.update({ where: { id: exactMatch.id }, data: tokenData })
        } else {
          // Check if there is a legacy placeholder record ("Google Calendar") with no real email yet
          const placeholder = await prisma.calendarAccount.findFirst({
            where: { userId: user.id, provider: 'GOOGLE', name: 'Google Calendar' },
          })
          if (placeholder) {
            // Claim the placeholder for this email
            await prisma.calendarAccount.update({ where: { id: placeholder.id }, data: { name: email, ...tokenData } })
          } else {
            // Create a fresh CalendarAccount for this Google account
            await prisma.calendarAccount.create({
              data: {
                userId: user.id,
                provider: 'GOOGLE',
                name: email,
                color: '#4285F4',
                ...tokenData,
              },
            })
          }
        }
      } catch (err) {
        console.error('[auth] CalendarAccount sync failed:', err)
      }
      return true
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
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
