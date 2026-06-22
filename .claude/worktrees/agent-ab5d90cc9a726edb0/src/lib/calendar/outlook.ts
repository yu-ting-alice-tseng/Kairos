import { Client } from '@microsoft/microsoft-graph-client'
import { CalendarEvent } from '@/types'

function getGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  })
}

export async function listOutlookCalendars(accessToken: string) {
  const client = getGraphClient(accessToken)
  const res = await client.api('/me/calendars').get()
  return res.value ?? []
}

export async function listOutlookEvents(
  accessToken: string,
  calendarId: string,
  startDateTime: Date,
  endDateTime: Date
): Promise<CalendarEvent[]> {
  const client = getGraphClient(accessToken)

  const res = await client
    .api(`/me/calendars/${calendarId}/calendarView`)
    .query({
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    })
    .select('id,subject,start,end,isAllDay')
    .get()

  return (res.value ?? []).map((event: { id: string; subject: string; start: { dateTime: string }; end: { dateTime: string }; isAllDay: boolean }) => ({
    id: event.id,
    title: event.subject,
    start: event.start.dateTime,
    end: event.end.dateTime,
    allDay: event.isAllDay,
  }))
}

export async function createOutlookEvent(
  accessToken: string,
  calendarId: string,
  event: {
    title: string
    description?: string
    start: Date
    end: Date
  }
): Promise<string> {
  const client = getGraphClient(accessToken)

  const res = await client.api(`/me/calendars/${calendarId}/events`).post({
    subject: event.title,
    body: { contentType: 'text', content: event.description ?? '' },
    start: { dateTime: event.start.toISOString(), timeZone: 'UTC' },
    end: { dateTime: event.end.toISOString(), timeZone: 'UTC' },
  })

  return res.id
}

export async function updateOutlookEvent(
  accessToken: string,
  eventId: string,
  event: { title?: string; description?: string; start?: Date; end?: Date }
): Promise<void> {
  const client = getGraphClient(accessToken)
  const body: Record<string, unknown> = {}
  if (event.title) body.subject = event.title
  if (event.description) body.body = { contentType: 'text', content: event.description }
  if (event.start) body.start = { dateTime: event.start.toISOString(), timeZone: 'UTC' }
  if (event.end) body.end = { dateTime: event.end.toISOString(), timeZone: 'UTC' }
  await client.api(`/me/events/${eventId}`).patch(body)
}

export async function deleteOutlookEvent(accessToken: string, eventId: string): Promise<void> {
  const client = getGraphClient(accessToken)
  await client.api(`/me/events/${eventId}`).delete()
}
