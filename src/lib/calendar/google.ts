import { google, calendar_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'
import { CalendarEvent } from '@/types'

/**
 * Builds an OAuth2 client and wires it to persist any refreshed access token
 * back to the CalendarAccount row. Without this, google-auth-library still
 * auto-refreshes expired tokens in-memory for the current request, but the
 * new token is discarded afterwards — so the DB keeps the stale token and
 * every subsequent request has to expire-and-refresh again, which is why
 * accounts kept showing "token expired" even right after re-authorizing.
 */
/**
 * Returns { client, flush }.
 * Call `await flush()` after every API call so the token DB update is awaited
 * before the serverless function returns — fire-and-forget is silently dropped
 * by Vercel before the promise resolves.
 */
function getOAuth2Client(
  accountId: string,
  accessToken: string,
  refreshToken?: string | null,
  expiresAt?: Date | null
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    expiry_date: expiresAt ? expiresAt.getTime() : undefined,
  })

  let pendingFlush: Promise<unknown> = Promise.resolve()

  oauth2Client.on('tokens', (tokens) => {
    if (!tokens.access_token) return
    pendingFlush = prisma.calendarAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        ...(tokens.expiry_date ? { expiresAt: new Date(tokens.expiry_date) } : {}),
      },
    }).catch((err) => console.error(`Failed to persist refreshed Google token for account ${accountId}:`, err))
  })

  return { client: oauth2Client, flush: () => pendingFlush }
}

export async function listGoogleCalendars(
  accountId: string,
  accessToken: string,
  refreshToken?: string | null,
  expiresAt?: Date | null
) {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })
  const res = await calendar.calendarList.list()
  await flush()
  return res.data.items ?? []
}

export async function listGoogleEvents(
  accountId: string,
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  refreshToken?: string | null,
  expiresAt?: Date | null
): Promise<CalendarEvent[]> {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })

  const allItems: calendar_v3.Schema$Event[] = []
  let pageToken: string | undefined

  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
      // Only ask for the fields we actually map below. A default events.list row
      // carries attendees, reminders, conferenceData, creator/organizer etc. —
      // dropping them cuts the response by roughly an order of magnitude, which
      // is the bulk of the wait on calendars with many events.
      // recurringEventId marks an instance of a repeating event and points at
      // the series it belongs to — the edit dialog needs it to offer "this and
      // following" / "all events".
      fields: 'nextPageToken,items(id,summary,start,end,description,location,htmlLink,recurringEventId)',
    })
    allItems.push(...(res.data.items ?? []))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  await flush()

  return allItems.map((event) => ({
    id: event.id ?? '',
    title: event.summary ?? '',
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date ?? '',
    allDay: !event.start?.dateTime,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    htmlLink: event.htmlLink ?? undefined,
    recurringEventId: event.recurringEventId ?? undefined,
  }))
}

export async function createGoogleEvent(
  accountId: string,
  accessToken: string,
  calendarId: string,
  event: {
    title: string
    description?: string
    start: Date
    end: Date
    colorId?: string
    allDay?: boolean
    recurrence?: string[]
  },
  refreshToken?: string | null,
  expiresAt?: Date | null
): Promise<string> {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })

  // Use local date components to avoid UTC-offset shifting the date by one day
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.title,
      description: event.description,
      start: event.allDay ? { date: toDateStr(event.start) } : { dateTime: event.start.toISOString() },
      end: event.allDay ? { date: toDateStr(event.end) } : { dateTime: event.end.toISOString() },
      colorId: event.colorId,
      recurrence: event.recurrence,
    },
  })
  await flush()

  return res.data.id ?? ''
}

export async function updateGoogleEvent(
  accountId: string,
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    title?: string
    description?: string
    start?: Date
    end?: Date
    allDay?: boolean
  },
  refreshToken?: string | null,
  expiresAt?: Date | null
): Promise<void> {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })

  // Use local date components to avoid UTC-offset shifting the date by one day
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      summary: event.title,
      description: event.description,
      start: event.start
        ? event.allDay
          ? { date: toDateStr(event.start) }
          : { dateTime: event.start.toISOString() }
        : undefined,
      end: event.end
        ? event.allDay
          ? { date: toDateStr(event.end) }
          : { dateTime: event.end.toISOString() }
        : undefined,
    },
  })
  await flush()
}

// ─── Repeating events ─────────────────────────────────────────────────────────
// Google has no "edit this and following" call — its own UI splits the series,
// and so do we: the old series is cut short just before the instance the user
// edited, and a new one starts there carrying the edit. "All events" is a patch
// of the series master, which is a single call.

