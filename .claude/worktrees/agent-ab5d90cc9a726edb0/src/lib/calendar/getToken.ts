import { prisma } from '@/lib/prisma'

const PROVIDER_MAP: Record<string, string> = {
  GOOGLE: 'google',
  OUTLOOK: 'microsoft-entra-id',
}

export async function getOAuthToken(userId: string, calendarProvider: string) {
  const oauthProvider = PROVIDER_MAP[calendarProvider]
  if (!oauthProvider) return { accessToken: null, refreshToken: null }

  const account = await prisma.account.findFirst({
    where: { userId, provider: oauthProvider },
    orderBy: { expires_at: 'desc' },
  })

  return {
    accessToken: account?.access_token ?? null,
    refreshToken: account?.refresh_token ?? null,
  }
}
