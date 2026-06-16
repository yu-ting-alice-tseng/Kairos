import { google } from 'googleapis'
import { CalendarEvent } from '@/types'

function getOAuth2Client(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  return oauth2Client
}

export async function listGoogleCalendars(accessToken: string, refreshToken?: string) {
  const auth = getOAuth2Client(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  const res = await calendar.calendarList.list()
  return res.data.items ?? []
}

export async function listGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  refreshToken?: string
): Promise<CalendarEvent[]> {
  const auth = getOAuth2Client(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })

  const res = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  })

  return (res.data.items ?? []).map((event) => ({
    id: event.id ?? '',
    title: event.summary ?? '',
    start: event.start?.dateTime ?? event.start?.date ?? '',
    end: event.end?.dateTime ?? event.end?.date ?? '',
    allDay: !event.start?.dateTime,
  }))
}

export async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: {
    title: string
    description?: string
    start: Date
    end: Date
    colorId?: string
    allDay?: boolean
  },
  refreshToken?: string
): Promise<string> {
  const auth = getOAuth2Client(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.title,
      description: event.description,
      start: event.allDay ? { date: toDateStr(event.start) } : { dateTime: event.start.toISOString() },
      end: event.allDay ? { date: toDateStr(event.end) } : { dateTime: event.end.toISOString() },
      colorId: event.colorId,
    },
  })

  return res.data.id ?? ''
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: {
    title?: string
    description?: string
    start?: Date
    end?: Date
  },
  refreshToken?: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: {
      summary: event.title,
      description: event.description,
      start: event.start ? { dateTime: event.start.toISOString() } : undefined,
      end: event.end ? { dateTime: event.end.toISOString() } : undefined,
    },
  })
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  refreshToken?: string
): Promise<void> {
  const auth = getOAuth2Client(accessToken, refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })
  await calendar.events.delete({ calendarId, eventId })
}