/** UTC basic format Google wants inside an RRULE UNTIL. */
function toRRuleUntil(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Replaces whatever end condition a rule has with `UNTIL`. A COUNT-based rule
 * cannot keep its count once it is cut short — the remaining occurrences move
 * to the new series — so COUNT is dropped rather than left to over-run.
 */
function ruleEndingAt(rrule: string, until: Date): string {
  const body = rrule.replace(/^RRULE:/, '')
  const parts = body.split(';').filter((p) => p && !/^(UNTIL|COUNT)=/i.test(p))
  parts.push(`UNTIL=${toRRuleUntil(until)}`)
  return `RRULE:${parts.join(';')}`
}

/** Same rule with any explicit end condition removed, for the new series. */
function ruleWithoutEnd(rrule: string, remainingCount: number | null): string {
  const body = rrule.replace(/^RRULE:/, '')
  const parts = body.split(';').filter((p) => p && !/^(UNTIL|COUNT)=/i.test(p))
  if (remainingCount !== null && remainingCount > 0) parts.push(`COUNT=${remainingCount}`)
  return `RRULE:${parts.join(';')}`
}

/**
 * Applies an edit to a whole repeating series, or to one instance onwards.
 *
 * `scope: 'all'` keeps each occurrence on its own date and moves only the time
 * of day — the same thing Google Calendar does — because rewriting the master's
 * date would drag the entire series to the edited instance's day.
 */
export async function updateGoogleSeries(
  accountId: string,
  accessToken: string,
  calendarId: string,
  masterId: string,
  instanceStart: Date,
  scope: 'following' | 'all',
  event: { title?: string; description?: string; start?: Date; end?: Date; allDay?: boolean },
  refreshToken?: string | null,
  expiresAt?: Date | null
): Promise<void> {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const master = (await calendar.events.get({ calendarId, eventId: masterId })).data
  const recurrence = master.recurrence ?? []
  const rruleIndex = recurrence.findIndex((r) => r.startsWith('RRULE:'))
  const rrule = rruleIndex >= 0 ? recurrence[rruleIndex] : null

  if (scope === 'all') {
    const body: calendar_v3.Schema$Event = {}
    if (event.title !== undefined) body.summary = event.title
    if (event.description !== undefined) body.description = event.description

    // Carry the new time of day onto the master's own date; every later
    // occurrence follows from the rule.
    if (event.start || event.end) {
      const masterStart = master.start?.dateTime ?? master.start?.date
      if (masterStart) {
        const base = new Date(masterStart)
        const applyTime = (from: Date) => {
          const d = new Date(base)
          d.setHours(from.getHours(), from.getMinutes(), 0, 0)
          return d
        }
        if (event.allDay) {
          if (event.start) body.start = { date: toDateStr(base) }
          if (event.end && event.start) {
            const days = Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 86400000))
            const endDate = new Date(base); endDate.setDate(endDate.getDate() + days)
            body.end = { date: toDateStr(endDate) }
          }
        } else {
          if (event.start) body.start = { dateTime: applyTime(event.start).toISOString() }
          if (event.end && event.start) {
            const durationMs = event.end.getTime() - event.start.getTime()
            body.end = { dateTime: new Date(applyTime(event.start).getTime() + durationMs).toISOString() }
          }
        }
      }
    }

    await calendar.events.patch({ calendarId, eventId: masterId, requestBody: body })
    await flush()
    return
  }

  // scope === 'following' — cut the old series short, start a new one here.
  let remainingCount: number | null = null
  if (rrule && /(^|;)COUNT=/i.test(rrule)) {
    const total = Number(/(?:^|;)COUNT=(\d+)/i.exec(rrule)?.[1] ?? 0)
    const before = await calendar.events.instances({
      calendarId, eventId: masterId, timeMax: instanceStart.toISOString(), maxResults: 2500,
      fields: 'items(id)',
    })
    remainingCount = Math.max(1, total - (before.data.items?.length ?? 0))
  }

  if (rrule) {
    const truncated = [...recurrence]
    truncated[rruleIndex] = ruleEndingAt(rrule, new Date(instanceStart.getTime() - 1000))
    await calendar.events.patch({ calendarId, eventId: masterId, requestBody: { recurrence: truncated } })
  }

  const newStart = event.start ?? instanceStart
  const masterStartRaw = master.start?.dateTime ?? master.start?.date
  const masterEndRaw = master.end?.dateTime ?? master.end?.date
  const defaultDuration = masterStartRaw && masterEndRaw
    ? new Date(masterEndRaw).getTime() - new Date(masterStartRaw).getTime()
    : 60 * 60 * 1000
  const newEnd = event.end ?? new Date(newStart.getTime() + defaultDuration)
  const allDay = event.allDay ?? !master.start?.dateTime

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.title ?? master.summary ?? undefined,
      description: event.description ?? master.description ?? undefined,
      location: master.location ?? undefined,
      start: allDay ? { date: toDateStr(newStart) } : { dateTime: newStart.toISOString() },
      end: allDay ? { date: toDateStr(newEnd) } : { dateTime: newEnd.toISOString() },
      recurrence: rrule
        ? [...recurrence.slice(0, rruleIndex), ruleWithoutEnd(rrule, remainingCount), ...recurrence.slice(rruleIndex + 1)]
        : recurrence,
    },
  })
  await flush()
}

export async function moveGoogleEvent(
  accountId: string,
  accessToken: string,
  sourceCalendarId: string,
  eventId: string,
  destinationCalendarId: string,
  refreshToken?: string | null,
  expiresAt?: Date | null
): Promise<void> {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })
  await calendar.events.move({ calendarId: sourceCalendarId, eventId, destination: destinationCalendarId })
  await flush()
}

export async function deleteGoogleEvent(
  accountId: string,
  accessToken: string,
  calendarId: string,
  eventId: string,
  refreshToken?: string | null,
  expiresAt?: Date | null
): Promise<void> {
  const { client, flush } = getOAuth2Client(accountId, accessToken, refreshToken, expiresAt)
  const calendar = google.calendar({ version: 'v3', auth: client })
  await calendar.events.delete({ calendarId, eventId })
  await flush()
}
