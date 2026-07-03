import { google } from 'googleapis'
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

  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })
  await flush()

  return (res.data.items ?? []).map((event) => ({
    id: event.id ?? '',
    title: event.summary ?? '',
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date ?? '',
    allDay: !event.start?.dateTime,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    htmlLink: event.htmlLink ?? undefined,
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

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]

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

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10)

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
