import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import NotionProvider from 'next-auth/providers/notion'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const DEMO_USER_ID = 'demo-user-flowplan'

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'flowplan-demo-secret-replace-in-prod',
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
