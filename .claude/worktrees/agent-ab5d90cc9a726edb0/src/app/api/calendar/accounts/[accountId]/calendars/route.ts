import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleCalendars } from '@/lib/calendar/google'
import { listOutlookCalendars } from '@/lib/calendar/outlook'
import { listNotionDatabases } from '@/lib/calendar/notion'

type Params = { params: Promise<{ accountId: string }> }

// GET — list provider sub-calendars + which are active in our DB
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await params
  const account = await prisma.calendarAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
    include: { subCalendars: true },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { accessToken, refreshToken } = account
  if (!accessToken) {
    return NextResponse.json({ error: 'No token stored. Please re-authorize this calendar.', code: 'NO_TOKEN' }, { status: 403 })
  }

  try {
    let providerCalendars: { id: string; name: string; color?: string }[] = []

    if (account.provider === 'GOOGLE') {
      const raw = await listGoogleCalendars(accessToken, refreshToken ?? undefined)
      providerCalendars = raw.map((c) => ({
        id: c.id ?? '',
        name: c.summary ?? c.id ?? '',
        color: c.backgroundColor ?? undefined,
      }))
    } else if (account.provider === 'OUTLOOK') {
      const raw = await listOutlookCalendars(accessToken)
      providerCalendars = raw.map((c: { id: string; name: string; color?: string }) => ({
        id: c.id,
        name: c.name,
        color: undefined,
      }))
    } else if (account.provider === 'NOTION') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = await listNotionDatabases(accessToken) as any[]
      providerCalendars = raw.map((db) => ({
        id: db.id as string,
        name: (db.title?.[0]?.plain_text ?? db.id) as string,
        color: undefined,
      }))
    }

    const activeMap = new Map(account.subCalendars.map((sc) => [sc.externalId, sc]))

    const result = providerCalendars.map((pc) => {
      const saved = activeMap.get(pc.id)
      return {
        externalId: pc.id,
        name: pc.name,
        color: saved?.color ?? pc.color ?? account.color,
        isActive: saved?.isActive ?? false,
        subCalendarId: saved?.id ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Failed to list calendars:', err)
    return NextResponse.json({ error: 'Failed to fetch calendars from provider' }, { status: 500 })
  }
}

// PATCH — set all sub-calendars to the same isActive value (bulk toggle)
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await params
  const account = await prisma.calendarAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
    include: { subCalendars: true },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { isActive, calendars } = await req.json() as { isActive: boolean; calendars: { externalId: string; name: string; color?: string }[] }

  await Promise.all(
    calendars.map((cal) =>
      prisma.subCalendar.upsert({
        where: { calendarAccountId_externalId: { calendarAccountId: accountId, externalId: cal.externalId } },
        create: { calendarAccountId: accountId, externalId: cal.externalId, name: cal.name, color: cal.color ?? account.color, isActive },
        update: { isActive },
      })
    )
  )

  return NextResponse.json({ ok: true })
}

// PUT — toggle a sub-calendar on/off
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { accountId } = await params
  const account = await prisma.calendarAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  })
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { externalId, name, color, isActive } = await req.json()

  const subCalendar = await prisma.subCalendar.upsert({
    where: { calendarAccountId_externalId: { calendarAccountId: accountId, externalId } },
    create: { calendarAccountId: accountId, externalId, name, color: color ?? account.color, isActive },
    update: { name, color: color ?? account.color, isActive },
  })

  return NextResponse.json(subCalendar)
}
