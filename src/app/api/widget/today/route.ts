import { NextRequest, NextResponse } from 'next/server'
import { verifyWidgetToken, getWidgetData } from '@/lib/widget'

// Read-only endpoint for home-screen / desktop widgets (Scriptable, KWGT, /widget page).
// Auth is a signed token in the query string — no session cookie available in widget runtimes.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = verifyWidgetToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const data = await getWidgetData(userId, searchParams.get('tz') ?? undefined)
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
