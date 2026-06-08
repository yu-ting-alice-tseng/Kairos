import { Client } from '@notionhq/client'
import { CalendarEvent } from '@/types'

export async function listNotionDatabases(accessToken: string) {
  const notion = new Client({ auth: accessToken })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (notion.search as any)({
    filter: { value: 'database', property: 'object' },
  })
  return res.results ?? []
}

export async function listNotionEvents(
  accessToken: string,
  databaseId: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  const notion = new Client({ auth: accessToken })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (notion as any).databases.query({
    database_id: databaseId,
    filter: {
      and: [
        { property: 'Date', date: { on_or_after: startDate.toISOString() } },
        { property: 'Date', date: { on_or_before: endDate.toISOString() } },
      ],
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (res.results ?? []).map((page: any) => {
    const titleProp = Object.values(page.properties ?? {}).find((v: unknown) => (v as { title?: unknown }).title) as { title?: { plain_text: string }[] } | undefined
    const title = titleProp?.title?.[0]?.plain_text ?? 'Untitled'
    const dateProp = Object.values(page.properties ?? {}).find((v: unknown) => (v as { date?: unknown }).date) as { date?: { start: string; end?: string } } | undefined
    const start = dateProp?.date?.start ?? new Date().toISOString()
    const end = dateProp?.date?.end ?? start
    return { id: page.id, title, start, end } as CalendarEvent
  })
}

export async function createNotionPage(
  accessToken: string,
  databaseId: string,
  event: { title: string; start: Date; end?: Date; description?: string }
): Promise<string> {
  const notion = new Client({ auth: accessToken })

  const res = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: event.title } }] },
      Date: {
        date: {
          start: event.start.toISOString(),
          end: event.end?.toISOString(),
        },
      },
    },
  })

  return res.id
}
