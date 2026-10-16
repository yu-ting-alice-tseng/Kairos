/** Shared by the browser and the server: the timezone list and the pure date maths. */

export const TZ_COOKIE = 'kairos-tz'

export const COMMON_TIMEZONES = [
  'Africa/Abidjan', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/Anchorage', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Mexico_City', 'America/New_York', 'America/Sao_Paulo', 'America/Toronto',
  'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong', 'Asia/Jakarta', 'Asia/Karachi',
  'Asia/Kolkata', 'Asia/Seoul', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Taipei',
  'Asia/Tehran', 'Asia/Tokyo', 'Australia/Melbourne', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Dublin',
  'Europe/Istanbul', 'Europe/Lisbon', 'Europe/London', 'Europe/Madrid',
  'Europe/Moscow', 'Europe/Paris', 'Europe/Rome', 'Europe/Stockholm', 'Europe/Warsaw',
  'Europe/Zurich', 'Pacific/Auckland', 'Pacific/Honolulu', 'UTC',
]

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Calendar date (year, month 1-12, day) that `instant` falls on in `tz`. */
export function zonedYmd(tz: string, instant: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

/** How far `tz` is ahead of UTC at `instant`, in ms. */
function offsetMs(tz: string, instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/** The instant local midnight starts on year-month-day in `tz` (DST-safe). */
function zonedMidnight(tz: string, year: number, month: number, day: number) {
  const guess = Date.UTC(year, month - 1, day)
  let instant = guess - offsetMs(tz, new Date(guess))
  instant = guess - offsetMs(tz, new Date(instant)) // second pass settles DST edges
  return new Date(instant)
}

/**
 * Start and end of the local day in `tz` containing `instant`, shifted by
 * `dayOffset` days (-1 = yesterday). Use for any "today" query on the server,
 * whose own clock runs on UTC.
 */
export function zonedDayRange(tz: string, instant: Date = new Date(), dayOffset = 0) {
  const { year, month, day } = zonedYmd(tz, instant)
  const start = zonedMidnight(tz, year, month, day + dayOffset)
  const next = zonedMidnight(tz, year, month, day + dayOffset + 1)
  return { start, end: new Date(next.getTime() - 1) }
}
