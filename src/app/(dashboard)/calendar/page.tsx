'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/useAppStore'
import { Task, CalendarEvent, Habit, RetroTemplate, RecurrenceScope } from '@/types'
import { t } from '@/lib/i18n'
import { TaskForm } from '@/components/tasks/TaskForm'
import { InkLoader } from '@/components/ui/InkLoader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, formatTime, getQuadrant, EISENHOWER_QUADRANTS } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, ChevronDown, Calendar, Plus, Clock, Loader2, Pencil, Trash2, X,
  MapPin, ExternalLink, GitBranch, AlignLeft, CheckCircle2, Circle, Check, Sparkles, Undo2, AlertTriangle, RefreshCw,
  Search,
} from 'lucide-react'
import {
  format, addDays, isSameDay, isToday,
} from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

function fmtDate(d: Date, lang: 'fr' | 'en' | 'zh'): string {
  const loc = lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB'
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(loc, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)
const GRID_START_HOUR = HOURS[0]
const GRID_TOTAL_MIN = HOURS.length * 60
const MIN_BLOCK_HEIGHT = 20

// ─── Built-in templates for auto-detection ────────────────────────────────────

const RETRO_BUILTIN = [
  {
    id: '__study',
    keywords: ['exam', 'examen', 'test', 'study', 'étude', 'quiz', '考試', 'final', 'midterm', 'homework', 'devoir', '作業'],
    stages: [
      { name: 'Course review', nameFr: 'Révision du cours', nameZh: '複習課程', daysBeforeDeadline: 7 },
      { name: 'Practice problems', nameFr: 'Exercices pratiques', nameZh: '練習題', daysBeforeDeadline: 3 },
      { name: 'Past papers', nameFr: 'Annales', nameZh: '考古題', daysBeforeDeadline: 1 },
    ],
  },
  {
    id: '__project',
    keywords: ['project', 'projet', 'report', 'rapport', 'essay', 'dissertation', 'presentation', 'présentation'],
    stages: [
      { name: 'Research', nameFr: 'Recherche', nameZh: '資料蒐集', daysBeforeDeadline: 14 },
      { name: 'Outline', nameFr: 'Plan', nameZh: '大綱', daysBeforeDeadline: 10 },
      { name: 'First draft', nameFr: 'Première ébauche', nameZh: '初稿', daysBeforeDeadline: 5 },
      { name: 'Review & polish', nameFr: 'Révision finale', nameZh: '最終審閱', daysBeforeDeadline: 1 },
    ],
  },
] as const

type BuiltinStage = { name: string; nameFr: string; nameZh: string; daysBeforeDeadline: number }

interface RetroSuggestion {
  event: CalendarEvent
  templateId: string
  matchedKeyword: string
  stages: Array<{ name: string; daysBeforeDeadline: number }>
}

// ─── Name inheritance helper ──────────────────────────────────────────────────

function buildStageTitle(parentTitle: string, matchedKeyword: string, stageName: string): string {
  const lower = parentTitle.toLowerCase()
  const kwIdx = lower.indexOf(matchedKeyword.toLowerCase())
  if (kwIdx > 0) {
    const prefix = parentTitle.substring(0, kwIdx).trim().replace(/[|\-:,\s]+$/, '').trim()
    if (prefix) return `${prefix} | ${stageName}`
  }
  return stageName
}

// ─── Column layout ────────────────────────────────────────────────────────────

function assignColumns<T extends { id: string; start: number; end: number }>(
  items: T[]
): Map<string, { col: number; cols: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const result = new Map<string, { col: number; cols: number }>()
  let clusterIds: string[] = []
  let columnEnds: number[] = []
  let clusterEnd = -Infinity

  const flush = () => {
    const cols = columnEnds.length || 1
    for (const id of clusterIds) {
      const existing = result.get(id)
      result.set(id, { col: existing?.col ?? 0, cols })
    }
    clusterIds = []
    columnEnds = []
    clusterEnd = -Infinity
  }

  for (const item of sorted) {
    if (clusterIds.length > 0 && item.start >= clusterEnd) flush()
    let colIdx = columnEnds.findIndex((end) => end <= item.start)
    if (colIdx === -1) { colIdx = columnEnds.length; columnEnds.push(item.end) }
    else columnEnds[colIdx] = item.end
    result.set(item.id, { col: colIdx, cols: 0 })
    clusterIds.push(item.id)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return result
}

type DayBlock =
  | { id: string; kind: 'event'; start: number; end: number; col: number; cols: number; data: CalendarEvent }
  | { id: string; kind: 'task'; start: number; end: number; col: number; cols: number; data: Task }
  | { id: string; kind: 'habit'; start: number; end: number; col: number; cols: number; data: Habit }

const toGridMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes() - GRID_START_HOUR * 60

interface DragState {
  event: CalendarEvent
  startMouseY: number
  startMouseX: number
  eventDurationMs: number
}

interface TaskDragState {
  task: Task
  startMouseY: number
  startMouseX: number
  taskDurationMs: number
}

interface UndoItem {
  event: CalendarEvent
  prevStart: string
  prevEnd: string
  prevAllDay?: boolean
}

// ─── Week event cache ─────────────────────────────────────────────────────────
// Every week change re-hits Google's API (one paged request per sub-calendar),
// so the grid used to sit empty for the whole round trip. We keep the last
// response per week at module level — surviving page re-mounts — and paint it
// immediately while the network fetch runs. The fetch ALWAYS runs, so what ends
// up on screen is never more than one round trip behind Google; the cache only
// removes the blank wait, it never serves as the final answer.

const eventCache = new Map<string, CalendarEvent[]>()
const inFlightEvents = new Map<string, Promise<CalendarEvent[] | null>>()

const weekKey = (start: Date, end: Date) => `${start.toISOString()}|${end.toISOString()}`

/**
 * Fetches a week's events, writing through to the cache. Concurrent callers for
 * the same range share one request (the page mounts and prefetches can overlap).
 * `sync: false` hits the read-only endpoint — used for prefetching weeks the
 * user has not opened, so we never auto-create tasks for a week just because it
 * happened to be adjacent.
 */
async function fetchWeekEvents(start: Date, end: Date, sync: boolean): Promise<CalendarEvent[] | null> {
  const key = weekKey(start, end)
  const dedupeKey = `${key}|${sync}`
  const pending = inFlightEvents.get(dedupeKey)
  if (pending) return pending

  const promise = (async () => {
    const res = await fetch(
      `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}${sync ? '' : '&noSync=true'}`
    )
    if (!res.ok) return null
    const data: CalendarEvent[] = await res.json()
    eventCache.set(key, data)
    return data
  })()

  inFlightEvents.set(dedupeKey, promise)
  promise.catch(() => {}).finally(() => inFlightEvents.delete(dedupeKey))
  return promise
}

/**
 * Drops every cached week after a write. An edit can move an event into another
 * week, so nothing but the whole cache is safe to keep — otherwise navigating
 * back would briefly show the pre-edit snapshot.
 */
const invalidateEventCache = () => {
  eventCache.clear()
  searchIndexCache = null
}

// ─── Search index ─────────────────────────────────────────────────────────────
// Searching only the week on screen would find almost nothing, so the box works
// off one wide read-only pull covering the months around today. Read-only
// matters: this range is far bigger than anything the user opened, and syncing
// it would auto-create a task for every event in it.

const SEARCH_DAYS_BACK = 180
const SEARCH_DAYS_FORWARD = 365
const SEARCH_INDEX_TTL_MS = 5 * 60_000

let searchIndexCache: { events: CalendarEvent[]; fetchedAt: number } | null = null
let searchIndexInFlight: Promise<CalendarEvent[] | null> | null = null

async function fetchSearchIndex(): Promise<CalendarEvent[] | null> {
  if (searchIndexCache && Date.now() - searchIndexCache.fetchedAt < SEARCH_INDEX_TTL_MS) {
    return searchIndexCache.events
  }
  if (searchIndexInFlight) return searchIndexInFlight

  const start = addDays(new Date(), -SEARCH_DAYS_BACK); start.setHours(0, 0, 0, 0)
  const end = addDays(new Date(), SEARCH_DAYS_FORWARD); end.setHours(23, 59, 59, 999)

  const promise = (async () => {
    const res = await fetch(
      `/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}&noSync=true`
    )
    if (!res.ok) return null
    const data: CalendarEvent[] = await res.json()
    searchIndexCache = { events: data, fetchedAt: Date.now() }
    return data
  })()

  searchIndexInFlight = promise
  promise.catch(() => {}).finally(() => { searchIndexInFlight = null })
  return promise
}

/** Accent- and case-insensitive, so "reunion" finds "Réunion". */
const searchNormalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * An all-day event carries a bare "2026-08-06", which `new Date` reads as UTC
 * midnight and can land on the previous day once rendered locally. Parse those
 * as a local date instead; everything else is a real instant.
 */
function eventStartDate(ev: CalendarEvent): Date {
  const raw = String(ev.start)
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  return new Date(raw)
}

/**
 * The task the calendar sync keeps for an event — what "this event is done"
 * is actually recorded on. When a retro chain hangs off the event, the parent
 * is the one that carries its status.
 */
function taskForEvent(tasks: Task[], eventId: string): Task | undefined {
  const linked = tasks.filter((t) => t.calendarEventId === eventId)
  return linked.find((t) => !t.parentTaskId) ?? linked[0]
}

/** Monday of the week containing `d` (Sunday belongs to the week that just ended). */
function mondayOf(d: Date): Date {
  const mon = new Date(d)
  mon.setHours(0, 0, 0, 0)
  const dow = mon.getDay()
  mon.setDate(mon.getDate() + (dow === 0 ? -6 : 1 - dow))
  return mon
}

// ─── Event search ─────────────────────────────────────────────────────────────

function EventSearchBox({ lang, calendarAccounts, onPick }: {
  lang: 'fr' | 'en' | 'zh'
  calendarAccounts: { id: string; color: string; name: string }[]
  onPick: (ev: CalendarEvent) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState<CalendarEvent[] | null>(null)
  const [indexLoading, setIndexLoading] = useState(false)
  const [indexFailed, setIndexFailed] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const locale = lang === 'fr' ? fr : lang === 'zh' ? zhTW : enUS

  // Opening pulls the index. `fetchSearchIndex` serves its cache while it is
  // fresh, so re-opening costs nothing — but an edit in between clears that
  // cache, which is exactly when the results need to be re-read.
  const openBox = useCallback(() => {
    setOpen(true)
    setIndexLoading(true)
    fetchSearchIndex()
      .then((data) => {
        setIndexFailed(!data)
        if (data) setIndex(data)
      })
      .catch(() => setIndexFailed(true))
      .finally(() => setIndexLoading(false))
  }, [])

  // Click outside closes the results, Ctrl/⌘+K focuses the box from anywhere
  // (focusing opens it — see onFocus).
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      // The panel lives in a portal, so it is outside boxRef — closing on
      // mousedown without this check would unmount a result before its click.
      if (boxRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const trimmed = query.trim()
  const results = React.useMemo(() => {
    const q = searchNormalize(trimmed)
    if (q.length < 2 || !index) return []
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const boundary = todayStart.getTime()
    return index
      .filter((ev) => !ev.habitId)
      .filter((ev) => searchNormalize(`${ev.title} ${ev.description ?? ''} ${ev.location ?? ''}`).includes(q))
      .map((ev) => ({ ev, time: eventStartDate(ev).getTime() }))
      // Upcoming first, soonest at the top; past ones after, most recent first.
      .sort((a, b) => {
        const aPast = a.time < boundary
        const bPast = b.time < boundary
        if (aPast !== bPast) return aPast ? 1 : -1
        return aPast ? b.time - a.time : a.time - b.time
      })
      .slice(0, 50)
      .map((r) => r.ev)
  }, [index, trimmed])

  const pick = (ev: CalendarEvent) => {
    onPick(ev)
    setOpen(false)
    inputRef.current?.blur()
  }

  const showPanel = open && (trimmed.length > 0 || indexLoading)

  return (
    <div ref={boxRef} className="relative shrink-0">
      <div className="flex items-center gap-1.5 rounded-xl border border-[#e2d6bc] bg-white/70 px-2 py-1.5 transition-all focus-within:border-[#cba968] focus-within:bg-white">
        <Search className="h-3.5 w-3.5 text-[#a99873] shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); setOpen(true) }}
          onFocus={openBox}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setQuery(''); setOpen(false); inputRef.current?.blur(); return }
            if (results.length === 0) return
            if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % results.length) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + results.length) % results.length) }
            if (e.key === 'Enter') { e.preventDefault(); pick(results[Math.min(activeIdx, results.length - 1)]) }
          }}
          placeholder={lang === 'fr' ? 'Rechercher un événement…' : lang === 'zh' ? '搜尋行程…' : 'Search events…'}
          aria-label={lang === 'fr' ? 'Rechercher un événement' : lang === 'zh' ? '搜尋行程' : 'Search events'}
          className="w-36 focus:w-56 transition-all bg-transparent text-xs text-[#3a3326] placeholder:text-[#c4b48a] focus:outline-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setActiveIdx(0); inputRef.current?.focus() }}
            className="text-[#c4b48a] hover:text-[#ab3326] shrink-0"
            aria-label={lang === 'fr' ? 'Effacer' : lang === 'zh' ? '清除' : 'Clear'}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Portalled to the body: the page header is `sticky z-10`, which makes it a
          stacking context, so a panel rendered inside it can never paint above
          the grid's own sticky day-header row. */}
      {showPanel && createPortal(
        <div className="fixed top-[72px] right-6 z-50 w-[380px] max-h-[60vh] overflow-y-auto rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] shadow-xl shadow-black/10" ref={panelRef}>
          {indexLoading && (
            <p className="flex items-center gap-2 px-4 py-3 text-xs text-[#8a7a5e]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {lang === 'fr' ? 'Chargement des événements…' : lang === 'zh' ? '載入行程中…' : 'Loading events…'}
            </p>
          )}
          {!indexLoading && indexFailed && (
            <p className="px-4 py-3 text-xs text-red-600">
              {lang === 'fr' ? 'Impossible de charger les événements' : lang === 'zh' ? '無法載入行程' : 'Failed to load events'}
            </p>
          )}
          {!indexLoading && !indexFailed && trimmed.length < 2 && (
            <p className="px-4 py-3 text-xs text-[#a99873]">
              {lang === 'fr' ? 'Tapez au moins 2 caractères' : lang === 'zh' ? '請至少輸入 2 個字元' : 'Type at least 2 characters'}
            </p>
          )}
          {!indexLoading && !indexFailed && trimmed.length >= 2 && results.length === 0 && (
            <p className="px-4 py-3 text-xs text-[#a99873]">
              {lang === 'fr' ? 'Aucun événement trouvé' : lang === 'zh' ? '找不到符合的行程' : 'No events found'}
            </p>
          )}
          {results.map((ev, i) => {
            const start = eventStartDate(ev)
            const color = ev.color ?? calendarAccounts.find((a) => a.id === ev.calendarAccountId)?.color ?? '#6366F1'
            const past = start < new Date(new Date().setHours(0, 0, 0, 0))
            return (
              <button
                key={ev.id}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(ev)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left border-b border-[#f0e7d4] last:border-b-0 transition-colors',
                  i === activeIdx ? 'bg-[#f3ecdd]' : 'hover:bg-[#f3ecdd]/60'
                )}
              >
                <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-xs font-medium truncate', past ? 'text-[#8a7a5e]' : 'text-[#2a2420]')}>
                    {ev.title || (lang === 'fr' ? '(sans titre)' : lang === 'zh' ? '(無標題)' : '(untitled)')}
                  </span>
                  <span className="block text-[10px] text-[#a99873]">
                    {format(start, 'EEE d MMM yyyy', { locale })}
                    {' · '}
                    {ev.allDay
                      ? (lang === 'fr' ? 'Journée entière' : lang === 'zh' ? '整天' : 'All day')
                      : formatTime(String(ev.start))}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </span>
                </span>
              </button>
            )
          })}
          {!indexLoading && results.length > 0 && (
            <p className="px-3 py-2 text-[10px] text-[#c4b48a] border-t border-[#f0e7d4]">
              {lang === 'fr'
                ? `${results.length} résultat${results.length > 1 ? 's' : ''} · 6 derniers mois → 12 prochains mois`
                : lang === 'zh'
                  ? `${results.length} 筆結果 · 範圍：過去 6 個月 → 未來 12 個月`
                  : `${results.length} result${results.length > 1 ? 's' : ''} · last 6 months → next 12 months`}
            </p>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { language, tasks, setTasks, updateTask, removeTask, addTask, calendarAccounts, habits, setHabits, hideHabitsViews, toggleHabitsView, primaryTimezone, secondaryTimezone, setPrimaryTimezone, setSecondaryTimezone } = useAppStore()
  const habitsHidden = hideHabitsViews.includes('calendar')
  const { toast } = useGlobalToast()
  // startDate is always Monday of the current week (Sunday → previous Monday)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const dow = d.getDay() // 0=Sun
    const toMon = dow === 0 ? -6 : 1 - dow
    d.setDate(d.getDate() + toMon)
    return d
  })
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [viewingScheduledTask, setViewingScheduledTask] = useState<Task | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventSaving, setEventSaving] = useState(false)
  const [viewingHabit, setViewingHabit] = useState<Habit | null>(null)
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const [userTemplates, setUserTemplates] = useState<RetroTemplate[]>([])
  const [retroSuggestion, setRetroSuggestion] = useState<RetroSuggestion | null>(null)
  const [retroSuggestionSaving, setRetroSuggestionSaving] = useState(false)
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(new Set())
  const [tzDialogOpen, setTzDialogOpen] = useState(false)

  // Effective timezones (null = browser local)
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const primaryTz = primaryTimezone ?? localTz
  const secondaryTz = secondaryTimezone ?? null

  // Format an hour (0-23) in a given IANA timezone, returning "HH:00"
  const hourInTz = (hour: number, tz: string) => {
    const d = new Date(); d.setHours(hour, 0, 0, 0)
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }).format(d)
  }
  // Short display name for a timezone
  const tzLabel = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz

  // Hour column width: 48px per timezone column
  const HOUR_COL_PX = secondaryTz ? 96 : 48
  const hourColClass = secondaryTz ? 'grid-cols-[96px_repeat(7,1fr)]' : 'grid-cols-[48px_repeat(7,1fr)]'
  const [chainPanelOpen, setChainPanelOpen] = useState(true)
  const [expandedChainIds, setExpandedChainIds] = useState<Set<string>>(new Set())
  const toggleChainExpanded = (id: string) =>
    setExpandedChainIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAccount = (id: string) =>
    setHiddenAccountIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Drag state
  const dragRef = useRef<DragState | null>(null)
  const taskDragRef = useRef<TaskDragState | null>(null)
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{ dayIdx: number; hour: number; minute?: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Undo stack for drag moves
  const undoStackRef = useRef<UndoItem[]>([])
  const [undoCount, setUndoCount] = useState(0)

  // Dismissed suggestion IDs — persisted in localStorage so navigation re-mounts don't re-show them
  const dismissedRef = useRef<Set<string>>(new Set<string>())
  if (dismissedRef.current.size === 0) {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('retro_dismissed') : null
      if (raw) JSON.parse(raw).forEach((id: string) => dismissedRef.current.add(id))
    } catch { /* ignore */ }
  }

  // Touch swipe refs
  const touchStartXRef = useRef<number | null>(null)
  const wheelAccRef = useRef(0)

  const weekDaysRef = useRef<Date[]>([])
  const dragPreviewRef = useRef<{ dayIdx: number; hour: number; minute?: number } | null>(null)
  const edgeNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  dragPreviewRef.current = dragPreview

  const locale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS
  const doneToggleLabel = {
    done: language === 'fr' ? 'Marquer comme terminé' : language === 'zh' ? '標為完成' : 'Mark as done',
    undo: language === 'fr' ? 'Marquer comme non terminé' : language === 'zh' ? '標為未完成' : 'Mark as not done',
  }
  const weekStart = startDate
  const weekEnd = addDays(startDate, 6)
  // Fetch range end, not the displayed one: weekEnd is Sunday 00:00 and Google's
  // timeMax is exclusive, so querying up to weekEnd drops everything on Sunday.
  const rangeEnd = addDays(startDate, 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
  weekDaysRef.current = weekDays

  const loadTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    if (res.ok) setTasks(await res.json())
    setLoading(false) // only ever sets to false — initial true cleared after first load
  }, [setTasks])

  // Bumped on every week change so a slow response for a week the user already
  // navigated away from can't overwrite the week now on screen.
  const eventReqSeqRef = useRef(0)

  // The account list arrives from the sidebar a full round trip after the
  // session resolves, and this fetch used to wait for it. It doesn't need to —
  // the server reads the user's accounts itself — so we fire straight away and
  // only redo the request if the connected set actually changes afterwards.
  const accountKey = calendarAccounts.map((a) => a.id).sort().join(',')
  const prevAccountKeyRef = useRef<string | null>(null)

  const loadExternalEvents = useCallback(async () => {
    const seq = ++eventReqSeqRef.current

    // Paint whatever we already know about this week, then revalidate below.
    const cached = eventCache.get(weekKey(weekStart, rangeEnd))
    if (cached) setExternalEvents(cached)

    setEventsLoading(true)
    try {
      const data = await fetchWeekEvents(weekStart, rangeEnd, true)
      if (seq !== eventReqSeqRef.current) return // a newer week is being shown
      if (data) {
        setExternalEvents(data)
        // Server auto-creates/syncs tasks during this fetch — refresh store to pick them up
        loadTasks()
      } else {
        throw new Error('request failed')
      }
    } catch {
      if (seq === eventReqSeqRef.current) {
        toast({ title: language === 'fr' ? 'Impossible de charger les événements' : language === 'zh' ? '無法載入行程，請稍後再試' : 'Failed to load events', variant: 'error' })
      }
    } finally {
      if (seq === eventReqSeqRef.current) setEventsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toISOString(), rangeEnd.toISOString()])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => { loadExternalEvents() }, [loadExternalEvents])

  // Connecting or disconnecting a calendar changes what the server returns, so
  // that has to invalidate and refetch. The initial '' → populated transition is
  // not one of those: the fetch above already asked for every connected account
  // while the list was still in flight, so redoing it would buy nothing.
  useEffect(() => {
    const prev = prevAccountKeyRef.current
    prevAccountKeyRef.current = accountKey
    if (prev === null || prev === '' || prev === accountKey) return
    invalidateEventCache()
    loadExternalEvents()
  }, [accountKey, loadExternalEvents])

  // Warm the neighbouring weeks once the current one has settled, so ← / →
  // paint instantly. Read-only (noSync) — prefetching must not create tasks for
  // a week the user never opens; the real fetch on arrival does the syncing.
  // Skipped entirely for users with no calendar connected — nothing to warm.
  useEffect(() => {
    if (calendarAccounts.length === 0 || eventsLoading) return
    const timer = setTimeout(() => {
      for (const offset of [7, -7]) {
        const start = addDays(weekStart, offset)
        const end = addDays(start, 7)
        if (eventCache.has(weekKey(start, end))) continue
        fetchWeekEvents(start, end, false).catch(() => {})
      }
    }, 500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarAccounts.length, weekStart.toISOString(), eventsLoading])
  useEffect(() => {
    if (habits.length === 0) {
      fetch('/api/habits').then((r) => r.json()).then(setHabits).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load user retro templates for auto-detection
  useEffect(() => {
    fetch('/api/retro-templates')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setUserTemplates(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Ctrl+Z undo handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && undoStackRef.current.length > 0) {
        e.preventDefault()
        const item = undoStackRef.current.pop()!
        setUndoCount(undoStackRef.current.length)
        handleSaveEventRef.current(item.event, item.event.title, item.prevStart, item.prevEnd, item.prevAllDay)
        toast({ title: language === 'fr' ? 'Action annulée' : language === 'zh' ? '已復原' : 'Undone', variant: 'success' })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Auto-detect retroplanning suggestions
  useEffect(() => {
    if (externalEvents.length === 0) return

    const allTemplates = [
      ...RETRO_BUILTIN.map((t) => ({ id: t.id, keywords: t.keywords, stages: t.stages as unknown as BuiltinStage[] })),
      ...userTemplates.map((t) => ({ id: t.id, keywords: t.keywords, stages: t.stages.map((s) => ({ name: s.name, nameFr: s.name, nameZh: s.name, daysBeforeDeadline: s.daysBeforeDeadline })) })),
    ]

    const now = new Date()
    for (const ev of externalEvents) {
      // Skip past events and dismissed titles
      if (ev.start && new Date(ev.start) < now) continue
      const dismissKey = ev.title.toLowerCase().trim()
      if (dismissedRef.current.has(dismissKey)) continue

      // Check if retro tasks already exist for this event (parent task matches event title)
      const parentTask = tasks.find(
        (t) => t.parentTaskId === null && t.title.toLowerCase() === ev.title.toLowerCase()
      )
      if (parentTask && tasks.some((t) => t.parentTaskId === parentTask.id)) continue

      const lower = ev.title.toLowerCase()
      for (const tmpl of allTemplates) {
        const matchedKw = tmpl.keywords.find((kw) => lower.includes(kw.toLowerCase()))
        if (matchedKw) {
          const langKey = language === 'fr' ? 'nameFr' : language === 'zh' ? 'nameZh' : 'name'
          const stages = tmpl.stages.map((s) => ({
            name: buildStageTitle(ev.title, matchedKw, (s as unknown as Record<string, string>)[langKey] ?? s.name),
            daysBeforeDeadline: s.daysBeforeDeadline,
          }))
          setRetroSuggestion({ event: ev, templateId: tmpl.id, matchedKeyword: matchedKw, stages })
          return
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalEvents, userTemplates, tasks, language])

  // ─── Derived data ───────────────────────────────────────────────────────────

  // All task chains for the left sidebar
  const allChains = React.useMemo(() => {
    const parentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!))
    const parents = tasks.filter((t) => parentIds.has(t.id))
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    return parents
      .filter((parent) => {
        if (parent.status === 'COMPLETED') return false
        const deadline = parent.deadline ? new Date(String(parent.deadline)) : null
        if (deadline && deadline < twoWeeksAgo) return false
        return true
      })
      .map((parent) => {
      const children = tasks
        .filter((t) => t.parentTaskId === parent.id)
        .sort((a, b) => (a.deadline ? new Date(String(a.deadline)).getTime() : Infinity) - (b.deadline ? new Date(String(b.deadline)).getTime() : Infinity))
      // The display head = task with the latest deadline in the chain
      const allMembers = [parent, ...children]
      const displayHead = allMembers.reduce((latest, t) => {
        const dl = t.deadline ? new Date(String(t.deadline)).getTime() : 0
        const ldl = latest.deadline ? new Date(String(latest.deadline)).getTime() : 0
        return dl > ldl ? t : latest
      }, parent)
      // Latest deadline of the whole chain (for sorting)
      const latestDeadline = Math.max(...allMembers.map((t) => t.deadline ? new Date(String(t.deadline)).getTime() : 0))
      return { parent, children, displayHead, latestDeadline }
    }).sort((a, b) => {
      const allDoneA = a.parent.status === 'COMPLETED' && a.children.every((c) => c.status === 'COMPLETED')
      const allDoneB = b.parent.status === 'COMPLETED' && b.children.every((c) => c.status === 'COMPLETED')
      if (allDoneA !== allDoneB) return allDoneA ? 1 : -1
      // Sort by latest deadline in chain ascending (earliest-ending chains first)
      if (a.latestDeadline !== b.latestDeadline) return a.latestDeadline - b.latestDeadline
      return a.displayHead.title.localeCompare(b.displayHead.title)
    })
  }, [tasks])

  const scheduledTasks = tasks.filter((task) => task.scheduledStart && task.scheduledEnd)

  const getDeadlineTasksForDay = (day: Date) =>
    tasks.filter((task) => {
      if (!task.deadline) return false
      if (task.scheduledStart) return false // has a specific time slot already
      if (task.calendarEventId) return false // already shown as a Google Calendar event
      if (task.status === 'CANCELLED') return false
      return isSameDay(new Date(String(task.deadline)), day)
    }).sort((a, b) => {
      // completed last
      const aD = a.status === 'COMPLETED' ? 1 : 0
      const bD = b.status === 'COMPLETED' ? 1 : 0
      return aD - bD
    })

  const getAllDayEventsForDay = (day: Date) => {
    const evs = externalEvents.filter((ev) => ev.allDay && ev.start && isSameDay(new Date(ev.start), day) && !hiddenAccountIds.has(ev.calendarAccountId ?? ''))
    // Sort: incomplete first, completed (linked to done tasks) last
    const completedEventIds = new Set(tasks.filter((t) => t.status === 'COMPLETED' && t.calendarEventId).map((t) => t.calendarEventId!))
    return [...evs].sort((a, b) => {
      const aDone = completedEventIds.has(a.id) ? 1 : 0
      const bDone = completedEventIds.has(b.id) ? 1 : 0
      return aDone - bDone
    })
  }

  const isHabitActiveOnDay = (h: { isActive: boolean; frequency: string }, day: Date) => {
    if (!h.isActive) return false
    const dow = day.getDay()
    if (h.frequency === 'DAILY') return true
    if (h.frequency === 'WEEKDAYS') return dow >= 1 && dow <= 5
    if (h.frequency === 'WEEKENDS') return dow === 0 || dow === 6
    return false
  }

  const getHabitsAllDayForDay = (day: Date) =>
    habitsHidden ? [] : habits.filter((h) => !h.scheduledTime && isHabitActiveOnDay(h, day))

  const getDayBlocks = (day: Date): DayBlock[] => {
    type Raw = { id: string; kind: DayBlock['kind']; start: number; end: number; data: CalendarEvent | Task | Habit }
    const raw: Raw[] = []

    externalEvents.forEach((ev) => {
      if (ev.allDay || !ev.start) return
      if (hiddenAccountIds.has(ev.calendarAccountId ?? '')) return
      const s = new Date(ev.start)
      if (!isSameDay(s, day)) return
      const e = ev.end ? new Date(ev.end) : new Date(s.getTime() + 30 * 60000)
      raw.push({ id: `ev-${ev.id}`, kind: 'event', start: toGridMinutes(s), end: toGridMinutes(e), data: ev })
    })

    scheduledTasks.forEach((task) => {
      const s = new Date(task.scheduledStart!)
      if (!isSameDay(s, day)) return
      const e = new Date(task.scheduledEnd!)
      raw.push({ id: `task-${task.id}`, kind: 'task', start: toGridMinutes(s), end: toGridMinutes(e), data: task })
    })

    habits.forEach((h) => {
      if (habitsHidden || !h.scheduledTime || !isHabitActiveOnDay(h, day)) return
      const [hh, mm] = h.scheduledTime.split(':').map(Number)
      const start = hh * 60 + mm - GRID_START_HOUR * 60
      raw.push({ id: `habit-${h.id}`, kind: 'habit', start, end: start + (h.durationMinutes ?? 30), data: h })
    })

    const visible = raw
      .filter((it) => it.start < GRID_TOTAL_MIN)
      .map((it) => ({
        ...it,
        start: Math.max(0, it.start),
        // Events ending past midnight have negative gridMinutes — extend them to grid bottom
        end: it.end < 0 && it.start >= 0 ? GRID_TOTAL_MIN : Math.min(GRID_TOTAL_MIN, Math.max(0, it.end)),
      }))
      .filter((it) => it.end > 0 && it.end > it.start)

    // Deduplicate by id before assigning columns — prevents duplicate-id blocks
    // from getting the same Map entry and both rendering at the same position.
    const seenIds = new Set<string>()
    const deduped = visible.filter((it) => {
      if (seenIds.has(it.id)) return false
      seenIds.add(it.id)
      return true
    })

    const cols = assignColumns(deduped)
    return deduped.map((it) => ({ ...it, ...(cols.get(it.id) ?? { col: 0, cols: 1 }) })) as DayBlock[]
  }

  // ─── Event handlers ─────────────────────────────────────────────────────────

  const handleSaveEvent = useCallback(async (
    ev: CalendarEvent,
    title: string,
    start: string,
    end: string,
    allDay?: boolean,
    scope: RecurrenceScope = 'single',
  ) => {
    setEventSaving(true)
    // Compare dates by local calendar day for all-day events, by ISO string for timed events.
    // Comparing UTC ISO strings directly breaks for all-day events: Google stores "2026-06-22"
    // (date-only) but finalizeDrop produces local-midnight UTC strings like "2026-06-21T22:00:00Z"
    // for UTC+2, making same-day drops appear as changes and wrong-day drops look correct.
    const isAllDay = allDay ?? ev.allDay
    const toLocalDay = (s: string | Date) => {
      const d = new Date(s)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const origStart = isAllDay ? toLocalDay(ev.start) : new Date(ev.start).toISOString()
    const origEnd   = isAllDay ? toLocalDay(ev.end)   : new Date(ev.end).toISOString()
    const newStart  = isAllDay ? toLocalDay(start)     : start
    const newEnd    = isAllDay ? toLocalDay(end)       : end
    const startChanged = newStart !== origStart
    const endChanged   = newEnd   !== origEnd
    const body: Record<string, unknown> = {
      eventId: ev.id,
      calendarAccountId: ev.calendarAccountId,
      calendarId: ev.calendarId,
      title,
      ...(startChanged ? { start } : {}),
      ...(endChanged ? { end } : {}),
      allDay: allDay ?? ev.allDay,
      ...(ev.recurringEventId ? { recurringEventId: ev.recurringEventId, scope, instanceStart: new Date(ev.start).toISOString() } : {}),
    }
    if (allDay !== undefined) body.allDay = allDay

    // Optimistic update — apply immediately so the UI feels instant
    const newEventData = { ...ev, title, start, end, ...(allDay !== undefined ? { allDay } : {}) }
    setExternalEvents((prev) => prev.map((e) => e.id === ev.id ? newEventData : e))

    const res = await fetch('/api/calendar/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      invalidateEventCache()
      // Push old state to undo stack (only for position changes, not title edits)
      if (startChanged || endChanged) {
        undoStackRef.current.push({
          event: ev,
          prevStart: new Date(ev.start).toISOString(),
          prevEnd: new Date(ev.end).toISOString(),
          prevAllDay: ev.allDay,
        })
        setUndoCount(undoStackRef.current.length)
      }
      toast({ title: language === 'fr' ? 'Événement mis à jour' : language === 'zh' ? '活動已更新' : 'Event updated', variant: 'success' })
      // The panel stays open — an edit is not a reason to lose your place. Keep
      // the copy on screen in step with what was just saved.
      setEditingEvent((prev) => prev?.id === ev.id ? newEventData : prev)
      // A series edit rewrites occurrences we are not holding; re-read them.
      if (scope !== 'single') loadExternalEvents()
    } else {
      // Revert optimistic update on failure
      setExternalEvents((prev) => prev.map((e) => e.id === ev.id ? ev : e))
      toast({ title: language === 'fr' ? 'Erreur lors de la mise à jour' : language === 'zh' ? '更新失敗' : 'Failed to update', variant: 'error' })
    }
    setEventSaving(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, loadExternalEvents])

  const handleSaveEventRef = useRef(handleSaveEvent)
  handleSaveEventRef.current = handleSaveEvent

  const setStartDateRef = useRef(setStartDate)
  setStartDateRef.current = setStartDate

  const handleMoveEvent = async (ev: CalendarEvent, newCalendarAccountId: string, newCalendarId: string) => {
    const res = await fetch('/api/calendar/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'move',
        eventId: ev.id,
        calendarAccountId: ev.calendarAccountId,
        calendarId: ev.calendarId,
        destinationCalendarId: newCalendarId,
      }),
    })
    if (res.ok) {
      invalidateEventCache()
      setExternalEvents((prev) => prev.map((e) => e.id === ev.id
        ? { ...e, calendarAccountId: newCalendarAccountId, calendarId: newCalendarId }
        : e
      ))
      setEditingEvent((prev) => prev?.id === ev.id
        ? { ...prev, calendarAccountId: newCalendarAccountId, calendarId: newCalendarId }
        : prev
      )
      toast({ title: language === 'fr' ? 'Calendrier modifié' : language === 'zh' ? '日曆已更新' : 'Calendar updated', variant: 'success' })
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors du déplacement' : language === 'zh' ? '移動失敗' : 'Move failed', variant: 'error' })
    }
  }

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    const res = await fetch('/api/calendar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: ev.id, calendarAccountId: ev.calendarAccountId, calendarId: ev.calendarId }),
    })
    if (res.ok) {
      const { deletedTasks = 0 } = await res.json().catch(() => ({ deletedTasks: 0 }))
      invalidateEventCache()
      setExternalEvents((prev) => prev.filter((e) => e.id !== ev.id))
      // The server took the linked task and its chain with the event; re-read so
      // the chain sidebar and the deadline blocks drop them too.
      if (deletedTasks > 0) await loadTasks()
      toast({
        title: deletedTasks > 1
          ? (language === 'fr' ? `Événement et ${deletedTasks} tâches supprimés` : language === 'zh' ? `已刪除活動與 ${deletedTasks} 項任務` : `Event and ${deletedTasks} tasks deleted`)
          : (language === 'fr' ? 'Événement supprimé' : language === 'zh' ? '活動已刪除' : 'Event deleted'),
        variant: 'success',
      })
      setEditingEvent(null)
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de la suppression' : language === 'zh' ? '刪除失敗' : 'Failed to delete', variant: 'error' })
    }
  }

  const handleCompleteTask = useCallback(async (task: Task) => {
    const isCompleted = task.status === 'COMPLETED'
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    updateTask(task.id, { status: newStatus, completedAt: isCompleted ? null : new Date().toISOString() })
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { const data = await res.json(); updateTask(task.id, data) }
    else updateTask(task.id, task)
  }, [updateTask])

  /**
   * Crossing an event out is really completing the task the calendar sync keeps
   * for it. An event the sync has not reached yet (just created in Google, or
   * on a calendar whose window was never opened) has no task, so make one that
   * points at the event and complete that. POST /api/tasks returns the existing
   * row when the event is already linked, so this cannot fork a second task.
   */
  const toggleEventDone = useCallback(async (ev: CalendarEvent) => {
    const linked = taskForEvent(tasks, ev.id)
    if (linked) { await handleCompleteTask(linked); return }

    const deadline = ev.allDay ? new Date(String(ev.start)) : new Date(String(ev.end ?? ev.start))
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ev.title,
        calendarEventId: ev.id,
        calendarAccountId: ev.calendarAccountId,
        deadline: deadline.toISOString(),
      }),
    })
    if (!res.ok) {
      toast({ title: language === 'fr' ? 'Impossible de marquer comme terminé' : language === 'zh' ? '無法標記為完成' : 'Could not mark as done', variant: 'error' })
      return
    }
    const created: Task = await res.json()
    if (tasks.some((t) => t.id === created.id)) updateTask(created.id, created)
    else addTask(created)
    if (created.status !== 'COMPLETED') await handleCompleteTask(created)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, handleCompleteTask, addTask, updateTask, language])

  const handleCompleteHabit = useCallback(async (habit: Habit) => {
    const alreadyDone = (habit.completions?.length ?? 0) > 0
    if (alreadyDone) {
      // Toggle off — delete the completion
      const res = await fetch('/api/habits/complete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId: habit.id }),
      })
      if (res.ok) {
        setHabits(habits.map((h) => h.id === habit.id
          ? { ...h, completions: [] }
          : h
        ))
      }
      return
    }
    const res = await fetch('/api/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId: habit.id }),
    })
    if (res.ok) {
      const { streak } = await res.json()
      setHabits(habits.map((h) => h.id === habit.id
        ? { ...h, streak, completions: [{ id: 'tmp', habitId: habit.id, completedAt: new Date().toISOString() }] }
        : h
      ))
    }
  }, [habits, setHabits])

  const handleSaveTask = async (data: Partial<Task>) => {
    const payload = {
      ...data,
      scheduledStart: selectedDate ? selectedDate.toISOString() : undefined,
      scheduledEnd: selectedDate && data.estimatedMinutes
        ? new Date(selectedDate.getTime() + data.estimatedMinutes * 60000).toISOString()
        : undefined,
    }
    if (editingTask) {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const updated = await res.json()
        updateTask(editingTask.id, updated)
        toast({ title: language === 'fr' ? 'Tâche modifiée' : language === 'zh' ? '任務已更新' : 'Task updated', variant: 'success' })
      }
    } else {
      // Create Google Calendar event first if a calendar account is selected
      let calendarEventId: string | undefined
      if (payload.calendarAccountId && (payload.scheduledStart || payload.deadline)) {
        try {
          const evStart = payload.scheduledStart
            ? new Date(payload.scheduledStart)
            : new Date(String(payload.deadline))
          const evEnd = payload.scheduledEnd
            ? new Date(payload.scheduledEnd)
            : new Date(evStart.getTime() + 60 * 60 * 1000)
          const evRes = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarAccountId: payload.calendarAccountId,
              calendarId: 'primary',
              title: payload.title,
              start: evStart.toISOString(),
              end: evEnd.toISOString(),
            }),
          })
          if (evRes.ok) {
            const evData = await evRes.json()
            calendarEventId = evData.eventId
            invalidateEventCache()
          }
        } catch { /* best-effort */ }
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, calendarEventId }),
      })
      if (res.ok) {
        const created = await res.json()
        addTask(created)
        toast({ title: language === 'fr' ? 'Tâche créée !' : language === 'zh' ? '任務已建立！' : 'Task created!', variant: 'success' })
      }
    }
    setEditingTask(null)
    setSelectedDate(null)
  }

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    // Re-fetch so children's parentTaskId (cleared by API) reflects in the store
    const fresh = await fetch('/api/tasks')
    if (fresh.ok) setTasks(await fresh.json())
    setEditingTask(null)
  }

  const handleCellClick = (day: Date, hour: number) => {
    const dt = new Date(day)
    dt.setHours(hour, 0, 0, 0)
    setSelectedDate(dt)
    setShowTaskForm(true)
  }

  /**
   * Opens a chain member. A task backed by a calendar event jumps the grid to
   * its week and opens the event panel — fetching that week when it is not the
   * one on screen, which is why clicking a chain used to do nothing at all for
   * anything outside the current week. A stage with no event of its own opens
   * in the task editor instead.
   */
  const openChainTask = async (task: Task) => {
    if (!task.calendarEventId) {
      handleTaskClick(task)
      return
    }
    const loaded = externalEvents.find((e) => e.id === task.calendarEventId)
    if (loaded) {
      setViewingScheduledTask(null)
      setEditingEvent(loaded)
      return
    }
    const when = task.deadline ? new Date(String(task.deadline)) : new Date()
    const weekStart = mondayOf(when)
    setStartDate(weekStart)
    const data = await fetchWeekEvents(weekStart, addDays(weekStart, 7), true).catch(() => null)
    const ev = data?.find((e) => e.id === task.calendarEventId)
    if (ev) {
      setViewingScheduledTask(null)
      setEditingEvent(ev)
    } else {
      // The task still points at an event Google no longer returns.
      toast({
        title: language === 'fr' ? 'Événement introuvable' : language === 'zh' ? '找不到對應的活動' : 'Event not found',
        variant: 'error',
      })
    }
  }

  const handleTaskClick = (task: Task) => {
    if (task.scheduledStart) {
      setEditingEvent(null)
      setViewingHabit(null)
      setViewingScheduledTask(task)
    } else {
      setEditingTask(task)
      setShowTaskForm(true)
    }
  }

  // Retro suggestion actions
  const handleApplyRetroSuggestion = async (suggestion: RetroSuggestion, adjustedStages: Array<{ name: string; daysBeforeDeadline: number }>) => {
    setRetroSuggestionSaving(true)
    try {
      const deadlineDate = new Date(suggestion.event.start)

      // Check if a parent task already exists for this event (by calendarEventId or title match)
      const existingParent = tasks.find(
        (t) => t.parentTaskId === null && (
          t.calendarEventId === suggestion.event.id ||
          t.title.toLowerCase() === suggestion.event.title.toLowerCase()
        )
      )

      let parentTaskId: string
      if (existingParent) {
        // Overwrite: delete existing sub-tasks then reuse parent
        const existingChildren = tasks.filter((t) => t.parentTaskId === existingParent.id)
        await Promise.all(existingChildren.map((t) => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' })))
        parentTaskId = existingParent.id
      } else {
        // Create new parent task
        const parentRes = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: suggestion.event.title,
            calendarAccountId: suggestion.event.calendarAccountId,
            calendarEventId: suggestion.event.id,
            importance: 8,
            urgency: 7,
            deadline: deadlineDate.toISOString(),
          }),
        })
        if (!parentRes.ok) throw new Error('Failed to create parent task')
        parentTaskId = (await parentRes.json()).id
      }

      // Create sub-tasks for each stage
      await Promise.all(
        adjustedStages.filter((s) => s.name.trim()).map((s) => {
          const stageDeadline = new Date(deadlineDate)
          stageDeadline.setDate(stageDeadline.getDate() - s.daysBeforeDeadline)
          return fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: s.name.trim(),
              parentTaskId,
              calendarAccountId: suggestion.event.calendarAccountId,
              importance: 8,
              urgency: 7,
              deadline: stageDeadline.toISOString(),
            }),
          })
        })
      )
      await loadTasks()
      toast({ title: language === 'fr' ? (existingParent ? 'Rétroplanning mis à jour !' : 'Rétroplanning créé !') : language === 'zh' ? (existingParent ? '逆向規劃已更新！' : '逆向規劃已建立！') : (existingParent ? 'Retroplanning updated!' : 'Retroplanning created!'), variant: 'success' })
    } catch {
      toast({ title: language === 'fr' ? 'Erreur' : language === 'zh' ? '建立失敗' : 'Failed to create', variant: 'error' })
    } finally {
      setRetroSuggestionSaving(false)
      persistDismissed(suggestion.event.title.toLowerCase().trim())
      setRetroSuggestion(null)
    }
  }

  const persistDismissed = (key: string) => {
    dismissedRef.current.add(key)
    try {
      localStorage.setItem('retro_dismissed', JSON.stringify([...dismissedRef.current]))
    } catch { /* ignore */ }
  }

  const handleDismissRetroSuggestion = () => {
    if (retroSuggestion) persistDismissed(retroSuggestion.event.title.toLowerCase().trim())
    setRetroSuggestion(null)
  }

  // ─── Drag helpers ────────────────────────────────────────────────────────────

  const finalizeDrop = useCallback((drag: DragState, preview: { dayIdx: number; hour: number; minute?: number } | null) => {
    if (!preview) return
    const targetDay = weekDaysRef.current[preview.dayIdx]
    if (!targetDay) return
    if (preview.hour < 7) {
      const newStart = new Date(targetDay); newStart.setHours(0, 0, 0, 0)
      const newEnd = new Date(newStart); newEnd.setHours(23, 59, 59, 999)
      handleSaveEventRef.current(drag.event, drag.event.title, newStart.toISOString(), newEnd.toISOString(), true)
    } else {
      const newStart = new Date(targetDay); newStart.setHours(preview.hour, preview.minute ?? 0, 0, 0)
      const newEnd = new Date(newStart.getTime() + drag.eventDurationMs)
      handleSaveEventRef.current(drag.event, drag.event.title, newStart.toISOString(), newEnd.toISOString(), false)
    }
  }, [])

  // Shared document-level mousemove tracker — calculates grid cell from raw mouse position
  // Also handles edge-zone auto-navigation: hovering within 40px of left/right edge shifts the week.
  const makeDragMouseMove = useCallback(() => (me: MouseEvent) => {
    if (!gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    const HOUR_COL = HOUR_COL_PX
    const EDGE_ZONE = 40 // px from left/right edge that triggers week navigation
    const NAV_DELAY = 800 // ms between auto-navigations

    const relX = me.clientX - rect.left - HOUR_COL
    const gridWidth = rect.width - HOUR_COL

    // Edge navigation
    const rawX = me.clientX - rect.left
    if (rawX < EDGE_ZONE) {
      if (!edgeNavTimerRef.current) {
        edgeNavTimerRef.current = setTimeout(() => {
          edgeNavTimerRef.current = null
          setStartDateRef.current((d) => addDays(d, -7))
        }, NAV_DELAY)
      }
    } else if (rawX > rect.width - EDGE_ZONE) {
      if (!edgeNavTimerRef.current) {
        edgeNavTimerRef.current = setTimeout(() => {
          edgeNavTimerRef.current = null
          setStartDateRef.current((d) => addDays(d, 7))
        }, NAV_DELAY)
      }
    } else {
      if (edgeNavTimerRef.current) { clearTimeout(edgeNavTimerRef.current); edgeNavTimerRef.current = null }
    }

    const dayColWidth = gridWidth / 7
    const dayIdx = Math.max(0, Math.min(6, Math.floor(relX / dayColWidth)))
    const relY = me.clientY - rect.top
    const rawHour = GRID_START_HOUR + relY / 60
    const snappedHour = Math.round(rawHour * 4) / 4 // snap to 15-min intervals
    const hour = Math.max(GRID_START_HOUR, Math.min(GRID_START_HOUR + HOURS.length - 1, Math.floor(snappedHour)))
    const minute = Math.round((snappedHour - Math.floor(snappedHour)) * 60)
    setDragPreview({ dayIdx, hour, minute })
  }, [])

  const startDrag = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    if (!ev.editable) return
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX; const startY = e.clientY
    const durationMs = ev.start && ev.end
      ? new Date(ev.end as string).getTime() - new Date(ev.start as string).getTime()
      : 60 * 60 * 1000
    dragRef.current = { event: ev, startMouseY: startY, startMouseX: startX, eventDurationMs: durationMs }
    let didMove = false
    const DRAG_THRESHOLD = 5
    const onMouseMove = makeDragMouseMove()
    const wrappedMove = (me: MouseEvent) => {
      if (!didMove && (Math.abs(me.clientX - startX) > DRAG_THRESHOLD || Math.abs(me.clientY - startY) > DRAG_THRESHOLD)) {
        didMove = true
        setDraggingEventId(ev.id)
      }
      if (didMove) onMouseMove(me)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', wrappedMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (edgeNavTimerRef.current) { clearTimeout(edgeNavTimerRef.current); edgeNavTimerRef.current = null }
      const drag = dragRef.current; const preview = dragPreviewRef.current
      dragRef.current = null; setDraggingEventId(null); setDragPreview(null)
      if (!didMove) {
        // No movement — treat as a click: open the event detail panel
        setViewingScheduledTask(null); setEditingEvent(ev)
      } else if (drag) {
        finalizeDrop(drag, preview)
      }
    }
    document.addEventListener('mousemove', wrappedMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeDrop, makeDragMouseMove])

  const startAllDayDrag = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    if (!ev.editable) return
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { event: ev, startMouseY: e.clientY, startMouseX: e.clientX, eventDurationMs: 60 * 60 * 1000 }
    setDraggingEventId(ev.id)
    const onMouseMove = (me: MouseEvent) => {
      if (!gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      const HOUR_COL = HOUR_COL_PX
      const EDGE_ZONE = 40
      const NAV_DELAY = 800
      const rawX = me.clientX - rect.left
      if (rawX < EDGE_ZONE) {
        if (!edgeNavTimerRef.current) {
          edgeNavTimerRef.current = setTimeout(() => { edgeNavTimerRef.current = null; setStartDateRef.current((d) => addDays(d, -7)) }, NAV_DELAY)
        }
      } else if (rawX > rect.width - EDGE_ZONE) {
        if (!edgeNavTimerRef.current) {
          edgeNavTimerRef.current = setTimeout(() => { edgeNavTimerRef.current = null; setStartDateRef.current((d) => addDays(d, 7)) }, NAV_DELAY)
        }
      } else {
        if (edgeNavTimerRef.current) { clearTimeout(edgeNavTimerRef.current); edgeNavTimerRef.current = null }
      }
      const dayColWidth = (rect.width - HOUR_COL) / 7
      const relX = me.clientX - rect.left - HOUR_COL
      const dayIdx = Math.max(0, Math.min(6, Math.floor(relX / dayColWidth)))
      // Keep hour: 0 so finalizeDrop treats it as an all-day drop
      setDragPreview({ dayIdx, hour: 0 })
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (edgeNavTimerRef.current) { clearTimeout(edgeNavTimerRef.current); edgeNavTimerRef.current = null }
      const drag = dragRef.current; const preview = dragPreviewRef.current
      dragRef.current = null; setDraggingEventId(null); setDragPreview(null)
      if (drag && preview) finalizeDrop(drag, preview)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeDrop])

  const finalizeTaskDrop = useCallback(async (drag: TaskDragState, preview: { dayIdx: number; hour: number; minute?: number } | null) => {
    if (!preview || preview.hour < GRID_START_HOUR) return
    const targetDay = weekDaysRef.current[preview.dayIdx]
    if (!targetDay) return
    const newStart = new Date(targetDay); newStart.setHours(preview.hour, 0, 0, 0)
    const newEnd = new Date(newStart.getTime() + drag.taskDurationMs)
    updateTask(drag.task.id, { scheduledStart: newStart.toISOString(), scheduledEnd: newEnd.toISOString() })
    const res = await fetch(`/api/tasks/${drag.task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledStart: newStart.toISOString(), scheduledEnd: newEnd.toISOString() }),
    })
    if (res.ok) { const data = await res.json(); updateTask(drag.task.id, data) }
    else {
      updateTask(drag.task.id, { scheduledStart: drag.task.scheduledStart, scheduledEnd: drag.task.scheduledEnd })
      toast({ title: language === 'zh' ? '更新失敗' : language === 'fr' ? 'Erreur de mise à jour' : 'Failed to update', variant: 'error' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateTask, language])

  const startTaskDrag = useCallback((e: React.MouseEvent, task: Task) => {
    e.preventDefault(); e.stopPropagation()
    const start = task.scheduledStart ? new Date(String(task.scheduledStart)).getTime() : 0
    const end = task.scheduledEnd ? new Date(String(task.scheduledEnd)).getTime() : start + 60 * 60 * 1000
    taskDragRef.current = { task, startMouseY: e.clientY, startMouseX: e.clientX, taskDurationMs: Math.max(end - start, 30 * 60 * 1000) }
    setDraggingTaskId(task.id)
    const onMouseMove = makeDragMouseMove()
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      const drag = taskDragRef.current; const preview = dragPreviewRef.current
      taskDragRef.current = null; setDraggingTaskId(null); setDragPreview(null)
      if (drag) finalizeTaskDrop(drag, preview)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeTaskDrop, makeDragMouseMove])

  const handleCellMouseMove = useCallback((dayIdx: number, hour: number) => {
    if (dragRef.current || taskDragRef.current) setDragPreview({ dayIdx, hour })
  }, [])

  const handleAllDayCellMouseMove = useCallback((dayIdx: number) => {
    if (dragRef.current) setDragPreview({ dayIdx, hour: 0 })
  }, [])

  const isDragging = draggingEventId !== null || draggingTaskId !== null

  if (loading) {
    return <InkLoader size="page" />
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10 overflow-hidden">
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#ab3326]" />
            <h1 className="text-2xl font-serif text-[#2a2420]">{t('calendar', language)}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={language === 'fr' ? 'Semaine précédente' : language === 'zh' ? '上一週' : 'Previous week'} onClick={() => setStartDate((d) => addDays(d, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-[#5c5347] px-2 min-w-[160px] text-center">
              {format(weekStart, 'dd MMM', { locale })} – {format(weekEnd, 'dd MMM yyyy', { locale })}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={language === 'fr' ? 'Semaine suivante' : language === 'zh' ? '下一週' : 'Next week'} onClick={() => setStartDate((d) => addDays(d, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); const dow = d.getDay(); d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow)); setStartDate(d) }}>
              {t('today', language)}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={language === 'fr' ? 'Actualiser' : language === 'zh' ? '重新整理' : 'Refresh'}
              disabled={eventsLoading}
              onClick={() => { loadTasks(); loadExternalEvents() }}
            >
              <RefreshCw className={cn('h-4 w-4', eventsLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end overflow-hidden">
          {undoCount > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={language === 'fr' ? 'Annuler (Ctrl+Z)' : language === 'zh' ? '復原 (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
              onClick={() => {
                const item = undoStackRef.current.pop()
                setUndoCount(undoStackRef.current.length)
                if (item) handleSaveEventRef.current(item.event, item.event.title, item.prevStart, item.prevEnd, item.prevAllDay)
              }}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-[#a99873]" />}
          <EventSearchBox
            lang={language}
            calendarAccounts={calendarAccounts}
            onPick={(ev) => {
              setStartDate(mondayOf(eventStartDate(ev)))
              setViewingScheduledTask(null)
              setEditingEvent(ev)
            }}
          />
          {calendarAccounts.length > 0 && (
            <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none shrink-1">
              {calendarAccounts.map((acc) => {
                const hidden = hiddenAccountIds.has(acc.id)
                return (
                  <button
                    key={acc.id}
                    title={hidden ? acc.name + ' (masqué)' : acc.name}
                    onClick={() => toggleAccount(acc.id)}
                    className="flex items-center gap-1 rounded-full px-1.5 py-0.5 border transition-all text-xs hover:opacity-80 shrink-0"
                    style={{
                      borderColor: hidden ? '#d1c9b8' : acc.color,
                      backgroundColor: hidden ? 'transparent' : acc.color + '20',
                      color: hidden ? '#a99873' : acc.color,
                      textDecoration: hidden ? 'line-through' : 'none',
                      opacity: hidden ? 0.5 : 1,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: hidden ? '#a99873' : acc.color }} />
                    <span className="max-w-[48px] truncate">{acc.name}</span>
                  </button>
                )
              })}
              {habits.length > 0 && (
                <button
                  title={habitsHidden ? (language === 'zh' ? '習慣（已隱藏）' : language === 'fr' ? 'Habitudes (masquées)' : 'Habits (hidden)') : (language === 'zh' ? '習慣' : language === 'fr' ? 'Habitudes' : 'Habits')}
                  onClick={() => toggleHabitsView('calendar')}
                  className="flex items-center gap-1 rounded-full px-1.5 py-0.5 border transition-all text-xs hover:opacity-80 shrink-0"
                  style={{
                    borderColor: habitsHidden ? '#d1c9b8' : '#22c55e',
                    backgroundColor: habitsHidden ? 'transparent' : '#22c55e20',
                    color: habitsHidden ? '#a99873' : '#16a34a',
                    textDecoration: habitsHidden ? 'line-through' : 'none',
                    opacity: habitsHidden ? 0.5 : 1,
                  }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: habitsHidden ? '#a99873' : '#22c55e' }} />
                  <span>{language === 'zh' ? '習慣' : language === 'fr' ? 'Habitudes' : 'Habits'}</span>
                </button>
              )}
            </div>
          )}
          <Button size="sm" onClick={() => { setSelectedDate(new Date()); setShowTaskForm(true) }}>
            <Plus className="h-4 w-4" />
            {t('addTask', language)}
          </Button>
        </div>
      </div>

      {/* Retroplanning suggestion banner */}
      {retroSuggestion && (
        <RetroSuggestionBanner
          suggestion={retroSuggestion}
          lang={language}
          saving={retroSuggestionSaving}
          onApply={handleApplyRetroSuggestion}
          onDismiss={handleDismissRetroSuggestion}
        />
      )}

      {/* Body: chain sidebar + calendar grid + detail side panel */}
      <div className="flex flex-1 min-h-0">

      {/* Left: chain panel */}
      <div className={cn('shrink-0 border-r border-[#e2d6bc] bg-[#fbf7ee] flex flex-col overflow-hidden transition-all duration-200', chainPanelOpen ? 'w-56' : 'w-9')}>
        <button
          onClick={() => setChainPanelOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-2.5 border-b border-[#ece2cb] hover:bg-[#f3ecdd] transition-colors shrink-0 w-full"
          title={chainPanelOpen ? (language === 'zh' ? '收合' : language === 'fr' ? 'Réduire' : 'Collapse') : (language === 'zh' ? '展開任務鏈' : language === 'fr' ? 'Chaînes' : 'Chains')}
        >
          <GitBranch className="h-3.5 w-3.5 text-[#a99873] shrink-0" />
          {chainPanelOpen && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a99873] flex-1 text-left truncate">
              {language === 'zh' ? '任務鏈' : language === 'fr' ? 'Chaînes' : 'Chains'}
            </span>
          )}
          {chainPanelOpen && <ChevronLeft className="h-3.5 w-3.5 text-[#c4b48a] shrink-0" />}
        </button>
        {chainPanelOpen && (
          <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1 px-2">
            {allChains.length === 0 && (
              <p className="text-[10px] text-[#c4b48a] text-center py-4 px-1">
                {language === 'zh' ? '沒有任務鏈' : language === 'fr' ? 'Aucune chaîne' : 'No chains'}
              </p>
            )}
            {allChains.map(({ parent, children, displayHead }) => {
              const allDone = parent.status === 'COMPLETED' && children.every((c) => c.status === 'COMPLETED')
              const headDeadline = displayHead.deadline ? new Date(String(displayHead.deadline)) : null
              const isOverdue = !allDone && !!headDeadline && headDeadline < new Date()
              const members = [parent, ...children]
              const donePct = Math.round((members.filter((t) => t.status === 'COMPLETED').length / members.length) * 100)
              const expanded = expandedChainIds.has(parent.id)
              // Read back from the deadline: the last thing due sits at the top.
              const ordered = [...members].sort((a, b) => {
                const da = a.deadline ? new Date(String(a.deadline)).getTime() : 0
                const db = b.deadline ? new Date(String(b.deadline)).getTime() : 0
                if (da !== db) return db - da
                return a.title.localeCompare(b.title)
              })
              return (
                <div
                  key={parent.id}
                  className={cn(
                    'rounded-xl border overflow-hidden transition-all w-full',
                    allDone ? 'opacity-50 border-[#e2d6bc] bg-[#f9f5ec]' : isOverdue ? 'border-red-200 bg-red-50/40' : 'border-[#ece2cb] bg-white'
                  )}
                >
                  <button
                    onClick={() => toggleChainExpanded(parent.id)}
                    aria-expanded={expanded}
                    className={cn(
                      'flex flex-col gap-1 px-2.5 py-2 text-left w-full cursor-pointer transition-colors',
                      isOverdue ? 'hover:bg-red-50' : 'hover:bg-[#f3ecdd]'
                    )}
                  >
                    <div className="flex items-start gap-1.5 w-full min-w-0">
                      {isOverdue && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0 mt-0.5" />}
                      {allDone && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0 mt-0.5" />}
                      {!isOverdue && !allDone && <GitBranch className="h-2.5 w-2.5 text-[#c4b48a] shrink-0 mt-0.5" />}
                      <span
                        className={cn('text-[11px] font-medium leading-snug truncate flex-1', allDone ? 'line-through text-[#a99873]' : isOverdue ? 'text-red-700' : 'text-[#3a3326]')}
                        title={parent.chainName ? `${parent.chainName} — ${displayHead.title}` : displayHead.title}
                      >
                        {parent.chainName || displayHead.title}
                      </span>
                      <ChevronDown className={cn('h-3 w-3 text-[#c4b48a] shrink-0 mt-0.5 transition-transform', expanded && 'rotate-180')} />
                    </div>
                    {headDeadline && (
                      <span className={cn('text-[10px] pl-4', isOverdue ? 'text-red-400' : 'text-[#a99873]')}>
                        {fmtDate(headDeadline, language)}
                      </span>
                    )}
                    <div className="pl-4 flex items-center gap-1.5 w-full">
                      <div className="flex-1 h-1 rounded-full bg-[#ece2cb] overflow-hidden">
                        <div className={cn('h-full rounded-full', allDone ? 'bg-emerald-400' : 'bg-red-400')} style={{ width: `${donePct}%` }} />
                      </div>
                      <span className="text-[9px] text-[#c4b48a] font-mono shrink-0">{donePct}%</span>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-[#ece2cb] px-1.5 py-1 flex flex-col gap-0.5">
                      {ordered.map((t) => {
                        const done = t.status === 'COMPLETED'
                        const dl = t.deadline ? new Date(String(t.deadline)) : null
                        const late = !done && !!dl && dl < new Date()
                        const isHead = t.id === parent.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => openChainTask(t)}
                            title={t.title}
                            className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left w-full hover:bg-[#f3ecdd] transition-colors"
                          >
                            {done
                              ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                              : <Circle className={cn('h-2.5 w-2.5 shrink-0', late ? 'text-red-400' : 'text-[#c4b48a]')} />}
                            <span className={cn('text-[10px] truncate flex-1', done ? 'line-through text-[#a99873]' : isHead ? 'text-[#3a3326] font-medium' : 'text-[#5c5347]')}>
                              {t.title}
                            </span>
                            {dl && (
                              <span className={cn('text-[9px] shrink-0', late ? 'text-red-400' : 'text-[#c4b48a]')}>
                                {fmtDate(dl, language)}
                              </span>
                            )}
                            {t.calendarEventId && <ChevronRight className="h-2.5 w-2.5 text-[#d4c8aa] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Calendar grid — swipe / pointer-drag anywhere to change week */}
      <div
        className={cn('flex-1 overflow-auto min-w-0', isDragging && 'cursor-grabbing select-none')}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchStartXRef.current === null) return
          const delta = e.changedTouches[0].clientX - touchStartXRef.current
          touchStartXRef.current = null
          if (Math.abs(delta) < 60) return
          setStartDate((d) => addDays(d, delta > 0 ? -7 : 7))
        }}
        onPointerDown={(e) => {
          // Only track background drags (not on interactive elements or during event/task drag)
          const target = e.target as HTMLElement
          if (isDragging || target.closest('button,a,[role="button"]')) return
          touchStartXRef.current = e.clientX
        }}
        onPointerUp={(e) => {
          // Skip swipe detection when an event/task drag just finished — isDragging is still true
          // at pointerup time (pointerup fires before mouseup which clears dragging state).
          if (touchStartXRef.current === null || e.pointerType === 'touch' || isDragging) return
          const delta = e.clientX - touchStartXRef.current
          touchStartXRef.current = null
          if (Math.abs(delta) < 80) return
          setStartDate((d) => addDays(d, delta > 0 ? -7 : 7))
        }}
        onWheel={(e) => {
          // Horizontal scroll (trackpad swipe) → shift date by days
          if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
          wheelAccRef.current += e.deltaX
          const days = Math.trunc(wheelAccRef.current / 40)
          if (days !== 0) {
            wheelAccRef.current -= days * 40
            setStartDate((d) => addDays(d, days))
          }
        }}
      >
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className={cn('grid border-b border-[#ece2cb] bg-[#fbf7ee] sticky top-0 z-10', hourColClass)}>
            <div className="py-2 px-1 text-[10px] text-[#a99873] border-r border-[#ece2cb] flex flex-col items-end justify-end gap-0.5 cursor-pointer hover:bg-[#f3ecdd] transition-colors" onClick={() => setTzDialogOpen(true)}>
              {secondaryTz && <span className="text-[#c0a87a] leading-none">{tzLabel(secondaryTz)}</span>}
              <span className="leading-none">{tzLabel(primaryTz)}</span>
            </div>
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn('py-3 px-2 text-center border-r border-[#ece2cb]', isToday(day) && 'bg-red-50')}
              >
                <p className="text-xs text-[#8a7a5e] uppercase">{format(day, 'EEE', { locale })}</p>
                <p className={cn('text-sm font-semibold mt-0.5', isToday(day) ? 'text-red-800' : 'text-[#2a2420]')}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>

          {/* All-day row (habits + all-day events only, no deadline column) */}
          <div className={cn('grid border-b-2 border-[#e2d6bc] bg-[#f3ecdd]/60', hourColClass)}>
            <div className="border-r border-[#e2d6bc]" />
            {weekDays.map((day, dayIdx) => {
              const allDayEvs = getAllDayEventsForDay(day)
              const allDayHabits = getHabitsAllDayForDay(day)
              const deadlineTasks = getDeadlineTasksForDay(day)
              const total = allDayEvs.length + allDayHabits.length + deadlineTasks.length
              const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && (dragPreview?.hour ?? 7) < 7
              return (
                <div
                  key={day.toISOString()}
                  className={cn('border-r border-[#e2d6bc] px-1 py-1 min-h-[32px] overflow-hidden min-w-0', isToday(day) && 'bg-red-50/40', isPreviewHere && 'bg-red-100/60')}
                  onMouseMove={() => handleAllDayCellMouseMove(dayIdx)}
                >
                  {allDayEvs.map((ev) => {
                    const color = ev.color ?? calendarAccounts.find((a) => a.id === ev.calendarAccountId)?.color ?? '#6366F1'
                    const isDraggingThis = draggingEventId === ev.id
                    const linkedTask = taskForEvent(tasks, ev.id)
                    const isLinkedDone = linkedTask?.status === 'COMPLETED'
                    const isHighlighted = linkedTask?.id === highlightedTaskId
                    return (
                      <div
                        key={ev.id}
                        className={cn('rounded px-1.5 py-0.5 text-xs mb-0.5 border flex items-center gap-1 min-w-0 transition-all duration-300', ev.editable && !isDragging ? 'cursor-grab' : '', isDraggingThis && 'opacity-40', isLinkedDone && 'opacity-50', isHighlighted ? 'border-solid shadow-md' : 'border-dashed')}
                        style={{ backgroundColor: isHighlighted ? color + '55' : color + '22', borderColor: color, boxShadow: isHighlighted ? `0 0 0 2px ${color}` : undefined }}
                        title={ev.title}
                        onMouseDown={(e) => { if (ev.editable) startAllDayDrag(e, ev) }}
                        onClick={(e) => { e.stopPropagation(); if (!isDragging) { setViewingScheduledTask(null); setEditingEvent(ev) } }}
                      >
                        {!ev.habitId && (
                          <button
                            className="shrink-0 hover:scale-110 transition-transform"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); toggleEventDone(ev) }}
                            title={isLinkedDone ? doneToggleLabel.undo : doneToggleLabel.done}
                          >
                            {isLinkedDone
                              ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              : <Circle className="h-3 w-3 text-[#cbb98e]" />}
                          </button>
                        )}
                        <span className={cn('text-[#2a2420] truncate flex-1', isLinkedDone && 'line-through text-[#6e6147]')} title={ev.title}>{ev.title}</span>
                        {linkedTask && (
                          <span className="shrink-0 text-[9px] opacity-60 font-mono whitespace-nowrap">
                            I:{linkedTask.importance} U:{linkedTask.urgency}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {allDayHabits.map((habit) => {
                    const doneToday = isToday(day) ? (habit.completions?.length ?? 0) > 0 : false
                    return (
                      <div
                        key={habit.id}
                        className={cn('rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border border-dashed select-none flex items-center gap-1 cursor-pointer', doneToday && 'opacity-60')}
                        style={{ backgroundColor: habit.color + '18', borderColor: habit.color, color: habit.color }}
                        title={habit.title}
                        onClick={() => setViewingHabit(habit)}
                      >
                        {doneToday
                          ? <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                          : <span className="h-2 w-2 rounded-full border shrink-0" style={{ borderColor: habit.color }} />
                        }
                        <span className={cn('truncate', doneToday && 'line-through')}>{habit.icon ?? '🔁'} {habit.title}</span>
                      </div>
                    )
                  })}
                  {deadlineTasks.map((task) => {
                    const done = task.status === 'COMPLETED'
                    const qId = getQuadrant(task.importance, task.urgency)
                    const q = EISENHOWER_QUADRANTS.find((qq) => qq.id === qId)
                    const acc = calendarAccounts.find((a) => a.id === task.calendarAccountId)
                    const borderColor = acc?.color ?? (q ? undefined : '#a99873')
                    const isHighlightedTask = task.id === highlightedTaskId
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border cursor-pointer hover:brightness-95 transition-all',
                          done ? 'opacity-50 bg-emerald-50 border-emerald-200' : cn(q?.bgColor, 'border-[#e2d6bc]'),
                          isHighlightedTask && 'shadow-md'
                        )}
                        style={{ ...(!done && borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 2 } : {}), ...(isHighlightedTask ? { boxShadow: `0 0 0 2px ${borderColor ?? '#c97b4b'}` } : {}) }}
                        title={`${task.title} — I:${task.importance} U:${task.urgency}`}
                        onClick={(e) => { e.stopPropagation(); handleTaskClick(task) }}
                      >
                        <button
                          className="shrink-0 mr-0.5 hover:scale-110 transition-transform"
                          onClick={(e) => { e.stopPropagation(); handleCompleteTask(task) }}
                        >
                          {done
                            ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            : <Circle className="h-3 w-3 text-[#cbb98e]" />}
                        </button>
                        <span className={cn('truncate flex-1', done ? 'line-through text-[#a99873]' : 'text-[#2a2420]')}>{task.title}</span>
                        <span className="ml-1 text-[10px] opacity-60 shrink-0">I:{task.importance} U:{task.urgency}</span>
                      </div>
                    )
                  })}
                  {total === 0 && !isPreviewHere && <div className="h-5" />}
                  {isPreviewHere && dragRef.current && (() => {
                    const drag = dragRef.current!
                    const evColor = drag.event.color ?? calendarAccounts.find((a) => a.id === drag.event.calendarAccountId)?.color ?? '#6366F1'
                    return (
                      <div
                        className="rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border-2 border-dashed pointer-events-none"
                        style={{ backgroundColor: evColor + '30', borderColor: evColor, color: evColor }}
                      >
                        {drag.event.title}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>

          {/* Time grid */}
          <div className="relative" ref={gridRef}>
            {HOURS.map((hour) => (
              <div key={hour} className={cn('grid border-b border-[#f3ecdd] h-[60px]', hourColClass)}>
                <div className="flex border-r border-[#ece2cb] shrink-0">
                  {secondaryTz && (
                    <div className="w-12 px-1 py-1 text-xs text-[#c0a87a] text-right border-r border-[#ece2cb]/60">
                      {hourInTz(hour, secondaryTz)}
                    </div>
                  )}
                  <div className="w-12 px-1 py-1 text-xs text-[#a99873] text-right">
                    {hourInTz(hour, primaryTz)}
                  </div>
                </div>
                {weekDays.map((day, dayIdx) => {
                  const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && dragPreview?.hour === hour
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn('border-r border-[#ece2cb] cursor-pointer hover:bg-[#f3ecdd] transition-colors', isToday(day) && 'bg-red-50/30', isPreviewHere && 'bg-red-100/40')}
                      onClick={() => handleCellClick(day, hour)}
                      onMouseMove={() => handleCellMouseMove(dayIdx, hour)}
                    />
                  )
                })}
              </div>
            ))}

            {/* Absolutely positioned event blocks */}
            <div className={cn('absolute inset-0 grid pointer-events-none', hourColClass)}>
              <div className="shrink-0" style={{ width: HOUR_COL_PX }} />
              {weekDays.map((day, dayIdx) => {
                const blocks = getDayBlocks(day)
                const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && (dragPreview?.hour ?? -1) >= GRID_START_HOUR
                return (
                  <div key={day.toISOString()} className="relative px-1">
                    {blocks.map((block) => {
                      const top = block.start
                      const height = Math.max(block.end - block.start, MIN_BLOCK_HEIGHT)
                      const cols = Math.max(1, block.cols)
                      const widthPct = 100 / cols
                      const leftPct = block.col * widthPct
                      const boxStyle: React.CSSProperties = {
                        position: 'absolute',
                        top,
                        height,
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - 4px)`,
                        zIndex: block.col,
                      }

                      if (block.kind === 'event') {
                        const ev = block.data
                        const evColor = ev.color ?? calendarAccounts.find((a) => a.id === ev.calendarAccountId)?.color ?? '#6366F1'
                        const isDraggingThis = draggingEventId === ev.id
                        const evDone = taskForEvent(tasks, ev.id)?.status === 'COMPLETED'
                        return (
                          <div
                            key={block.id}
                            onClick={(e) => { e.stopPropagation(); if (!isDragging) { setViewingScheduledTask(null); setEditingEvent(ev) } }}
                            onMouseDown={(e) => { if (ev.editable) startDrag(e, ev) }}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs border border-dashed overflow-hidden group',
                              isDragging ? 'pointer-events-none' : 'pointer-events-auto',
                              ev.editable ? 'cursor-grab hover:brightness-95' : 'select-none',
                              isDraggingThis && 'opacity-40',
                              evDone && 'opacity-60'
                            )}
                            style={{ ...boxStyle, backgroundColor: evColor + '22', borderColor: evColor }}
                          >
                            <p className={cn('font-medium truncate text-[#2a2420]', evDone && 'line-through text-[#6e6147]')} title={ev.title}>{ev.title}</p>
                            {ev.start && ev.end && (
                              <p className="flex items-center gap-1 text-[#5c5347]">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(ev.start)} – {formatTime(ev.end)}
                              </p>
                            )}
                            {!ev.habitId && (
                              <button
                                className={cn(
                                  'absolute bottom-1 right-1 h-4 w-4 rounded-full flex items-center justify-center bg-white/80 hover:bg-emerald-50 transition-all',
                                  evDone ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                )}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); toggleEventDone(ev) }}
                                title={evDone ? doneToggleLabel.undo : doneToggleLabel.done}
                              >
                                <Check className={cn('h-2.5 w-2.5', evDone ? 'text-emerald-600' : 'text-[#a99873]')} />
                              </button>
                            )}
                          </div>
                        )
                      }

                      if (block.kind === 'task') {
                        const task = block.data
                        const qId = getQuadrant(task.importance, task.urgency)
                        const q = EISENHOWER_QUADRANTS.find((q) => q.id === qId)
                        const acc = calendarAccounts.find((a) => a.id === task.calendarAccountId)
                        const done = task.status === 'COMPLETED'
                        const isRetro = !!task.parentTaskId
                        const isDraggingThisTask = draggingTaskId === task.id
                        return (
                          <div
                            key={block.id}
                            onMouseDown={(e) => { if (!isDragging) startTaskDrag(e, task) }}
                            onClick={(e) => { e.stopPropagation(); if (!isDragging) handleTaskClick(task) }}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs border transition-all hover:shadow-sm overflow-hidden group relative',
                              isDragging ? 'pointer-events-none' : 'cursor-grab pointer-events-auto',
                              isDraggingThisTask && 'opacity-40',
                              done
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-70'
                                : isRetro
                                ? 'border-dashed border-purple-300 bg-purple-50/80 text-purple-900'
                                : cn(q?.bgColor, q?.color)
                            )}
                            style={{ ...boxStyle, ...(!done && !isRetro && acc ? { borderLeftColor: acc.color, borderLeftWidth: 3 } : {}) }}
                          >
                            {isRetro && <GitBranch className="h-2.5 w-2.5 absolute top-1 right-1 opacity-50" />}
                            <p className={cn('font-medium truncate', done && 'line-through')} title={task.title}>{task.title}</p>
                            {task.scheduledStart && task.scheduledEnd && (
                              <p className="opacity-70 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(task.scheduledStart)} – {formatTime(task.scheduledEnd)}
                              </p>
                            )}
                            {/* Completion toggle */}
                            <button
                              className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 h-4 w-4 rounded-full flex items-center justify-center bg-white/80 hover:bg-emerald-50 transition-all"
                              onClick={(e) => { e.stopPropagation(); handleCompleteTask(task) }}
                              title={done ? (language === 'zh' ? '標為未完成' : 'Mark pending') : (language === 'zh' ? '標為完成' : 'Mark done')}
                            >
                              <Check className="h-2.5 w-2.5 text-emerald-600" />
                            </button>
                          </div>
                        )
                      }

                      // habit block
                      const habit = block.data
                      const doneToday = (habit.completions?.length ?? 0) > 0
                      return (
                        <div
                          key={block.id}
                          title={habit.title}
                          className={cn(
                            'rounded-lg px-2 py-1 text-xs border overflow-hidden group relative',
                            isDragging ? 'pointer-events-none' : 'pointer-events-auto',
                            doneToday ? 'border-emerald-200 opacity-60' : 'border-dashed cursor-pointer hover:brightness-95'
                          )}
                          style={{ ...boxStyle, backgroundColor: habit.color + '18', borderColor: habit.color, color: habit.color }}
                          onClick={(e) => { e.stopPropagation(); setViewingHabit(habit) }}
                        >
                          <p className={cn('font-medium truncate', doneToday && 'line-through')} title={`${habit.icon ?? '🔁'} ${habit.title}`}>
                            {habit.icon ?? '🔁'} {habit.title}
                          </p>
                          {habit.durationMinutes && (
                            <p className="opacity-70 text-[10px]">{habit.durationMinutes} min</p>
                          )}
                          {!doneToday && (
                            <button
                              className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 h-4 w-4 rounded-full flex items-center justify-center bg-white/80 hover:bg-emerald-50 transition-all"
                              onClick={(e) => { e.stopPropagation(); handleCompleteHabit(habit) }}
                              title={language === 'zh' ? '完成習慣' : language === 'fr' ? 'Valider' : 'Complete'}
                            >
                              <Check className="h-2.5 w-2.5 text-emerald-600" />
                            </button>
                          )}
                        </div>
                      )
                    })}

                    {/* Ghost preview */}
                    {isPreviewHere && dragRef.current && (() => {
                      const drag = dragRef.current!
                      const top = (dragPreview!.hour - GRID_START_HOUR) * 60
                      const height = Math.max(drag.eventDurationMs / 60000, MIN_BLOCK_HEIGHT)
                      const evColor = drag.event.color ?? calendarAccounts.find((a) => a.id === drag.event.calendarAccountId)?.color ?? '#6366F1'
                      return (
                        <div
                          className="absolute rounded-lg px-2 py-1 text-xs border-2 border-dashed pointer-events-none overflow-hidden"
                          style={{ top, height, left: 0, width: 'calc(100% - 4px)', backgroundColor: evColor + '30', borderColor: evColor, color: evColor }}
                        >
                          <p className="font-medium truncate">{drag.event.title}</p>
                        </div>
                      )
                    })()}
                    {isPreviewHere && taskDragRef.current && (() => {
                      const drag = taskDragRef.current!
                      const top = (dragPreview!.hour - GRID_START_HOUR) * 60
                      const height = Math.max(drag.taskDurationMs / 60000, MIN_BLOCK_HEIGHT)
                      return (
                        <div
                          className="absolute rounded-lg px-2 py-1 text-xs border-2 border-dashed pointer-events-none overflow-hidden"
                          style={{ top, height, left: 0, width: 'calc(100% - 4px)', backgroundColor: '#7c3aed30', borderColor: '#7c3aed', color: '#7c3aed' }}
                        >
                          <p className="font-medium truncate">{drag.task.title}</p>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right detail panel */}
      {editingEvent ? (
        <EventDetailPanel
          event={editingEvent}
          lang={language}
          saving={eventSaving}
          tasks={tasks}
          calendarAccounts={calendarAccounts}
          currentWeekEvents={externalEvents}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onToggleDone={toggleEventDone}
          onClose={() => setEditingEvent(null)}
          onTasksRefresh={async () => {
            const res = await fetch('/api/tasks')
            if (res.ok) setTasks(await res.json())
          }}
          onNavigateToDate={(date: Date, taskId?: string) => {
            const d = new Date(date); d.setHours(0, 0, 0, 0)
            const dow = d.getDay()
            const toMon = dow === 0 ? -6 : 1 - dow
            d.setDate(d.getDate() + toMon)
            setStartDate(d)
            if (taskId) { setHighlightedTaskId(taskId); setTimeout(() => setHighlightedTaskId(null), 3000) }
          }}
          onMoveEvent={handleMoveEvent}
        />
      ) : viewingScheduledTask ? (
        <ScheduledTaskPanel
          task={viewingScheduledTask}
          lang={language}
          tasks={tasks}
          onClose={() => setViewingScheduledTask(null)}
          onEdit={(task) => { setEditingTask(task); setShowTaskForm(true) }}
          onTasksRefresh={async () => {
            const res = await fetch('/api/tasks')
            if (res.ok) setTasks(await res.json())
          }}
          onTaskUpdate={(id, data) => {
            updateTask(id, data)
            setViewingScheduledTask((prev) => prev?.id === id ? { ...prev, ...data } : prev)
          }}
          onNavigateToDate={(date: Date, taskId?: string) => {
            const d = new Date(date); d.setHours(0, 0, 0, 0)
            const dow = d.getDay()
            const toMon = dow === 0 ? -6 : 1 - dow
            d.setDate(d.getDate() + toMon)
            setStartDate(d)
            if (taskId) { setHighlightedTaskId(taskId); setTimeout(() => setHighlightedTaskId(null), 3000) }
          }}
        />
      ) : viewingHabit ? (
        <HabitDetailPanel
          habit={viewingHabit}
          lang={language}
          onComplete={() => handleCompleteHabit(viewingHabit)}
          onClose={() => setViewingHabit(null)}
        />
      ) : null}

      </div>{/* end body row */}

      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); setSelectedDate(null) }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={editingTask}
        calendarAccounts={calendarAccounts}
        lang={language}
      />

      {/* Timezone settings dialog */}
      <TimezoneDialog
        open={tzDialogOpen}
        onClose={() => setTzDialogOpen(false)}
        primaryTimezone={primaryTimezone}
        secondaryTimezone={secondaryTimezone}
        onSetPrimary={setPrimaryTimezone}
        onSetSecondary={setSecondaryTimezone}
        lang={language}
      />
    </div>
  )
}

