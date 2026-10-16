'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { TZ_COOKIE, isValidTimeZone } from '@/lib/timezones'

/** The device's timezone, or the one picked in Settings. */
export function useUserTimeZone(): string {
  const primaryTimezone = useAppStore((s) => s.primaryTimezone)
  if (isValidTimeZone(primaryTimezone)) return primaryTimezone
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Tells the server which timezone the person's day runs on, through a cookie
 * every request carries. When it changes (first visit, travel, a new pick in
 * Settings) the habits are re-read so "done today" follows the new day.
 */
export function TimezoneSync() {
  const timeZone = useUserTimeZone()
  const setHabits = useAppStore((s) => s.setHabits)

  useEffect(() => {
    const current = document.cookie.split('; ').find((c) => c.startsWith(`${TZ_COOKIE}=`))?.slice(TZ_COOKIE.length + 1)
    const wanted = encodeURIComponent(timeZone)
    if (current === wanted) return
    document.cookie = `${TZ_COOKIE}=${wanted}; path=/; max-age=31536000; samesite=lax`
    fetch('/api/habits')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (Array.isArray(data)) setHabits(data) })
      .catch(() => {})
  }, [timeZone, setHabits])

  return null
}
