import { cookies } from 'next/headers'
import { TZ_COOKIE, isValidTimeZone } from '@/lib/timezones'

/**
 * The timezone the person's day runs on: the one they picked, else their
 * device's, as reported by the browser in a cookie. UTC only until the first
 * page has set it.
 */
export async function getRequestTimeZone(): Promise<string> {
  try {
    const value = (await cookies()).get(TZ_COOKIE)?.value
    const tz = value ? decodeURIComponent(value) : null
    return isValidTimeZone(tz) ? tz : 'UTC'
  } catch {
    return 'UTC'
  }
}