// ─── Timezone Dialog ──────────────────────────────────────────────────────────

const COMMON_TIMEZONES = [
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

function TimezoneDialog({
  open, onClose, primaryTimezone, secondaryTimezone, onSetPrimary, onSetSecondary, lang,
}: {
  open: boolean
  onClose: () => void
  primaryTimezone: string | null
  secondaryTimezone: string | null
  onSetPrimary: (tz: string | null) => void
  onSetSecondary: (tz: string | null) => void
  lang: 'fr' | 'en' | 'zh'
}) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const [primarySearch, setPrimarySearch] = React.useState('')
  const [secondarySearch, setSecondarySearch] = React.useState('')

  const filter = (search: string) => {
    const q = search.toLowerCase()
    return COMMON_TIMEZONES.filter((tz) => tz.toLowerCase().includes(q))
  }

  const label = (key: string, zh: string, fr: string, en: string) =>
    lang === 'zh' ? zh : lang === 'fr' ? fr : en

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{label('tz', '時區設定', 'Fuseaux horaires', 'Timezone settings')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 mt-2">
          {/* Primary */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#a99873] uppercase tracking-widest">
              {label('primary', '主時區', 'Fuseau principal', 'Primary timezone')}
            </p>
            <input
              className="border border-[#ece2cb] rounded px-2 py-1 text-sm bg-[#fbf7ee] focus:outline-none focus:ring-1 focus:ring-[#ab3326]/40"
              placeholder={label('search', '搜尋…', 'Rechercher…', 'Search…')}
              value={primarySearch}
              onChange={(e) => setPrimarySearch(e.target.value)}
            />
            <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5">
              <button
                className={`text-left px-2 py-1 rounded text-sm hover:bg-[#f3ecdd] ${!primaryTimezone ? 'bg-[#f3ecdd] font-medium' : ''}`}
                onClick={() => { onSetPrimary(null); setPrimarySearch('') }}
              >
                {label('local', '本地時區', 'Heure locale', 'Local time')} ({localTz})
              </button>
              {filter(primarySearch).map((tz) => (
                <button
                  key={tz}
                  className={`text-left px-2 py-1 rounded text-sm hover:bg-[#f3ecdd] ${primaryTimezone === tz ? 'bg-[#f3ecdd] font-medium' : ''}`}
                  onClick={() => { onSetPrimary(tz); setPrimarySearch('') }}
                >
                  {tz}
                </button>
              ))}
            </div>
          </div>

          {/* Secondary */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#a99873] uppercase tracking-widest">
              {label('secondary', '副時區', 'Fuseau secondaire', 'Secondary timezone')}
            </p>
            <input
              className="border border-[#ece2cb] rounded px-2 py-1 text-sm bg-[#fbf7ee] focus:outline-none focus:ring-1 focus:ring-[#ab3326]/40"
              placeholder={label('search', '搜尋…', 'Rechercher…', 'Search…')}
              value={secondarySearch}
              onChange={(e) => setSecondarySearch(e.target.value)}
            />
            <div className="max-h-36 overflow-y-auto flex flex-col gap-0.5">
              <button
                className={`text-left px-2 py-1 rounded text-sm hover:bg-[#f3ecdd] ${!secondaryTimezone ? 'bg-[#f3ecdd] font-medium' : ''}`}
                onClick={() => { onSetSecondary(null); setSecondarySearch('') }}
              >
                {label('none', '不顯示', 'Aucun', 'None')}
              </button>
              {filter(secondarySearch).map((tz) => (
                <button
                  key={tz}
                  className={`text-left px-2 py-1 rounded text-sm hover:bg-[#f3ecdd] ${secondaryTimezone === tz ? 'bg-[#f3ecdd] font-medium' : ''}`}
                  onClick={() => { onSetSecondary(tz); setSecondarySearch('') }}
                >
                  {tz}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Retroplanning suggestion banner ─────────────────────────────────────────

function RetroSuggestionBanner({
  suggestion,
  lang,
  saving,
  onApply,
  onDismiss,
}: {
  suggestion: RetroSuggestion
  lang: 'fr' | 'en' | 'zh'
  saving: boolean
  onApply: (s: RetroSuggestion, stages: Array<{ name: string; daysBeforeDeadline: number }>) => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [stages, setStages] = useState(suggestion.stages)

  const eventDate = new Date(suggestion.event.start)
  const dateStr = eventDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
      <div className="flex items-start gap-3">
        <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            {lang === 'fr' ? 'Rétroplanning détecté' : lang === 'zh' ? '偵測到逆向規劃機會' : 'Retroplanning detected'}
          </p>
          <p className="text-xs text-amber-700 mt-0.5 truncate">
            <span className="font-medium">{suggestion.event.title}</span>
            {' — '}{dateStr}
          </p>

          {expanded && (
            <div className="mt-3 flex flex-col gap-1.5">
              {stages.map((s, i) => {
                const stageDate = new Date(eventDate)
                stageDate.setDate(stageDate.getDate() - s.daysBeforeDeadline)
                const stageSameYear = stageDate.getFullYear() === new Date().getFullYear()
                const stageDateStr = stageDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short', ...(stageSameYear ? {} : { year: 'numeric' }) })
                return (
                  <div key={i} className="flex items-center gap-2 bg-white/70 rounded-lg px-3 py-2 border border-amber-200">
                    <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <input
                      className="flex-1 bg-transparent text-xs text-amber-900 outline-none min-w-0"
                      value={s.name}
                      onChange={(e) => setStages((prev) => prev.map((st, idx) => idx === i ? { ...st, name: e.target.value } : st))}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={1}
                        className="w-10 text-center text-xs border border-amber-200 rounded px-1 py-0.5 bg-white"
                        value={s.daysBeforeDeadline}
                        onChange={(e) => setStages((prev) => prev.map((st, idx) => idx === i ? { ...st, daysBeforeDeadline: Math.max(1, Number(e.target.value)) } : st))}
                      />
                      <span className="text-xs text-amber-600">{lang === 'fr' ? 'j av.' : lang === 'zh' ? '天前' : 'd before'}</span>
                      <span className="text-xs text-amber-500 ml-1">{stageDateStr}</span>
                    </div>
                  </div>
                )
              })}
              <button
                onClick={() => setStages((prev) => [...prev, { name: '', daysBeforeDeadline: 3 }])}
                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 px-3 py-1"
              >
                <Plus className="h-3 w-3" />
                {lang === 'fr' ? 'Ajouter une étape' : lang === 'zh' ? '新增階段' : 'Add stage'}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-amber-700 hover:text-amber-900 underline"
          >
            {expanded ? (lang === 'fr' ? 'Réduire' : lang === 'zh' ? '收起' : 'Collapse') : (lang === 'fr' ? 'Modifier' : lang === 'zh' ? '調整' : 'Adjust')}
          </button>
          <button
            onClick={() => onApply(suggestion, stages)}
            disabled={saving}
            className="flex items-center gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {lang === 'fr' ? 'Créer' : lang === 'zh' ? '建立' : 'Create'}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit event modal ─────────────────────────────────────────────────────────

function HabitDetailPanel({ habit, lang, onComplete, onClose }: {
  habit: Habit
  lang: 'fr' | 'en' | 'zh'
  onComplete: () => void
  onClose: () => void
}) {
  const done = (habit.completions?.length ?? 0) > 0
  const freqLabel = habit.frequency === 'DAILY'
    ? (lang === 'zh' ? '每天' : lang === 'fr' ? 'Chaque jour' : 'Daily')
    : habit.frequency === 'WEEKDAYS'
    ? (lang === 'zh' ? '週一到週五' : lang === 'fr' ? 'Jours ouvrés' : 'Weekdays')
    : (lang === 'zh' ? '週末' : lang === 'fr' ? 'Week-ends' : 'Weekends')

  return (
    <div className="w-72 shrink-0 border-l border-[#e2d6bc] bg-[#fbf7ee] flex flex-col overflow-hidden">
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: habit.color }} />
      <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873]">
          {lang === 'zh' ? '習慣' : lang === 'fr' ? 'Habitude' : 'Habit'}
        </p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {habit.icon && <span className="text-xl">{habit.icon}</span>}
          <h2 className="text-sm font-semibold text-[#2a2420]">{habit.title}</h2>
        </div>
        <div className="flex flex-col gap-2 text-xs text-[#5c5347]">
          <div className="flex items-center gap-2">
            <span className="text-[#a99873]">{lang === 'zh' ? '頻率' : lang === 'fr' ? 'Fréquence' : 'Frequency'}</span>
            <span className="font-medium">{freqLabel}</span>
          </div>
          {habit.scheduledTime && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#a99873]" />
              <span>{habit.scheduledTime}{habit.durationMinutes ? ` · ${habit.durationMinutes} min` : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{lang === 'zh' ? '連續' : lang === 'fr' ? 'Série' : 'Streak'}: <strong>{habit.streak ?? 0}</strong></span>
          </div>
        </div>
        <button
          onClick={() => { if (!done) onComplete() }}
          disabled={done}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
            done
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default'
              : 'text-white hover:opacity-90'
          )}
          style={done ? {} : { backgroundColor: habit.color }}
        >
          <CheckCircle2 className="h-4 w-4" />
          {done
            ? (lang === 'zh' ? '已完成' : lang === 'fr' ? 'Complété ✓' : 'Completed ✓')
            : (lang === 'zh' ? '標記完成' : lang === 'fr' ? 'Valider' : 'Mark done')}
        </button>
      </div>
    </div>
  )
}

// ─── Scheduled Task Detail Panel ─────────────────────────────────────────────

function ScheduledTaskPanel({
  task, lang, tasks, onClose, onEdit, onTasksRefresh, onTaskUpdate, onNavigateToDate,
}: {
  task: Task
  lang: 'fr' | 'en' | 'zh'
  tasks: Task[]
  onClose: () => void
  onEdit: (task: Task) => void
  onTasksRefresh: () => void | Promise<void>
  onTaskUpdate: (id: string, data: Partial<Task>) => void
  onNavigateToDate?: (date: Date, taskId?: string) => void
}) {
  const { updateTask } = useAppStore()

  // Chain root: task itself if it has children, or its parent if it has one
  const chainRoot = React.useMemo(() => {
    if (task.parentTaskId) {
      const parent = tasks.find((t) => t.id === task.parentTaskId)
      return parent ?? task
    }
    return task
  }, [task, tasks])

  const chainSiblings = React.useMemo(() => {
    return tasks.filter((t) => t.parentTaskId === chainRoot.id && t.id !== chainRoot.id)
      .sort((a, b) => {
        const da = a.deadline ? new Date(String(a.deadline)).getTime() : Infinity
        const db = b.deadline ? new Date(String(b.deadline)).getTime() : Infinity
        return da - db
      })
  }, [chainRoot, tasks])

  const allChainTasks = React.useMemo(() => {
    return [chainRoot, ...chainSiblings].sort((a, b) => {
      const da = a.deadline ? new Date(String(a.deadline)).getTime() : 0
      const db = b.deadline ? new Date(String(b.deadline)).getTime() : 0
      if (db !== da) return db - da
      // Same day: sort by title descending (Z→A / more strokes first, fewer at bottom)
      return b.title.localeCompare(a.title)
    })
  }, [chainRoot, chainSiblings])

  const hasChain = chainSiblings.length > 0 || task.parentTaskId != null

  // Link dialog state
  const [linkingChain, setLinkingChain] = React.useState(false)
  const [selectedLinkIds, setSelectedLinkIds] = React.useState<Set<string>>(new Set())
  const [linkSearch, setLinkSearch] = React.useState('')
  const [linkSaving, setLinkSaving] = React.useState(false)
  const [completing, setCompleting] = React.useState(false)
  const [chainConflictPending, setChainConflictPending] = React.useState<Task | null>(null)
  const [joinOtherChainIds, setJoinOtherChainIds] = React.useState<Set<string>>(new Set())

  const chainedTaskIds = React.useMemo(() => {
    const taskIdSet = new Set(tasks.map((t) => t.id))
    const childIds = new Set(tasks.filter((t) => t.parentTaskId && taskIdSet.has(t.parentTaskId)).map((t) => t.id))
    const validParentIds = new Set(tasks.filter((t) => t.parentTaskId && taskIdSet.has(t.parentTaskId)).map((t) => t.parentTaskId!))
    return new Set([...childIds, ...validParentIds])
  }, [tasks])

  const taskChainRootMap = React.useMemo(() => {
    const taskIdSet = new Set(tasks.map((t) => t.id))
    const map = new Map<string, string>()
    for (const t of tasks) {
      if (t.parentTaskId && taskIdSet.has(t.parentTaskId)) {
        map.set(t.id, t.parentTaskId)
      } else if (tasks.some((c) => c.parentTaskId === t.id && taskIdSet.has(c.id))) {
        map.set(t.id, t.id)
      }
    }
    return map
  }, [tasks])

  const openLinkDialog = () => {
    setLinkSearch('')
    setSelectedLinkIds(new Set([chainRoot.id, ...chainSiblings.map((s) => s.id)]))
    setLinkingChain(true)
  }

  const handleLinkTask = async () => {
    if (selectedLinkIds.size === 0 && joinOtherChainIds.size === 0) return
    setLinkSaving(true)
    try {
      if (joinOtherChainIds.size > 0) {
        const otherTaskId = [...joinOtherChainIds][0]
        const otherChainRootId = taskChainRootMap.get(otherTaskId) ?? otherTaskId
        if (chainRoot.id !== otherChainRootId) {
          await fetch(`/api/tasks/${chainRoot.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentTaskId: otherChainRootId }),
          })
        }
      } else {
        const toLink = [...selectedLinkIds].filter((id) => id !== chainRoot.id)
        await Promise.all(toLink.map((id) => fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentTaskId: chainRoot.id }),
        })))
      }
      await onTasksRefresh()
      setLinkingChain(false)
      setSelectedLinkIds(new Set())
      setJoinOtherChainIds(new Set())
      setChainConflictPending(null)
    } catch (e) { console.error('Link failed', e) } finally { setLinkSaving(false) }
  }

  const handleComplete = async () => {
    setCompleting(true)
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    onTaskUpdate(task.id, { status: newStatus })
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { const d = await res.json(); onTaskUpdate(task.id, d) }
    else onTaskUpdate(task.id, { status: task.status })
    setCompleting(false)
  }

  const handleCompleteChainTask = async (t: Task) => {
    const newStatus = t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    updateTask(t.id, { status: newStatus })
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { const d = await res.json(); updateTask(t.id, d) } else updateTask(t.id, t)
  }

  const timeLabel = React.useMemo(() => {
    if (!task.scheduledStart) return null
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB'
    const s = new Date(String(task.scheduledStart))
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
    const dayStr = s.toLocaleDateString(locale, opts)
    const startT = s.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    if (!task.scheduledEnd) return `${dayStr}  ${startT}`
    const e = new Date(String(task.scheduledEnd))
    const endT = e.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return `${dayStr}  ${startT} – ${endT}`
  }, [task.scheduledStart, task.scheduledEnd, lang])

  const done = task.status === 'COMPLETED'

  return (
    <div className="w-72 shrink-0 border-l border-[#e2d6bc] bg-[#fbf7ee] flex flex-col overflow-hidden">
      <div className="h-1 w-full shrink-0 bg-[#ab3326]" />
      <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873]">
          {lang === 'zh' ? '任務' : lang === 'fr' ? 'Tâche' : 'Task'}
        </p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873] transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {/* Title */}
        <h2 className={cn('text-sm font-semibold leading-snug', done ? 'line-through text-[#a99873]' : 'text-[#2a2420]')}>{task.title}</h2>

        {/* Time */}
        {timeLabel && (
          <div className="flex items-center gap-2 text-[#5c5347]">
            <Clock className="h-3.5 w-3.5 text-[#a99873] shrink-0" />
            <span className="text-xs">{timeLabel}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleComplete}
            disabled={completing}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border text-xs px-3 py-1.5 transition-colors',
              done ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-[#e2d6bc] text-[#5c5347] hover:bg-[#ece2cb]'
            )}
          >
            {completing ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
            {done ? (lang === 'zh' ? '取消完成' : lang === 'fr' ? 'Non fait' : 'Undo') : (lang === 'zh' ? '完成' : lang === 'fr' ? 'Terminer' : 'Complete')}
          </button>
          <button
            onClick={() => onEdit(task)}
            className="flex items-center gap-1.5 rounded-xl border border-[#e2d6bc] text-xs px-3 py-1.5 text-[#5c5347] hover:bg-[#ece2cb] transition-colors"
          >
            <Pencil className="h-3 w-3" />
            {lang === 'zh' ? '編輯' : lang === 'fr' ? 'Modifier' : 'Edit'}
          </button>
        </div>

        {/* Chain section */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873] flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            {lang === 'zh' ? '任務鏈' : lang === 'fr' ? 'Chaîne de tâches' : 'Task chain'}
          </p>

          {hasChain && (
            <div className="flex flex-col gap-1">
              {allChainTasks.map((t, i) => {
                const dl = t.deadline ? new Date(String(t.deadline)) : null
                const isDone = t.status === 'COMPLETED'
                const overdue = dl && !isDone && dl < new Date()
                const isRoot = t.id === chainRoot.id
                const isCurrent = t.id === task.id
                return (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
                      i > 0 ? 'ml-3' : '',
                      isCurrent ? 'border-red-300 bg-red-50' : isDone ? 'bg-emerald-50/60 border-emerald-100 opacity-70' : overdue ? 'bg-red-50/40 border-red-100' : 'bg-[#f3ecdd] border-[#ece2cb]',
                      dl && onNavigateToDate ? 'cursor-pointer hover:brightness-95' : ''
                    )}
                    onClick={() => dl && onNavigateToDate?.(dl, t.id)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCompleteChainTask(t) }}
                      className={cn('shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-colors', isDone ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-400' : 'border-[#c4b48a] hover:border-emerald-400')}
                    >
                      {isDone && <Check className="h-2.5 w-2.5 text-white" />}
                    </button>
                    {isRoot && <GitBranch className={cn('h-3 w-3 shrink-0', isDone ? 'text-emerald-500' : overdue ? 'text-red-500' : 'text-red-600')} />}
                    <span className={cn('truncate flex-1 font-medium', isDone ? 'line-through text-[#a99873]' : overdue ? 'text-red-700' : 'text-[#3a3326]')} title={t.title}>{t.title}</span>
                    {dl && <span className={cn('shrink-0 text-[10px]', overdue && !isDone ? 'text-red-500' : 'text-[#a99873]')}>{fmtDate(dl, lang)}</span>}
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={openLinkDialog}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-[#c4b48a] text-xs px-3 py-2 text-[#8a7a5e] hover:bg-[#f3ecdd] transition-colors w-full justify-center"
          >
            <GitBranch className="h-3.5 w-3.5" />
            {lang === 'zh' ? '連結任務' : lang === 'fr' ? 'Lier une tâche' : 'Link a task'}
          </button>
        </div>
      </div>

      {/* Link dialog */}
      {linkingChain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setLinkingChain(false); setSelectedLinkIds(new Set()); setJoinOtherChainIds(new Set()); setChainConflictPending(null) }}>
          <div className="bg-[#fbf7ee] rounded-2xl border border-[#e2d6bc] shadow-xl w-80 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#ece2cb] flex items-center justify-between">
              <p className="text-xs font-semibold text-[#3a3326]">
                {lang === 'zh' ? '連結任務' : lang === 'fr' ? 'Lier une tâche' : 'Link a task'}
              </p>
              <button onClick={() => { setLinkingChain(false); setSelectedLinkIds(new Set()); setJoinOtherChainIds(new Set()); setChainConflictPending(null) }} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="px-4 pt-2 pb-0 text-[10px] text-[#a99873]">
              {lang === 'zh' ? `將加入以「${chainRoot.title}」為根的任務鏈` : lang === 'fr' ? `Sera ajouté à la chaîne « ${chainRoot.title} »` : `Will be added to chain "${chainRoot.title}"`}
            </p>
            <div className="px-3 py-2">
              <input
                autoFocus
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder={lang === 'zh' ? '搜尋任務…' : lang === 'fr' ? 'Rechercher une tâche…' : 'Search tasks…'}
                className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white text-[#2a2420]"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5" style={{ minHeight: 0 }}>
              {tasks
                .filter((t) => t.id !== task.id)
                .filter((t) => !linkSearch || t.title.toLowerCase().includes(linkSearch.toLowerCase()))
                .sort((a, b) => {
                  const aChain = a.id === chainRoot.id || chainSiblings.some((s) => s.id === a.id)
                  const bChain = b.id === chainRoot.id || chainSiblings.some((s) => s.id === b.id)
                  if (aChain !== bChain) return aChain ? -1 : 1
                  const da = a.deadline ? new Date(String(a.deadline)).getTime() : Infinity
                  const db = b.deadline ? new Date(String(b.deadline)).getTime() : Infinity
                  return db - da
                })
                .map((t) => {
                  const selected = selectedLinkIds.has(t.id)
                  const joinOther = joinOtherChainIds.has(t.id)
                  const isCurrentChainMember = t.id === chainRoot.id || chainSiblings.some((s) => s.id === t.id)
                  const inOtherChain = chainedTaskIds.has(t.id) && !isCurrentChainMember
                  const isConflictPending = chainConflictPending?.id === t.id
                  return (
                    <div key={t.id} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => {
                          if (inOtherChain) {
                            setChainConflictPending(t)
                          } else {
                            setSelectedLinkIds((prev) => {
                              const next = new Set(prev)
                              selected ? next.delete(t.id) : next.add(t.id)
                              return next
                            })
                          }
                        }}
                        className={cn(
                          'flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left transition-colors border w-full',
                          inOtherChain
                            ? joinOther ? 'bg-blue-50 border-blue-200' : isConflictPending ? 'bg-amber-50 border-amber-200' : 'hover:bg-[#f3ecdd] border-transparent'
                            : selected ? 'bg-red-50 border-red-200' : 'hover:bg-[#f3ecdd] border-transparent'
                        )}
                      >
                        <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-red-600 border-red-600' : joinOther ? 'bg-blue-500 border-blue-500' : 'border-[#c4b48a]'}`}>
                          {(selected || joinOther) && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="truncate flex-1 text-[#3a3326]" title={t.title}>{t.title}</span>
                        {inOtherChain && !joinOther && <span className="shrink-0 text-[9px] text-[#c4b48a] bg-[#f3ecdd] rounded px-1">{lang === 'zh' ? '已在其他任務鏈' : lang === 'fr' ? 'autre chaîne' : 'other chain'}</span>}
                        {joinOther && <span className="shrink-0 text-[9px] text-blue-600 bg-blue-50 rounded px-1">{lang === 'zh' ? '加入其任務鏈' : lang === 'fr' ? 'rejoindre sa chaîne' : 'join their chain'}</span>}
                        {t.deadline && <span className="text-[#a99873] shrink-0 text-[10px]">{fmtDate(new Date(String(t.deadline)), lang)}</span>}
                      </button>
                      {isConflictPending && (
                        <div className="mx-1 mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col gap-2">
                          <p className="text-[10px] text-amber-800 leading-snug">
                            {lang === 'zh' ? `「${t.title}」已在另一個任務鏈中，請選擇：` : lang === 'fr' ? `« ${t.title} » est déjà dans une autre chaîne. Comment procéder ?` : `"${t.title}" is already in another chain. How to proceed?`}
                          </p>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => { setSelectedLinkIds((prev) => { const next = new Set(prev); next.add(t.id); return next }); setChainConflictPending(null) }}
                              className="flex-1 text-[10px] rounded-md bg-[#ab3326] text-white px-2 py-1.5 hover:bg-[#861f17] transition-colors leading-tight"
                            >
                              {lang === 'zh' ? `加入「${chainRoot.title}」` : lang === 'fr' ? `Ajouter à « ${chainRoot.title} »` : `Add to "${chainRoot.title}"`}
                            </button>
                            <button
                              onClick={() => { setJoinOtherChainIds(new Set([t.id])); setSelectedLinkIds(new Set()); setChainConflictPending(null) }}
                              className="flex-1 text-[10px] rounded-md border border-blue-300 text-blue-700 px-2 py-1.5 hover:bg-blue-50 transition-colors leading-tight"
                            >
                              {(() => {
                                const rootId = taskChainRootMap.get(t.id) ?? t.id
                                const rootTask = tasks.find((tk) => tk.id === rootId)
                                const chainName = rootTask?.title ?? t.title
                                return lang === 'zh' ? `加入「${chainName}」的鏈` : lang === 'fr' ? `Rejoindre « ${chainName} »` : `Join "${chainName}"`
                              })()}
                            </button>
                            <button onClick={() => setChainConflictPending(null)} className="text-[10px] rounded-md border border-[#e2d6bc] text-[#a99873] px-2 py-1.5 hover:bg-[#f3ecdd] transition-colors">
                              {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
            <div className="px-4 py-3 border-t border-[#ece2cb] flex gap-2">
              <button onClick={() => { setLinkingChain(false); setSelectedLinkIds(new Set()); setJoinOtherChainIds(new Set()); setChainConflictPending(null) }} className="flex-1 rounded-xl border border-[#e2d6bc] text-[#5c5347] text-xs py-2 hover:bg-[#ece2cb] transition-colors">
                {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleLinkTask}
                disabled={(selectedLinkIds.size === 0 && joinOtherChainIds.size === 0) || linkSaving}
                className="flex-1 rounded-xl bg-[#ab3326] text-white text-xs py-2 hover:bg-[#861f17] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {linkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                {lang === 'zh' ? `連結 (${selectedLinkIds.size + joinOtherChainIds.size})` : lang === 'fr' ? `Lier (${selectedLinkIds.size + joinOtherChainIds.size})` : `Link (${selectedLinkIds.size + joinOtherChainIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Event Detail Panel ───────────────────────────────────────────────────────

function EventDetailPanel({
  event, lang, saving, tasks, calendarAccounts, currentWeekEvents, onSave, onDelete, onClose, onTasksRefresh, onNavigateToDate, onMoveEvent, onToggleDone,
}: {
  event: CalendarEvent
  lang: 'fr' | 'en' | 'zh'
  saving: boolean
  tasks: Task[]
  calendarAccounts?: { id: string; name: string; color?: string; subCalendars?: { externalId: string; name: string; color?: string; isActive?: boolean }[] }[]
  currentWeekEvents: CalendarEvent[]
  onSave: (ev: CalendarEvent, title: string, start: string, end: string, allDay?: boolean, scope?: RecurrenceScope) => void
  onDelete: (ev: CalendarEvent) => void
  onToggleDone: (ev: CalendarEvent) => Promise<void>
  onClose: () => void
  onTasksRefresh: () => void | Promise<void>
  onNavigateToDate?: (date: Date, taskId?: string) => void
  onMoveEvent?: (ev: CalendarEvent, newCalendarAccountId: string, newCalendarId: string) => Promise<void>
}) {
  const router = useRouter()
  const toLocal = (d: Date | string) => {
    const dt = new Date(d)
    const offset = dt.getTimezoneOffset() * 60000
    return new Date(dt.getTime() - offset).toISOString().slice(0, 16)
  }
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [editingChainName, setEditingChainName] = React.useState(false)
  const [chainNameDraft, setChainNameDraft] = React.useState('')
  // A repeating event asks which occurrences an edit applies to; the edit waits
  // here until it is answered.
  const [pendingEdit, setPendingEdit] = React.useState<
    { title: string; start: string; end: string; allDay: boolean } | null
  >(null)
  const [title, setTitle] = React.useState(event.title)
  const [start, setStart] = React.useState(toLocal(event.start))
  const [end, setEnd] = React.useState(toLocal(event.end))
  const [isAllDay, setIsAllDay] = React.useState(!!event.allDay)
  const [renamingTaskId, setRenamingTaskId] = React.useState<string | null>(null)
  const [renameDraft, setRenameDraft] = React.useState('')
  const [calPickerOpen, setCalPickerOpen] = React.useState(false)
  const [movingCal, setMovingCal] = React.useState(false)
  const renameInputRef = React.useRef<HTMLInputElement>(null)
  const { updateTask, addTask } = useAppStore()

  const commitTaskComplete = React.useCallback(async (task: Task) => {
    const isCompleted = task.status === 'COMPLETED'
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    updateTask(task.id, { status: newStatus, completedAt: isCompleted ? null : new Date().toISOString() })
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) { const data = await res.json(); updateTask(task.id, data) }
    else updateTask(task.id, task)
  }, [updateTask])

  const commitTaskRename = React.useCallback(async (taskId: string, originalTitle: string) => {
    const trimmed = renameDraft.trim()
    setRenamingTaskId(null)
    if (!trimmed || trimmed === originalTitle) return
    updateTask(taskId, { title: trimmed })
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (res.ok) { const data = await res.json(); updateTask(taskId, data) }
    else updateTask(taskId, { title: originalTitle })
  }, [renameDraft, updateTask])

  /**
   * Saves whatever the panel currently shows. Called when a field is left, the
   * way Notion Calendar does it, so there is no Save button to forget. An edit
   * to a repeating event stops here and waits for the scope answer instead.
   */
  const commit = React.useCallback((next: Partial<{ title: string; start: string; end: string; allDay: boolean }>) => {
    if (!event.editable) return
    const merged = {
      title: (next.title ?? title).trim() || event.title,
      start: next.start ?? start,
      end: next.end ?? end,
      allDay: next.allDay ?? isAllDay,
    }
    const unchanged =
      merged.title === event.title &&
      merged.start === toLocal(event.start) &&
      merged.end === toLocal(event.end) &&
      merged.allDay === !!event.allDay
    if (unchanged) return
    if (event.recurringEventId) { setPendingEdit(merged); return }
    onSave(event, merged.title, new Date(merged.start).toISOString(), new Date(merged.end).toISOString(), merged.allDay, 'single')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, title, start, end, isAllDay, onSave])

  /** Puts the panel back to what the server holds — used when a scope prompt is dismissed. */
  const resetDraft = React.useCallback(() => {
    setTitle(event.title)
    setStart(toLocal(event.start))
    setEnd(toLocal(event.end))
    setIsAllDay(!!event.allDay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  React.useEffect(() => {
    setEditingTitle(false)
    setEditingChainName(false)
    setPendingEdit(null)
    setTitle(event.title)
    setStart(toLocal(event.start))
    setEnd(toLocal(event.end))
    setIsAllDay(!!event.allDay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  // Tasks directly linked to this calendar event
  const directlyLinkedTasks = React.useMemo(
    () => tasks.filter((t) => t.calendarEventId === event.id),
    [tasks, event.id]
  )
  const [togglingDone, setTogglingDone] = React.useState(false)
  const eventDone = taskForEvent(tasks, event.id)?.status === 'COMPLETED'
  // Find the chain parent: task linked directly or parent of a linked sub-task
  const chainParent = React.useMemo(() => {
    const direct = directlyLinkedTasks.find((t) => !t.parentTaskId)
    if (direct) return direct
    const sub = directlyLinkedTasks.find((t) => t.parentTaskId)
    return sub ? tasks.find((t) => t.id === sub.parentTaskId) ?? null : null
  }, [directlyLinkedTasks, tasks])
  const chainSiblings = React.useMemo(() => {
    if (!chainParent) return []
    const seenIds = new Set<string>([chainParent.id])
    const byParent = tasks.filter((t) => t.parentTaskId === chainParent.id && t.id !== chainParent.id)
    const directExtras = directlyLinkedTasks.filter((t) => t.id !== chainParent.id && !byParent.some((s) => s.id === t.id))
    return [...byParent, ...directExtras]
      .filter((t) => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true })
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return a.title.localeCompare(b.title)
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        const da = new Date(String(a.deadline)).getTime()
        const db = new Date(String(b.deadline)).getTime()
        if (da !== db) return da - db
        return a.title.localeCompare(b.title)
      })
  }, [chainParent, tasks, directlyLinkedTasks])
  // All chain tasks sorted by deadline descending (latest first) — for display only
  const allChainTasksSorted = React.useMemo(() => {
    if (!chainParent) return []
    return [chainParent, ...chainSiblings].sort((a, b) => {
      const da = a.deadline ? new Date(String(a.deadline)).getTime() : 0
      const db = b.deadline ? new Date(String(b.deadline)).getTime() : 0
      if (db !== da) return db - da
      // Same day: sort by title descending (Z→A / more strokes first, fewer at bottom)
      return b.title.localeCompare(a.title)
    })
  }, [chainParent, chainSiblings])

  /** Saves the chain's name onto its head task; blank clears it. */
  const commitChainName = React.useCallback(async () => {
    setEditingChainName(false)
    if (!chainParent) return
    const next = chainNameDraft.trim()
    if (next === (chainParent.chainName ?? '')) return
    updateTask(chainParent.id, { chainName: next || null })
    const res = await fetch(`/api/tasks/${chainParent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainName: next || null }),
    })
    if (res.ok) updateTask(chainParent.id, await res.json())
    else updateTask(chainParent.id, { chainName: chainParent.chainName ?? null })
  }, [chainParent, chainNameDraft, updateTask])

  // Fallback: fuzzy title match for old tasks not linked via calendarEventId
  const relatedChains = React.useMemo(() => {
    if (chainParent) return []
    const words = event.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    return tasks.filter((t) => t.parentTaskId && words.some((w) => t.title.toLowerCase().includes(w)))
  }, [event.title, tasks, chainParent])

  const [linkingChain, setLinkingChain] = React.useState(false)
  // selectedLinkIds now stores calendarEvent IDs (not task IDs)
  const [selectedLinkIds, setSelectedLinkIds] = React.useState<Set<string>>(new Set())
  const [linkSaving, setLinkSaving] = React.useState(false)
  const [linkSearch, setLinkSearch] = React.useState('')
  const [linkCalEvents, setLinkCalEvents] = React.useState<CalendarEvent[]>([])
  const [linkEventsLoading, setLinkEventsLoading] = React.useState(false)
  const linkCalEventsFetchedRef = React.useRef(false)
  // Bounds of the completed 4-year fetch — used to filter stale tasks
  const linkFetchBoundsRef = React.useRef<{ start: Date; end: Date } | null>(null)
  // Chain conflict: task in another chain that the user just clicked
  const [chainConflictPending, setChainConflictPending] = React.useState<Task | null>(null)
  // Tasks where user chose "join their chain" (current event joins that chain instead)
  const [joinOtherChainIds, setJoinOtherChainIds] = React.useState<Set<string>>(new Set())

  // Relevance: count event-title chars found in task title (higher = more relevant)
  const relevanceScore = React.useCallback((taskTitle: string): number => {
    const evChars = new Set(event.title.toLowerCase().replace(/\s/g, '').split(''))
    let score = 0
    for (const c of taskTitle.toLowerCase().replace(/\s/g, '').split('')) {
      if (evChars.has(c)) score++
    }
    return score
  }, [event.title])

  // Keywords extracted from event title (tokens > 2 chars, ignoring separators)
  const eventKeywords = React.useMemo(
    () => event.title.toLowerCase().split(/[\s|:,\-]+/).filter((w) => w.length > 2),
    [event.title]
  )

  // Tasks visibly in a chain: parentTaskId points to an existing task (no orphans)
  const chainedTaskIds = React.useMemo(() => {
    const taskIdSet = new Set(tasks.map((t) => t.id))
    // A task is "truly chained" if its parentTaskId exists in the task list
    const childIds = new Set(tasks.filter((t) => t.parentTaskId && taskIdSet.has(t.parentTaskId)).map((t) => t.id))
    // Parents = tasks that are pointed to by at least one valid child
    const validParentIds = new Set(tasks.filter((t) => t.parentTaskId && taskIdSet.has(t.parentTaskId)).map((t) => t.parentTaskId!))
    return new Set([...childIds, ...validParentIds])
  }, [tasks])

  // Map from taskId → chain root task ID (for resolving which chain a task belongs to)
  const taskChainRootMap = React.useMemo(() => {
    const taskIdSet = new Set(tasks.map((t) => t.id))
    const map = new Map<string, string>()
    for (const t of tasks) {
      if (t.parentTaskId && taskIdSet.has(t.parentTaskId)) {
        map.set(t.id, t.parentTaskId)
      } else if (tasks.some((c) => c.parentTaskId === t.id && taskIdSet.has(c.id))) {
        map.set(t.id, t.id)
      }
    }
    return map
  }, [tasks])

  const openLinkDialog = () => {
    setLinkSearch('')
    // Pre-select current chain members by task ID (immediate — from store, no network needed)
    setSelectedLinkIds(new Set<string>([
      ...(chainParent ? [chainParent.id] : []),
      ...chainSiblings.map((s) => s.id),
    ]))
    setLinkingChain(true)
    // Immediately seed linkCalEvents with the current week's already-fetched events
    // so the user can search them without waiting for the background fetch
    setLinkCalEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id))
      const merged = [...prev]
      currentWeekEvents.forEach((e) => { if (!existingIds.has(e.id)) merged.push(e) })
      return merged
    })
    // Always refresh tasks immediately so the task list is populated right away
    onTasksRefresh()

    // Only do the expensive 4-year calendar fetch once per page session
    if (linkCalEventsFetchedRef.current) return
    linkCalEventsFetchedRef.current = true
    setLinkEventsLoading(true)
    const start = new Date(); start.setFullYear(start.getFullYear() - 2)
    const end = new Date(); end.setFullYear(end.getFullYear() + 2)
    fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}&noSync=true`)
      .then(async (evRes) => {
        if (evRes.ok) {
          const fresh: CalendarEvent[] = await evRes.json()
          linkFetchBoundsRef.current = { start, end }
          setLinkCalEvents((prev) => {
            const freshIds = new Set(fresh.map((e) => e.id))
            const extras = prev.filter((e) => !freshIds.has(e.id))
            return [...fresh, ...extras]
          })
        }
      })
      .catch(() => { /* calendar events section stays with previous data */ })
      .finally(() => { setLinkEventsLoading(false) })
  }

  const handleUnlinkFromChain = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentTaskId: null }),
    })
    if (res.ok) {
      onTasksRefresh()
    } else {
      console.error('Failed to unlink task from chain', await res.text())
    }
  }

  const handleLinkTask = async () => {
    if (selectedLinkIds.size === 0 && joinOtherChainIds.size === 0) return
    setLinkSaving(true)
    try {
      // Handle "join other chain" tasks: add current event's task into the other chain
      if (joinOtherChainIds.size > 0) {
        // Take the first one (UI only allows selecting one at a time)
        const otherTaskId = [...joinOtherChainIds][0]
        const otherChainRootId = taskChainRootMap.get(otherTaskId) ?? otherTaskId
        // Ensure current event has a task; if not, create one
        let currentTaskId = chainParent?.id ?? directlyLinkedTasks[0]?.id
        if (!currentTaskId) {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: event.title,
              calendarEventId: event.id,
              calendarAccountId: event.calendarAccountId,
              deadline: event.allDay ? new Date(event.start).toISOString() : new Date(event.end).toISOString(),
            }),
          })
          if (res.ok) { const t = await res.json(); addTask(t); currentTaskId = t.id }
        }
        if (currentTaskId && currentTaskId !== otherChainRootId) {
          await fetch(`/api/tasks/${currentTaskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentTaskId: otherChainRootId }),
          })
        }
        onTasksRefresh()
        setLinkingChain(false)
        setSelectedLinkIds(new Set())
        setJoinOtherChainIds(new Set())
        return
      }

      // selectedLinkIds may contain task IDs OR calendar event IDs (for events without tasks).
      // Resolve everything to task IDs, auto-creating tasks for event-only selections.
      const resolved = await Promise.all([...selectedLinkIds].map(async (id): Promise<string | null> => {
        // Known task ID
        if (tasks.find((t) => t.id === id)) return id
        // Task already linked to this event ID
        const taskWithEvent = tasks.find((t) => t.calendarEventId === id)
        if (taskWithEvent) return taskWithEvent.id
        // Calendar event without a task — auto-create
        const calEv = linkCalEvents.find((e) => e.id === id)
        if (!calEv) return null
        const deadline = calEv.allDay ? calEv.start : calEv.end
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: calEv.title,
            calendarEventId: id,
            calendarAccountId: calEv.calendarAccountId,
            deadline: deadline ? new Date(deadline).toISOString() : undefined,
          }),
        })
        if (!res.ok) return null
        const t = await res.json()
        // Server may return an existing task (200) if calendarEventId already linked — update store either way
        addTask(t)
        return t.id as string
      }))
      const resolvedTaskIds = resolved.filter((id): id is string => !!id)

      if (chainParent) {
        await Promise.all(resolvedTaskIds
          .filter((id) => id !== chainParent.id)
          .map((id) => fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentTaskId: chainParent.id }),
          }))
        )
      } else {
        // Task with latest deadline becomes the chain root
        const allResolved = resolvedTaskIds
          .map((id) => tasks.find((t) => t.id === id))
          .filter((t): t is Task => !!t)
        allResolved.sort((a, b) => {
          const da = a.deadline ? new Date(String(a.deadline)).getTime() : 0
          const db = b.deadline ? new Date(String(b.deadline)).getTime() : 0
          return db - da
        })
        const rootId = allResolved[0]?.id ?? resolvedTaskIds[0]
        const childIds = resolvedTaskIds.filter((id) => id !== rootId)
        await fetch(`/api/tasks/${rootId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarEventId: event.id }),
        })
        if (childIds.length > 0) {
          await Promise.all(childIds.map((id) => fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentTaskId: rootId }),
          })))
        }
      }
      onTasksRefresh()
      setLinkingChain(false)
      setSelectedLinkIds(new Set())
      setJoinOtherChainIds(new Set())
    } catch (e) { console.error('Link failed', e) } finally { setLinkSaving(false) }
  }

  const links = React.useMemo(() => {
    if (!event.description) return []
    const urlRe = /https?:\/\/[^\s<>"]+/g
    return Array.from(new Set(event.description.match(urlRe) ?? []))
  }, [event.description])

  const evColor = event.color ?? '#ab3326'

  const dateLabel = React.useMemo(() => {
    const s = new Date(event.start)
    const e = new Date(event.end)
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB'
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
    if (event.allDay) return s.toLocaleDateString(locale, opts)
    const sameDay = s.toDateString() === e.toDateString()
    const dayStr = s.toLocaleDateString(locale, opts)
    const startT = s.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    const endT = e.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return sameDay ? `${dayStr}  ${startT} – ${endT}` : `${dayStr} ${startT} – ${e.toLocaleDateString(locale, opts)} ${endT}`
  }, [event.start, event.end, event.allDay, lang])

  return (
    <div className="w-72 shrink-0 border-l border-[#e2d6bc] bg-[#fbf7ee] flex flex-col overflow-hidden">
      {/* Color bar + header */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: evColor }} />
      <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873]">
          {lang === 'fr' ? 'Événement' : lang === 'zh' ? '活動' : 'Event'}
        </p>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873] transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {/* Title — click to edit, leaving the field saves it */}
        {editingTitle && event.editable ? (
          <input
            autoFocus
            className="w-full border border-[#cba968] rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30 bg-white text-[#2a2420]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { setEditingTitle(false); commit({ title }) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
              if (e.key === 'Escape') { setTitle(event.title); setEditingTitle(false) }
            }}
          />
        ) : (
          <h2
            onClick={() => event.editable && setEditingTitle(true)}
            title={event.editable ? (lang === 'fr' ? 'Cliquer pour modifier' : lang === 'zh' ? '點擊即可編輯' : 'Click to edit') : undefined}
            className={cn(
              'text-sm font-semibold leading-snug rounded-xl -mx-1 px-1 py-0.5 transition-colors',
              event.editable && 'cursor-text hover:bg-[#f3ecdd]',
              eventDone ? 'line-through text-[#8a7a5e]' : 'text-[#2a2420]'
            )}
          >
            {event.title}
          </h2>
        )}

        {/* Done toggle — writes to the task the sync keeps for this event */}
        {!event.habitId && (
          <button
            onClick={async () => {
              if (togglingDone) return
              setTogglingDone(true)
              try { await onToggleDone(event) } finally { setTogglingDone(false) }
            }}
            disabled={togglingDone}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors w-full disabled:opacity-60',
              eventDone
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-[#e2d6bc] bg-[#f3ecdd]/60 text-[#5c5347] hover:bg-[#f3ecdd] hover:border-[#cba968]'
            )}
          >
            {togglingDone
              ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              : eventDone
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                : <Circle className="h-3.5 w-3.5 shrink-0 text-[#c4b48a]" />}
            {eventDone
              ? (lang === 'fr' ? 'Terminé' : lang === 'zh' ? '已完成' : 'Done')
              : (lang === 'fr' ? 'Marquer comme terminé' : lang === 'zh' ? '標為完成' : 'Mark as done')}
          </button>
        )}

        {/* Date / time — Notion-style always-visible inline editor */}
        <div className="flex flex-col gap-1.5">
          {/* Date row: start → end */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={start.slice(0, 10)}
              onChange={(e) => setStart(e.target.value + (isAllDay ? 'T00:00' : 'T' + (start.slice(11) || '09:00')))}
              onBlur={() => commit({})}
              disabled={!event.editable}
              className="flex-1 min-w-0 text-xs bg-[#f3ecdd]/60 border border-[#e2d6bc] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30 text-[#3a3326] cursor-pointer disabled:opacity-60 disabled:cursor-default"
            />
            <ChevronRight className="h-3 w-3 text-[#c4b48a] shrink-0" />
            <input
              type="date"
              value={end.slice(0, 10)}
              onChange={(e) => setEnd(e.target.value + (isAllDay ? 'T00:00' : 'T' + (end.slice(11) || '10:00')))}
              onBlur={() => commit({})}
              disabled={!event.editable}
              className="flex-1 min-w-0 text-xs bg-[#f3ecdd]/60 border border-[#e2d6bc] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30 text-[#3a3326] cursor-pointer disabled:opacity-60 disabled:cursor-default"
            />
          </div>
          {/* Time row (hidden for all-day) */}
          {!isAllDay && (
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={start.slice(11) || ''}
                onChange={(e) => setStart(start.slice(0, 10) + 'T' + e.target.value)}
                onBlur={() => commit({})}
                disabled={!event.editable}
                className="flex-1 min-w-0 text-xs bg-[#f3ecdd]/60 border border-[#e2d6bc] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30 text-[#3a3326] disabled:opacity-60 disabled:cursor-default"
              />
              <ChevronRight className="h-3 w-3 text-[#c4b48a] shrink-0" />
              <input
                type="time"
                value={end.slice(11) || ''}
                onChange={(e) => setEnd(end.slice(0, 10) + 'T' + e.target.value)}
                onBlur={() => commit({})}
                disabled={!event.editable}
                className="flex-1 min-w-0 text-xs bg-[#f3ecdd]/60 border border-[#e2d6bc] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30 text-[#3a3326] disabled:opacity-60 disabled:cursor-default"
              />
            </div>
          )}
          {/* All-day toggle */}
          <button
            onClick={() => { if (!event.editable) return; const next = !isAllDay; setIsAllDay(next); commit({ allDay: next }) }}
            disabled={!event.editable}
            className="flex items-center gap-2 text-xs text-[#8a7a5e] hover:text-[#3a3326] mt-0.5 w-fit transition-colors disabled:opacity-60 disabled:cursor-default"
          >
            <div className={`w-7 h-3.5 rounded-full relative transition-colors ${isAllDay ? 'bg-[#ab3326]' : 'bg-[#d9c79f]'}`}>
              <div className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${isAllDay ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </div>
            {lang === 'fr' ? 'Toute la journée' : lang === 'zh' ? '整天' : 'All day'}
          </button>
        </div>

        {/* Calendar account + sub-calendar (clickable to change) */}
        {event.calendarAccountId && (() => {
          const account = calendarAccounts?.find((a) => a.id === event.calendarAccountId)
          if (!account) return null
          const subCal = account.subCalendars?.find((sc) => sc.externalId === event.calendarId)
          const subCalLabel = subCal?.name ?? (lang === 'fr' ? 'Principal' : lang === 'zh' ? '主日曆' : 'Primary')
          const subCalColor = subCal?.color ?? account.color ?? '#4285F4'
          const canEdit = !!event.editable && !!onMoveEvent && (calendarAccounts?.length ?? 0) > 0
          return (
            <div className="relative">
              <button
                disabled={!canEdit || movingCal}
                onClick={() => canEdit && setCalPickerOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-2 text-xs text-[#5c5347] text-left w-full rounded-md px-2 py-1.5 -mx-2 transition-colors',
                  canEdit && 'hover:bg-[#f3ecdd] cursor-pointer',
                  !canEdit && 'cursor-default',
                  calPickerOpen && 'bg-[#f3ecdd]'
                )}
              >
                <Calendar className="h-3.5 w-3.5 text-[#a99873] shrink-0" />
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[#8a7a5e] truncate">{account.name}</span>
                  <span className="text-[#c0b090] shrink-0">›</span>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: subCalColor }}
                  />
                  <span className="font-medium text-[#2a2420] truncate">{subCalLabel}</span>
                </div>
                {movingCal
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#a99873] shrink-0" />
                  : canEdit && <ChevronDown className="h-3.5 w-3.5 text-[#c0b090] shrink-0" />
                }
              </button>

              {calPickerOpen && canEdit && (
                <>
                  {/* backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setCalPickerOpen(false)} />
                  {/* dropdown */}
                  <div className="absolute left-0 top-full mt-1 z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-[#e8ddc8] bg-white shadow-xl">
                    <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[#a99873]">
                      {lang === 'fr' ? 'Choisir un calendrier' : lang === 'zh' ? '選擇日曆' : 'Choose calendar'}
                    </div>
                    {calendarAccounts!.map((acc) => {
                      const allSubCals = acc.subCalendars ?? []
                      const subCals = allSubCals.filter((sc) => sc.isActive === true)
                      const primaryLabel = lang === 'fr' ? 'Principal' : lang === 'zh' ? '主日曆' : 'Primary'
                      // If the account has DB records but none are active, hide the whole section
                      const showPrimary = allSubCals.length === 0
                      if (!showPrimary && subCals.length === 0) return null
                      return (
                        <div key={acc.id} className="px-2 py-1">
                          <div className="px-2 py-1 text-[10px] font-semibold text-[#a99873] truncate">{acc.name}</div>
                          {subCals.length > 0
                            ? subCals.map((sc) => {
                                const isCurrent = acc.id === event.calendarAccountId && sc.externalId === (event.calendarId ?? 'primary')
                                return (
                                  <button
                                    key={sc.externalId}
                                    className={cn(
                                      'w-full flex items-center gap-2.5 text-left text-sm px-2 py-1.5 rounded-lg transition-colors',
                                      isCurrent ? 'bg-[#f3ecdd] text-[#2a2420]' : 'hover:bg-[#f9f5ee] text-[#3c3530]'
                                    )}
                                    onClick={async () => {
                                      if (isCurrent) { setCalPickerOpen(false); return }
                                      setCalPickerOpen(false)
                                      setMovingCal(true)
                                      await onMoveEvent!(event, acc.id, sc.externalId)
                                      setMovingCal(false)
                                    }}
                                  >
                                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: sc.color ?? acc.color ?? '#4285F4' }} />
                                    <span className="truncate">{sc.name}</span>
                                    {isCurrent && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-[#ab3326]" />}
                                  </button>
                                )
                              })
                            : (() => {
                                const isCurrent = acc.id === event.calendarAccountId && (event.calendarId ?? 'primary') === 'primary'
                                return (
                                  <button
                                    className={cn(
                                      'w-full flex items-center gap-2.5 text-left text-sm px-2 py-1.5 rounded-lg transition-colors',
                                      isCurrent ? 'bg-[#f3ecdd] text-[#2a2420]' : 'hover:bg-[#f9f5ee] text-[#3c3530]'
                                    )}
                                    onClick={async () => {
                                      if (isCurrent) { setCalPickerOpen(false); return }
                                      setCalPickerOpen(false)
                                      setMovingCal(true)
                                      await onMoveEvent!(event, acc.id, 'primary')
                                      setMovingCal(false)
                                    }}
                                  >
                                    <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: acc.color ?? '#4285F4' }} />
                                    <span className="truncate">{primaryLabel}</span>
                                    {isCurrent && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-[#ab3326]" />}
                                  </button>
                                )
                              })()
                          }
                        </div>
                      )
                    })}
                    <div className="h-2" />
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Location */}
        {event.location && (
          <div className="flex items-start gap-2 text-[#5c5347]">
            <MapPin className="h-3.5 w-3.5 text-[#a99873] shrink-0 mt-0.5" />
            <span className="text-xs break-words">{event.location}</span>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873]">
              {lang === 'fr' ? 'Description' : lang === 'zh' ? '說明' : 'Description'}
            </p>
            <p className="text-xs text-[#5c5347] leading-relaxed whitespace-pre-wrap break-words">{event.description}</p>
          </div>
        )}

        {/* Links */}
        {links.length > 0 && (
          <div className="flex flex-col gap-1">
            {links.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#ab3326] hover:underline truncate">
                <ExternalLink className="h-3 w-3 shrink-0" />
                {url.replace(/^https?:\/\//, '').split('/')[0]}
              </a>
            ))}
          </div>
        )}

        {/* Open in Google Calendar */}
        {event.htmlLink && (
          <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[#8a7a5e] hover:text-[#ab3326] transition-colors">
            <ExternalLink className="h-3 w-3 shrink-0" />
            {lang === 'fr' ? 'Ouvrir dans Google Calendar' : lang === 'zh' ? '在 Google 日曆中開啟' : 'Open in Google Calendar'}
          </a>
        )}

        {/* Task chain section */}
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873] flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            {lang === 'fr' ? 'Chaîne de tâches' : lang === 'zh' ? '任務鏈' : 'Task chain'}
          </p>

          {/* The chain can carry its own name — click to give it one. It is kept
              on the head task, so replacing the head does not lose it. */}
          {chainParent && (
            editingChainName ? (
              <input
                autoFocus
                value={chainNameDraft}
                onChange={(e) => setChainNameDraft(e.target.value)}
                onBlur={() => commitChainName()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                  if (e.key === 'Escape') { setChainNameDraft(chainParent.chainName ?? ''); setEditingChainName(false) }
                }}
                placeholder={lang === 'fr' ? 'Nom de la chaîne' : lang === 'zh' ? '任務鏈名稱' : 'Chain name'}
                className="w-full border border-[#cba968] rounded-lg px-2 py-1 text-xs bg-white text-[#2a2420] focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30"
              />
            ) : (
              <button
                onClick={() => { setChainNameDraft(chainParent.chainName ?? ''); setEditingChainName(true) }}
                className="text-left text-xs rounded-lg -mx-1 px-1 py-0.5 hover:bg-[#f3ecdd] transition-colors w-fit max-w-full truncate"
              >
                {chainParent.chainName
                  ? <span className="font-medium text-[#3a3326]">{chainParent.chainName}</span>
                  : <span className="text-[#c4b48a]">{lang === 'fr' ? '+ Nommer la chaîne' : lang === 'zh' ? '＋ 為任務鏈命名' : '+ Name this chain'}</span>}
              </button>
            )
          )}

          {/* Show chain when there's any linked task or related chain */}
          {(chainParent || relatedChains.length > 0) && (
            <div className="flex flex-col gap-1">
              {chainParent ? (
                <>
                  {(() => {
                    const p = allChainTasksSorted[0] ?? chainParent
                    const dl = p.deadline ? new Date(String(p.deadline)) : null
                    const displayDate = dl ?? (p.createdAt ? new Date(String(p.createdAt)) : null)
                    const done = p.status === 'COMPLETED'
                    const now = new Date(); now.setHours(0,0,0,0)
                    const dlDay = dl ? new Date(dl.getTime()) : null; if (dlDay) dlDay.setHours(0,0,0,0)
                    const isToday = dl && dlDay?.getTime() === now.getTime()
                    const overdue = dl && !done && dl < new Date()
                    const navigateTo = dl ?? (p.createdAt ? new Date(String(p.createdAt)) : null)
                    return (
                      <div
                        className={cn(
                          'flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border transition-colors',
                          done ? 'bg-emerald-50 border-emerald-200 opacity-70' : isToday ? 'bg-amber-50 border-amber-300' : overdue ? 'bg-red-50/60 border-red-200' : 'bg-red-50 border-red-200',
                          navigateTo && onNavigateToDate ? 'cursor-pointer hover:brightness-95' : ''
                        )}
                        onClick={() => navigateTo && onNavigateToDate?.(navigateTo, p.id)}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); commitTaskComplete(p) }}
                          className={cn('shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-colors', done ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-400' : 'border-[#c4b48a] hover:border-emerald-400 hover:bg-emerald-50')}
                          title={done ? (lang === 'zh' ? '標記未完成' : lang === 'fr' ? 'Marquer non fait' : 'Mark undone') : (lang === 'zh' ? '標記完成' : lang === 'fr' ? 'Marquer fait' : 'Mark done')}
                        >
                          {done && <Check className="h-2.5 w-2.5 text-white" />}
                        </button>
                        <GitBranch className={cn('h-3 w-3 shrink-0', done ? 'text-emerald-500' : overdue ? 'text-red-500' : 'text-red-600')} />
                        {renamingTaskId === p.id ? (
                          <input
                            ref={renameInputRef}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => commitTaskRename(p.id, p.title)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); renameInputRef.current?.blur() }
                              if (e.key === 'Escape') { setRenamingTaskId(null) }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 font-medium text-xs bg-white border border-red-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-red-400"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={cn('truncate flex-1 font-medium cursor-text', done ? 'line-through text-[#a99873]' : overdue ? 'text-red-700' : isToday ? 'text-amber-800' : 'text-[#3a3326]')}
                            onDoubleClick={(e) => { e.stopPropagation(); setRenameDraft(p.title); setRenamingTaskId(p.id) }}
                            title={p.title}
                          >
                            {p.title}
                          </span>
                        )}
                        {displayDate && (
                          <span className={cn('shrink-0 text-[10px] flex items-center gap-0.5', done ? 'text-emerald-600' : overdue ? 'text-red-500' : isToday ? 'text-amber-700' : dl ? 'text-red-500' : 'text-[#a99873]')}>
                            {overdue && !done && <AlertTriangle className="h-2.5 w-2.5" />}
                            {fmtDate(displayDate, lang)}
                            {onNavigateToDate && <ChevronRight className="h-2.5 w-2.5" />}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                  {allChainTasksSorted.slice(1).map((t) => {
                    const dl = t.deadline ? new Date(String(t.deadline)) : null
                    const displayDate = dl ?? (t.createdAt ? new Date(String(t.createdAt)) : null)
                    const done = t.status === 'COMPLETED'
                    const now = new Date(); now.setHours(0,0,0,0)
                    const dlDay = dl ? new Date(dl.getTime()) : null; if (dlDay) dlDay.setHours(0,0,0,0)
                    const isToday = dl && dlDay?.getTime() === now.getTime()
                    const overdue = dl && !done && dl < new Date()
                    const navigateTo = dl ?? displayDate
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'group flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 border ml-3 transition-colors',
                          done ? 'bg-emerald-50/60 border-emerald-100 opacity-70' : isToday ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' : overdue ? 'bg-red-50/40 border-red-100 hover:bg-red-50' : 'bg-[#f3ecdd] border-[#ece2cb] hover:bg-[#ece2cb]'
                        )}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); commitTaskComplete(t) }}
                          className={cn('shrink-0 h-4 w-4 rounded-full border flex items-center justify-center transition-colors', done ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-400' : 'border-[#c4b48a] hover:border-emerald-400 hover:bg-emerald-50')}
                          title={done ? (lang === 'zh' ? '標記未完成' : lang === 'fr' ? 'Marquer non fait' : 'Mark undone') : (lang === 'zh' ? '標記完成' : lang === 'fr' ? 'Marquer fait' : 'Mark done')}
                        >
                          {done && <Check className="h-2.5 w-2.5 text-white" />}
                        </button>
                        {renamingTaskId === t.id ? (
                          <input
                            ref={renameInputRef}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={() => commitTaskRename(t.id, t.title)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); renameInputRef.current?.blur() }
                              if (e.key === 'Escape') { setRenamingTaskId(null) }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 min-w-0 text-xs bg-white border border-red-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-red-400"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={cn(
                              'truncate flex-1 cursor-text',
                              done ? 'line-through text-[#a99873]' : overdue ? 'text-red-700' : isToday ? 'text-amber-800' : t.calendarEventId === event.id ? 'text-[#ab3326] font-medium' : 'text-[#3a3326]',
                            )}
                            onDoubleClick={(e) => { e.stopPropagation(); setRenameDraft(t.title); setRenamingTaskId(t.id) }}
                            onClick={() => navigateTo && onNavigateToDate?.(navigateTo, t.id)}
                            title={t.title}
                          >
                            {t.title}
                          </span>
                        )}
                        {displayDate && (
                          <span
                            className={cn('shrink-0 text-[10px] flex items-center gap-0.5 cursor-pointer', done ? 'text-emerald-600' : overdue ? 'text-red-500' : isToday ? 'text-amber-600' : dl ? 'text-[#a99873]' : 'text-[#c4b48a]')}
                            onClick={() => navigateTo && onNavigateToDate?.(navigateTo, t.id)}
                          >
                            {overdue && !done && <AlertTriangle className="h-2.5 w-2.5" />}
                            {fmtDate(displayDate, lang)}
                            {onNavigateToDate && <ChevronRight className="h-2.5 w-2.5" />}
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnlinkFromChain(t.id) }}
                          className="shrink-0 p-0.5 rounded hover:bg-red-100 hover:text-red-500 text-[#c4b48a] transition-all"
                          title={lang === 'fr' ? 'Retirer de la chaîne' : lang === 'zh' ? '從任務練移除' : 'Remove from chain'}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </>
              ) : (
                relatedChains.map((t) => (
                  <div
                    key={t.id}
                    className={cn('flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 bg-[#f3ecdd] border border-[#ece2cb]', t.deadline && onNavigateToDate ? 'cursor-pointer hover:bg-[#ece2cb] transition-colors' : '')}
                    onClick={() => t.deadline && onNavigateToDate?.(new Date(String(t.deadline)))}
                  >
                    <span className="text-[#3a3326] truncate flex-1" title={t.title}>{t.title}</span>
                    {t.deadline && (
                      <span className="text-[#a99873] ml-2 shrink-0 text-[10px] flex items-center gap-0.5">
                        {fmtDate(new Date(t.deadline), lang)}
                        {onNavigateToDate && <ChevronRight className="h-2.5 w-2.5" />}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Link button */}
          <button
            onClick={openLinkDialog}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-[#8a7a5e] hover:text-[#ab3326] border border-dashed border-[#e2d6bc] rounded-lg px-3 py-2 hover:border-red-300 transition-colors"
          >
            <GitBranch className="h-3 w-3" />
            {lang === 'fr' ? 'Lier une tâche' : lang === 'zh' ? '連結任務' : 'Link task'}
          </button>
        </div>

        {/* Link task dialog */}
        {linkingChain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setLinkingChain(false); setSelectedLinkIds(new Set()); setJoinOtherChainIds(new Set()); setChainConflictPending(null) }}>
            <div className="bg-[#fbf7ee] rounded-2xl border border-[#e2d6bc] shadow-xl w-80 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-[#ece2cb] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a2420]">
                  {lang === 'zh' ? '連結任務' : lang === 'fr' ? 'Lier une tâche' : 'Link a task'}
                </p>
                <button onClick={() => { setLinkingChain(false); setSelectedLinkIds(new Set()); setJoinOtherChainIds(new Set()); setChainConflictPending(null) }} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {chainParent && (
                <p className="px-4 pt-2 text-[11px] text-[#8a7a5e]">
                  {lang === 'fr' ? `Sera ajouté à la chaîne « ${(allChainTasksSorted[0] ?? chainParent).title} »` : lang === 'zh' ? `將加入任務練「${(allChainTasksSorted[0] ?? chainParent).title}」` : `Will be added to chain "${(allChainTasksSorted[0] ?? chainParent).title}"`}
                </p>
              )}
              <div className="px-4 py-2 border-b border-[#ece2cb]">
                <input
                  autoFocus
                  className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  placeholder={lang === 'zh' ? '搜尋行事曆事件...' : lang === 'fr' ? 'Rechercher un événement...' : 'Search calendar events...'}
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
              </div>
              {/* Prefix suggestion: tasks/events sharing the same prefix as this event */}
              {(() => {
                const sep = event.title.includes('｜') ? '｜' : event.title.includes('|') ? '|' : null
                const eventPrefix = sep ? event.title.split(sep)[0].trim() : null
                if (!eventPrefix || eventPrefix.length < 2) return null
                const prefixLower = eventPrefix.toLowerCase()
                const matchingTaskIds = tasks
                  .filter((t) => {
                    if (t.id === chainParent?.id || chainSiblings.some((s) => s.id === t.id)) return false
                    return t.title.toLowerCase().startsWith(prefixLower)
                  })
                  .map((t) => t.id)
                const matchingCalEventIds = linkCalEvents
                  .filter((ev) => {
                    if (ev.id === event.id) return false
                    if (tasks.some((t) => t.calendarEventId === ev.id)) return false
                    return ev.title.toLowerCase().startsWith(prefixLower)
                  })
                  .map((ev) => ev.id)
                const total = matchingTaskIds.length + matchingCalEventIds.length
                if (total === 0) return null
                const allSelected = [...matchingTaskIds, ...matchingCalEventIds].every((id) => selectedLinkIds.has(id))
                return (
                  <div className="mx-2 mt-1 mb-0.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                    <GitBranch className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="flex-1 text-[11px] text-amber-800">
                      {lang === 'zh'
                        ? `找到 ${total} 個「${eventPrefix}」前綴的事件`
                        : lang === 'fr'
                        ? `${total} événement(s) avec le préfixe « ${eventPrefix} »`
                        : `${total} event(s) share prefix "${eventPrefix}"`}
                    </span>
                    <button
                      onClick={() => setSelectedLinkIds((prev) => {
                        const next = new Set(prev)
                        if (allSelected) {
                          matchingTaskIds.forEach((id) => next.delete(id))
                          matchingCalEventIds.forEach((id) => next.delete(id))
                        } else {
                          matchingTaskIds.forEach((id) => next.add(id))
                          matchingCalEventIds.forEach((id) => next.add(id))
                        }
                        return next
                      })}
                      className="shrink-0 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors"
                    >
                      {allSelected
                        ? (lang === 'zh' ? '取消全選' : lang === 'fr' ? 'Désélectionner' : 'Deselect all')
                        : (lang === 'zh' ? '全選' : lang === 'fr' ? 'Tout sélectionner' : 'Select all')}
                    </button>
                  </div>
                )
              })()}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                {/* Tasks from DB — always shown immediately */}
                {tasks
                  .filter((t) => {
                    // After the 4-year fetch completes, hide tasks whose calendar event
                    // was deleted (calendarEventId not present in fetched events and
                    // the task deadline falls within the fetched window)
                    if (!linkEventsLoading && linkFetchBoundsRef.current && t.calendarEventId) {
                      const inFetch = linkCalEvents.some((e) => e.id === t.calendarEventId)
                      if (!inFetch) {
                        const dl = t.deadline ? new Date(String(t.deadline)) : null
                        const { start: fs, end: fe } = linkFetchBoundsRef.current
                        if (dl && dl >= fs && dl <= fe) return false
                      }
                    }
                    if (!linkSearch) return true
                    const q = linkSearch.toLowerCase()
                    if (t.title.toLowerCase().includes(q)) return true
                    // Also match by linked calendar event title (task may have a stale title)
                    if (t.calendarEventId) {
                      const ev = linkCalEvents.find((e) => e.id === t.calendarEventId)
                      if (ev?.title.toLowerCase().includes(q)) return true
                    }
                    return false
                  })
                  .sort((a, b) => {
                    const aChain = a.id === chainParent?.id || chainSiblings.some((s) => s.id === a.id)
                    const bChain = b.id === chainParent?.id || chainSiblings.some((s) => s.id === b.id)
                    if (aChain !== bChain) return aChain ? -1 : 1
                    // Most recent deadline first; tasks without deadline go to bottom
                    const da = a.deadline ? new Date(String(a.deadline)).getTime() : Infinity
                    const db = b.deadline ? new Date(String(b.deadline)).getTime() : Infinity
                    return db - da
                  })
                  .map((t) => {
                    const selected = selectedLinkIds.has(t.id)
                    const joinOther = joinOtherChainIds.has(t.id)
                    const isCurrentChainMember = t.id === chainParent?.id || chainSiblings.some((s) => s.id === t.id)
                    const inOtherChain = chainedTaskIds.has(t.id) && !isCurrentChainMember
                    const isConflictPending = chainConflictPending?.id === t.id
                    return (
                      <div key={t.id} className="flex flex-col gap-0.5">
                        <button
                          onClick={() => {
                            if (inOtherChain) {
                              setChainConflictPending(t)
                            } else {
                              setSelectedLinkIds((prev) => {
                                const next = new Set(prev)
                                selected ? next.delete(t.id) : next.add(t.id)
                                return next
                              })
                            }
                          }}
                          className={cn(
                            'flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left transition-colors border w-full',
                            inOtherChain
                              ? joinOther
                                ? 'bg-blue-50 border-blue-200'
                                : isConflictPending
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'hover:bg-[#f3ecdd] border-transparent'
                              : selected
                                ? 'bg-red-50 border-red-200'
                                : 'hover:bg-[#f3ecdd] border-transparent',
                          )}
                        >
                          <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-red-600 border-red-600' : joinOther ? 'bg-blue-500 border-blue-500' : 'border-[#c4b48a]'}`}>
                            {selected && <Check className="h-2.5 w-2.5 text-white" />}
                            {joinOther && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          <span className="truncate flex-1 text-[#3a3326]" title={t.title}>{t.title}</span>
                          {inOtherChain && !joinOther && <span className="shrink-0 text-[9px] text-[#c4b48a] bg-[#f3ecdd] rounded px-1">{lang === 'zh' ? '已在其他任務鏈' : lang === 'fr' ? 'autre chaîne' : 'other chain'}</span>}
                          {joinOther && <span className="shrink-0 text-[9px] text-blue-600 bg-blue-50 rounded px-1">{lang === 'zh' ? '加入其任務鏈' : lang === 'fr' ? 'rejoindre sa chaîne' : 'join their chain'}</span>}
                          {(t.deadline ?? t.scheduledStart) && <span className="text-[#a99873] shrink-0 text-[10px]">{fmtDate(new Date(String(t.deadline ?? t.scheduledStart)), lang)}</span>}
                        </button>
                        {/* Conflict resolution prompt */}
                        {isConflictPending && (
                          <div className="mx-1 mb-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col gap-2">
                            <p className="text-[10px] text-amber-800 leading-snug">
                              {lang === 'zh'
                                ? `「${t.title}」已在另一個任務鏈中，請選擇：`
                                : lang === 'fr'
                                  ? `« ${t.title} » est déjà dans une autre chaîne. Comment procéder ?`
                                  : `"${t.title}" is already in another chain. How to proceed?`}
                            </p>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedLinkIds((prev) => { const next = new Set(prev); next.add(t.id); return next })
                                  setChainConflictPending(null)
                                }}
                                className="flex-1 text-[10px] rounded-md bg-[#ab3326] text-white px-2 py-1.5 hover:bg-[#861f17] transition-colors leading-tight"
                              >
                                {lang === 'zh'
                                  ? `加入「${chainParent?.title ?? event.title}」`
                                  : lang === 'fr'
                                    ? `Ajouter à « ${chainParent?.title ?? event.title} »`
                                    : `Add to "${chainParent?.title ?? event.title}"`}
                              </button>
                              <button
                                onClick={() => {
                                  const rootId = taskChainRootMap.get(t.id) ?? t.id
                                  const rootTask = tasks.find((tk) => tk.id === rootId)
                                  setJoinOtherChainIds(new Set([t.id]))
                                  setSelectedLinkIds(new Set())
                                  setChainConflictPending(null)
                                  // Show which chain we'll be joining
                                  void rootTask
                                }}
                                className="flex-1 text-[10px] rounded-md border border-blue-300 text-blue-700 px-2 py-1.5 hover:bg-blue-50 transition-colors leading-tight"
                              >
                                {(() => {
                                  const rootId = taskChainRootMap.get(t.id) ?? t.id
                                  const rootTask = tasks.find((tk) => tk.id === rootId)
                                  const chainName = rootTask?.title ?? t.title
                                  return lang === 'zh'
                                    ? `加入「${chainName}」的鏈`
                                    : lang === 'fr'
                                      ? `Rejoindre la chaîne « ${chainName} »`
                                      : `Join "${chainName}"'s chain`
                                })()}
                              </button>
                              <button
                                onClick={() => setChainConflictPending(null)}
                                className="text-[10px] rounded-md border border-[#e2d6bc] text-[#a99873] px-2 py-1.5 hover:bg-[#f3ecdd] transition-colors"
                              >
                                {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                {/* Calendar events without tasks — shown after background fetch */}
                {linkEventsLoading && (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[#a99873] text-[10px]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {lang === 'zh' ? '載入其他行事曆事件…' : lang === 'fr' ? 'Chargement des événements…' : 'Loading calendar events…'}
                  </div>
                )}
                {!linkEventsLoading && linkCalEvents
                  .filter((ev) => !tasks.some((t) => t.calendarEventId === ev.id))
                  .filter((ev) => !linkSearch || ev.title.toLowerCase().includes(linkSearch.toLowerCase()))
                  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                  .map((calEv) => {
                    const selected = selectedLinkIds.has(calEv.id)
                    return (
                      <button
                        key={calEv.id}
                        onClick={() => setSelectedLinkIds((prev) => {
                          const next = new Set(prev)
                          selected ? next.delete(calEv.id) : next.add(calEv.id)
                          return next
                        })}
                        className={cn(
                          'flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left transition-colors border',
                          selected ? 'bg-red-50 border-red-200' : 'hover:bg-[#f3ecdd] border-transparent',
                        )}
                      >
                        <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-red-600 border-red-600' : 'border-[#c4b48a]'}`}>
                          {selected && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="truncate flex-1 text-[#3a3326]" title={calEv.title}>{calEv.title}</span>
                        <span className="shrink-0 text-[9px] text-emerald-600 bg-emerald-50 rounded px-1">{lang === 'zh' ? '將建立任務' : lang === 'fr' ? 'créer tâche' : 'new task'}</span>
                        <span className="text-[#a99873] shrink-0 text-[10px]">{fmtDate(new Date(calEv.start), lang)}</span>
                      </button>
                    )
                  })}
                {linkSearch && !linkEventsLoading && (() => {
                  const taskMatches = tasks.filter((t) => {
                    const q = linkSearch.toLowerCase()
                    if (t.title.toLowerCase().includes(q)) return true
                    if (t.calendarEventId) {
                      const ev = linkCalEvents.find((e) => e.id === t.calendarEventId)
                      if (ev?.title.toLowerCase().includes(q)) return true
                    }
                    return false
                  })
                  const evMatches = linkCalEvents
                    .filter((ev) => !tasks.some((t) => t.calendarEventId === ev.id))
                    .filter((ev) => ev.title.toLowerCase().includes(linkSearch.toLowerCase()))
                  if (taskMatches.length === 0 && evMatches.length === 0) {
                    return (
                      <p className="text-center text-xs text-[#a99873] py-4">
                        {lang === 'zh' ? '找不到符合的事件' : lang === 'fr' ? 'Aucun résultat' : 'No results found'}
                      </p>
                    )
                  }
                  return null
                })()}
              </div>
              <div className="px-4 py-3 border-t border-[#ece2cb] flex gap-2">
                <button onClick={() => { setLinkingChain(false); setSelectedLinkIds(new Set()); setJoinOtherChainIds(new Set()); setChainConflictPending(null) }} className="flex-1 rounded-xl border border-[#e2d6bc] text-[#5c5347] text-xs py-2 hover:bg-[#ece2cb] transition-colors">
                  {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  onClick={handleLinkTask}
                  disabled={(selectedLinkIds.size === 0 && joinOtherChainIds.size === 0) || linkSaving}
                  className="flex-1 rounded-xl bg-[#ab3326] text-white text-xs py-2 hover:bg-[#861f17] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {linkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                  {lang === 'zh'
                    ? `連結${selectedLinkIds.size > 0 ? ` (${selectedLinkIds.size})` : ''}`
                    : lang === 'fr'
                    ? `Lier${selectedLinkIds.size > 0 ? ` (${selectedLinkIds.size})` : ''}`
                    : `Link${selectedLinkIds.size > 0 ? ` (${selectedLinkIds.size})` : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Which occurrences? Asked only for a repeating event, the way a calendar
          app asks — the edit is held until it is answered. */}
      {pendingEdit && (
        <div className="shrink-0 border-t border-[#e2d6bc] bg-[#fbeacb]/60 px-4 py-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-[#8a6b3e]">
            {lang === 'fr' ? 'Événement récurrent — appliquer à :' : lang === 'zh' ? '這是重複活動 — 要套用到：' : 'Repeating event — apply to:'}
          </p>
          {([
            ['single', lang === 'fr' ? 'Cet événement' : lang === 'zh' ? '僅此活動' : 'This event'],
            ['following', lang === 'fr' ? 'Celui-ci et les suivants' : lang === 'zh' ? '此活動及之後' : 'This and following'],
            ['all', lang === 'fr' ? 'Tous les événements' : lang === 'zh' ? '所有活動' : 'All events'],
          ] as [RecurrenceScope, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                onSave(event, pendingEdit.title, new Date(pendingEdit.start).toISOString(), new Date(pendingEdit.end).toISOString(), pendingEdit.allDay, value)
                setPendingEdit(null)
              }}
              className="w-full rounded-xl border border-[#e2d6bc] bg-white px-3 py-2 text-xs text-[#3a3326] text-left hover:border-[#cba968] hover:bg-[#f3ecdd] transition-colors"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => { setPendingEdit(null); resetDraft() }}
            className="text-[11px] text-[#8a7a5e] hover:text-[#3a3326] w-fit"
          >
            {lang === 'fr' ? 'Annuler' : lang === 'zh' ? '取消' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Footer — no Save button: fields save themselves when you leave them. */}
      {event.editable && (
        <div className="shrink-0 border-t border-[#e2d6bc] px-4 py-3 flex items-center gap-2">
          {confirmingDelete ? (
            <div className="flex-1 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
              <span className="flex-1 text-xs text-red-700 truncate">
                {lang === 'fr' ? `Supprimer « ${event.title} » ?` : lang === 'zh' ? `確定刪除「${event.title}」？` : `Delete "${event.title}"?`}
              </span>
              <button onClick={() => setConfirmingDelete(false)} className="text-[11px] text-[#8a7a5e] hover:text-[#3a3326] shrink-0">
                {lang === 'fr' ? 'Annuler' : lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button onClick={() => { setConfirmingDelete(false); onDelete(event) }} className="text-[11px] font-medium text-red-600 hover:text-red-800 shrink-0">
                {lang === 'fr' ? 'Supprimer' : lang === 'zh' ? '刪除' : 'Delete'}
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setConfirmingDelete(true)} className="flex items-center gap-1 rounded-xl border border-red-200 text-red-600 text-xs px-3 py-2 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3 w-3" />
                {lang === 'fr' ? 'Suppr.' : lang === 'zh' ? '刪除' : 'Delete'}
              </button>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[#a99873]">
                {saving
                  ? <><Loader2 className="h-3 w-3 animate-spin" />{lang === 'fr' ? 'Enregistrement…' : lang === 'zh' ? '儲存中…' : 'Saving…'}</>
                  : (lang === 'fr' ? 'Enregistré automatiquement' : lang === 'zh' ? '自動儲存' : 'Saves automatically')}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
