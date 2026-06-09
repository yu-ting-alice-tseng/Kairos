import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

const DEMO_USER_ID = 'demo-user-flowplan'

const officialAdapter = PrismaAdapter(prisma)

// Demo sessions bypass the database so the demo works even without a cloud DB configured
const adapter = {
  ...officialAdapter,
  getSessionAndUser: async (sessionToken: string) => {
    if (sessionToken.startsWith('demo-session-')) {
      return {
        session: {
          id: 'demo',
          sessionToken,
          userId: DEMO_USER_ID,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        user: {
          id: DEMO_USER_ID,
          name: 'Demo User',
          email: 'demo@flowplan.app',
          emailVerified: new Date(),
          image: null as string | null,
        },
      }
    }
    return officialAdapter.getSessionAndUser!(sessionToken)
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  // Fallback secret so the app works on Vercel even if AUTH_SECRET env var isn't set yet
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'flowplan-demo-secret-replace-in-prod',
  adapter: adapter as never,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid email profile offline_access Calendars.ReadWrite',
        },
      },
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id
      }
      return session
    },
  },
})
