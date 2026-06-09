import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('authjs.session-token')?.value
    ?? cookieStore.get('__Secure-authjs.session-token')?.value

  if (!token) {
    return NextResponse.json({ error: 'No session cookie found', allCookies: cookieStore.getAll().map(c => c.name) })
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  }).catch((e: Error) => ({ error: e.message }))

  return NextResponse.json({ token: token.slice(0, 20) + '...', session })
}
