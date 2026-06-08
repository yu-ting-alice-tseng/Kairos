import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { prisma } from './prisma'

// Custom adapter for Prisma v7
const prismaAdapter = {
  createUser: (data: Record<string, unknown>) => prisma.user.create({ data: data as never }),
  getUser: (id: string) => prisma.user.findUnique({ where: { id } }),
  getUserByEmail: (email: string) => prisma.user.findUnique({ where: { email } }),
  getUserByAccount: ({ provider, providerAccountId }: { provider: string; providerAccountId: string }) =>
    prisma.account
      .findUnique({ where: { provider_providerAccountId: { provider, providerAccountId } }, include: { user: true } })
      .then((acc) => acc?.user ?? null),
  updateUser: ({ id, ...data }: { id: string } & Record<string, unknown>) => prisma.user.update({ where: { id }, data: data as never }),
  deleteUser: (id: string) => prisma.user.delete({ where: { id } }),
  linkAccount: (data: Record<string, unknown>) => prisma.account.create({ data: data as never }),
  unlinkAccount: ({ provider, providerAccountId }: { provider: string; providerAccountId: string }) =>
    prisma.account.delete({ where: { provider_providerAccountId: { provider, providerAccountId } } }),
  createSession: (data: Record<string, unknown>) => prisma.session.create({ data: data as never }),
  getSessionAndUser: (sessionToken: string) =>
    prisma.session.findUnique({ where: { sessionToken }, include: { user: true } }).then((s) =>
      s ? { session: s, user: s.user } : null
    ),
  updateSession: ({ sessionToken, ...data }: { sessionToken: string } & Record<string, unknown>) =>
    prisma.session.update({ where: { sessionToken }, data: data as never }),
  deleteSession: (sessionToken: string) => prisma.session.delete({ where: { sessionToken } }),
  createVerificationToken: (data: Record<string, unknown>) => prisma.verificationToken.create({ data: data as never }),
  useVerificationToken: ({ identifier, token }: { identifier: string; token: string }) =>
    prisma.verificationToken.delete({ where: { identifier_token: { identifier, token } } }).catch(() => null),
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: prismaAdapter as never,
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
