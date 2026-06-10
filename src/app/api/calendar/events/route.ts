import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleEvents } from '@/lib/calendar/google'
import { listOutlookEvents } from '@/lib/calendar/outlook'
import { listNotionEvents } from '@/lib/calendar/notion'
import { CalendarEvent } from '@/types'

export async function GET(req: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const startParam = searchParams.get('start')
  const endParam = searchParams.get('end')
  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end query params required' }, { status: 400 })
  }

  const timeMin = new Date(startParam)
  const timeMax = new Date(endParam)

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId, isActive: true },
    include: { subCalendars: { where: { isActive: true } } },
  })

  const allEvents: CalendarEvent[] = []

  await Promise.all(
    accounts.map(async (account) => {
      if (account.provider !== 'GOOGLE' && account.provider !== 'OUTLOOK' && account.provider !== 'NOTION') return

      const accessToken = account.accessToken
      const refreshToken = account.refreshToken
      if (!accessToken) return

      // If user has selected specific sub-calendars/databases, use those; otherwise fall back to primary
      // Notion has no "primary" so it requires at least one database selected
      const calendarIds = account.subCalendars.length > 0
        ? account.subCalendars.map((sc) => ({ id: sc.externalId, color: sc.color }))
        : [{ id: account.provider === 'GOOGLE' ? 'primary' : null, color: account.color }]

      await Promise.all(
        calendarIds
          .filter((c) => c.id !== null)
          .map(async ({ id, color }) => {
            try {
              let events: CalendarEvent[] = []

              if (account.provider === 'GOOGLE') {
                events = await listGoogleEvents(accessToken, id!, timeMin, timeMax, refreshToken ?? undefined)
              } else if (account.provider === 'OUTLOOK') {
                events = await listOutlookEvents(accessToken, id!, timeMin, timeMax)
              } else if (account.provider === 'NOTION') {
                events = await listNotionEvents(accessToken, id!, timeMin, timeMax)
              }

              events.forEach((e) =>
                allEvents.push({
                  ...e,
                  calendarAccountId: account.id,
                  color,
                })
              )
            } catch (err) {
              console.error(`Failed to fetch events for account ${account.id}, calendar ${id}:`, err)
            }
          })
      )
    })
  )

  return NextResponse.json(allEvents)
}
