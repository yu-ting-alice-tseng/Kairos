import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import NotionProvider from 'next-auth/providers/notion'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const DEMO_USER_ID = 'demo-user-flowplan'

const adapter = PrismaAdapter(prisma)

const PROVIDER_MAP: Record<string, { provider: string; name: string; color: string }> = {
  'google': { provider: 'GOOGLE', name: 'Google Calendar', color: '#4285F4' },
  'notion': { provider: 'NOTION', name: 'Notion', color: '#000000' },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  // Fallback secret so the app works on Vercel even if AUTH_SECRET env var isn't set yet
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'flowplan-demo-secret-replace-in-prod',
  adapter: adapter as never,
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
          authorization: {
            params: {
              scope: 'openid email profile https://www.googleapis.com/auth/calendar',
              access_type: 'offline',
              prompt: 'consent',
            },
          },
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
    // Fires on EVERY successful sign-in — ensures tokens are always fresh in CalendarAccount
    async signIn({ user, account }) {
      const userId = (user as { id?: string }).id
      if (!userId || !account) return true

      const config = PROVIDER_MAP[account.provider]
      if (!config) return true

      try {
        const existing = await prisma.calendarAccount.findFirst({
          where: { userId, provider: config.provider, isActive: true },
        })
        if (!existing) {
          await prisma.calendarAccount.create({
            data: {
              userId,
              provider: config.provider,
              name: config.name,
              color: config.color,
              accessToken: account.access_token ?? null,
              refreshToken: account.refresh_token ?? null,
              expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            },
          })
        } else {
          // Always refresh access token; preserve existing refresh token if provider didn't return a new one
          await prisma.calendarAccount.update({
            where: { id: existing.id },
            data: {
              accessToken: account.access_token ?? null,
              ...(account.refresh_token ? { refreshToken: account.refresh_token } : {}),
              ...(account.expires_at ? { expiresAt: new Date(account.expires_at * 1000) } : {}),
            },
          })
        }
      } catch (err) {
        console.error('[auth] Failed to store CalendarAccount tokens:', err)
        // Never block sign-in due to CalendarAccount errors
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
