import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { loadMonthlyStats } from '@/lib/stats'

/**
 * GET /api/stats/monthly?month=YYYY-MM&months=12&accountId=…&calendarId=…
 *
 * `accountId` takes a CalendarAccount id, `none` (tasks the user typed in, with
 * no calendar behind them), or nothing at all (everything). `calendarId`
 * narrows an account down to one of its sub-calendars.
 */
export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const stats = await loadMonthlyStats(userId, {
    month: searchParams.get('month'),
    months: Number(searchParams.get('months')) || undefined,
    accountId: searchParams.get('accountId'),
    calendarId: searchParams.get('calendarId'),
  })
  return NextResponse.json(stats)
}
