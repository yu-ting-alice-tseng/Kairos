import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const settingsUrl = `${base}/settings`

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(`${base}/auth/signin`)
  }

  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=access_denied`)
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get('cal_oauth_state')?.value
  cookieStore.delete('cal_oauth_state')

  if (!raw) return NextResponse.redirect(`${settingsUrl}?cal_error=state_missing`)
  const { nonce, accountId } = JSON.parse(raw) as { nonce: string; accountId: string | null }
  if (state !== nonce) return NextResponse.redirect(`${settingsUrl}?cal_error=state_mismatch`)

  // Notion token exchange uses Basic auth (client_id:client_secret in base64)
  const credentials = Buffer.from(
    `${process.env.NOTION_CLIENT_ID ?? ''}:${process.env.NOTION_CLIENT_SECRET ?? ''}`
  ).toString('base64')

  const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${base}/api/calendar/callback/notion`,
    }),
  })

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${settingsUrl}?cal_error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    workspace_name?: string
    workspace_id?: string
  }

  // Notion tokens don't expire — no refresh token needed
  const accessToken = tokens.access_token
  const workspaceName = tokens.workspace_name ?? 'Notion'

  if (accountId) {
    await prisma.calendarAccount.updateMany({
      where: { id: accountId, userId: session.user.id },
      data: { accessToken },
    })
    return NextResponse.redirect(`${settingsUrl}?cal_success=reauthorized`)
  }

  await prisma.calendarAccount.create({
    data: {
      userId: session.user.id,
      provider: 'NOTION',
      name: workspaceName,
      color: '#000000',
      accessToken,
    },
  })

  return NextResponse.redirect(`${settingsUrl}?cal_success=connected`)
}
