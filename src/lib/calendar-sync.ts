'use client'

const LAST_SYNC_KEY = 'kairos-last-calendar-sync'
const MIN_INTERVAL_MS = 5 * 60 * 1000

/**
 * Runs /api/tasks/sync-calendar at most once every few minutes across all
 * pages. Today, Matrix and Retroplanning each fired it on mount, so moving
 * between them re-read Google Calendar every time. Resolves to true when the
 * sync changed tasks and the caller should reload its list.
 */
export async function syncCalendarTasks(): Promise<boolean> {
  try {
    const last = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
    if (Date.now() - last < MIN_INTERVAL_MS) return false
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  } catch { /* storage unavailable: just sync */ }
  try {
    const res = await fetch('/api/tasks/sync-calendar', { method: 'POST' })
    if (!res.ok) return false
    const result = await res.json()
    return result?.synced > 0 || result?.dupes > 0
  } catch {
    return false
  }
}
