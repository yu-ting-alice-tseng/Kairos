import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  const provider = req.nextUrl.searchParams.get('provider') ?? 'google'
  const accountId = req.nextUrl.searchParams.get('accountId') ?? null // pass when re-authorizing

  const nonce = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('cal_oauth_state', JSON.stringify({ nonce, accountId }), {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: `${base}/api/calendar/callback/google`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar email profile',
      access_type: 'offline',
      prompt: 'consent',
      state: nonce,
    })
    return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  if (provider === 'notion') {
    const params = new URLSearchParams({
      client_id: process.env.NOTION_CLIENT_ID ?? '',
      redirect_uri: `${base}/api/calendar/callback/notion`,
      response_type: 'code',
      owner: 'user',
      state: nonce,
    })
    return NextResponse.redirect(`https://api.notion.com/v1/oauth/authorize?${params}`)
  }

  return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
}
