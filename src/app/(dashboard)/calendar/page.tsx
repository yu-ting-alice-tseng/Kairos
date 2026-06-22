'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, CalendarEvent, Habit, RetroTemplate } from '@/types'
import { t } from '@/lib/i18n'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Button } from '@/components/ui/button'
import { cn, formatTime, getQuadrant, EISENHOWER_QUADRANTS } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, Clock, Loader2, Pencil, Trash2, X,
  MapPin, ExternalLink, GitBranch, AlignLeft, CheckCircle2, Check, Sparkles, Undo2,
} from 'lucide-react'
import {
  format, addDays, isSameDay, isToday,
} from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

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

interface UndoItem {
  event: CalendarEvent
  prevStart: string
  prevEnd: string
  prevAllDay?: boolean
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { language, tasks, setTasks, calendarAccounts, habits, setHabits } = useAppStore()
  const { toast } = useGlobalToast()
  // startDate is always Monday of the current week (Sunday → next Monday)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    const dow = d.getDay() // 0=Sun
    const toMon = dow === 0 ? 1 : 1 - dow
    d.setDate(d.getDate() + toMon)
    return d
  })
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventSaving, setEventSaving] = useState(false)
  const [viewingHabit, setViewingHabit] = useState<Habit | null>(null)
  const [userTemplates, setUserTemplates] = useState<RetroTemplate[]>([])
  const [retroSuggestion, setRetroSuggestion] = useState<RetroSuggestion | null>(null)
  const [retroSuggestionSaving, setRetroSuggestionSaving] = useState(false)
  const [hiddenAccountIds, setHiddenAccountIds] = useState<Set<string>>(new Set())

  const toggleAccount = (id: string) =>
    setHiddenAccountIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Drag state
  const dragRef = useRef<DragState | null>(null)
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{ dayIdx: number; hour: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Undo stack for drag moves
  const undoStackRef = useRef<UndoItem[]>([])

  // Dismissed suggestion IDs — persisted in sessionStorage so navigation re-mounts don't re-show them
  const dismissedRef = useRef<Set<string>>(new Set<string>())
  if (dismissedRef.current.size === 0) {
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('retro_dismissed') : null
      if (raw) JSON.parse(raw).forEach((id: string) => dismissedRef.current.add(id))
    } catch { /* ignore */ }
  }

  // Touch swipe refs
  const touchStartXRef = useRef<number | null>(null)

  const weekDaysRef = useRef<Date[]>([])
  const dragPreviewRef = useRef<{ dayIdx: number; hour: number } | null>(null)
  dragPreviewRef.current = dragPreview

  const locale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS
  const weekStart = startDate
  const weekEnd = addDays(startDate, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))
  weekDaysRef.current = weekDays

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }, [setTasks])

  const loadExternalEvents = useCallback(async () => {
    if (calendarAccounts.length === 0) return
    setEventsLoading(true)
    try {
      const res = await fetch(
        `/api/calendar/events?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
      )
      if (res.ok) setExternalEvents(await res.json())
    } catch { /* best-effort */ }
    setEventsLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarAccounts.length, weekStart.toISOString(), weekEnd.toISOString()])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => { loadExternalEvents() }, [loadExternalEvents])
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

    for (const ev of externalEvents) {
      if (dismissedRef.current.has(ev.id)) continue

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

  const scheduledTasks = tasks.filter((task) => task.scheduledStart && task.scheduledEnd)

  const getDeadlineTasksForDay = (day: Date) =>
    tasks.filter((task) => {
      if (!task.deadline) return false
      if (task.scheduledStart) return false // has a specific time slot already
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
    habits.filter((h) => !h.scheduledTime && isHabitActiveOnDay(h, day))

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
      if (!h.scheduledTime || !isHabitActiveOnDay(h, day)) return
      const [hh, mm] = h.scheduledTime.split(':').map(Number)
      const start = hh * 60 + mm - GRID_START_HOUR * 60
      raw.push({ id: `habit-${h.id}`, kind: 'habit', start, end: start + (h.durationMinutes ?? 30), data: h })
    })

    const visible = raw
      .filter((it) => it.end > 0 && it.start < GRID_TOTAL_MIN)
      .map((it) => ({ ...it, start: Math.max(0, it.start), end: Math.min(GRID_TOTAL_MIN, it.end) }))

    const cols = assignColumns(visible)
    return visible.map((it) => ({ ...it, ...(cols.get(it.id) ?? { col: 0, cols: 1 }) })) as DayBlock[]
  }

  // ─── Event handlers ─────────────────────────────────────────────────────────

  const handleSaveEvent = useCallback(async (
    ev: CalendarEvent,
    title: string,
    start: string,
    end: string,
    allDay?: boolean,
  ) => {
    setEventSaving(true)
    const body: Record<string, unknown> = {
      eventId: ev.id,
      calendarAccountId: ev.calendarAccountId,
      calendarId: ev.calendarId,
      title, start, end,
    }
    if (allDay !== undefined) body.allDay = allDay
    const res = await fetch('/api/calendar/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      // Push old state to undo stack (only for position changes, not title edits)
      if (ev.start !== start || ev.end !== end) {
        undoStackRef.current.push({
          event: ev,
          prevStart: new Date(ev.start).toISOString(),
          prevEnd: new Date(ev.end).toISOString(),
          prevAllDay: ev.allDay,
        })
      }
      setExternalEvents((prev) =>
        prev.map((e) =>
          e.id === ev.id
            ? { ...e, title, start, end, ...(allDay !== undefined ? { allDay } : {}) }
            : e
        )
      )
      toast({ title: language === 'fr' ? 'Événement mis à jour' : language === 'zh' ? '活動已更新' : 'Event updated', variant: 'success' })
      setEditingEvent(null)
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de la mise à jour' : language === 'zh' ? '更新失敗' : 'Failed to update', variant: 'error' })
    }
    setEventSaving(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const handleSaveEventRef = useRef(handleSaveEvent)
  handleSaveEventRef.current = handleSaveEvent

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    if (!confirm(language === 'fr' ? 'Supprimer cet événement ?' : language === 'zh' ? '確定刪除此活動？' : 'Delete this event?')) return
    const res = await fetch('/api/calendar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: ev.id, calendarAccountId: ev.calendarAccountId, calendarId: ev.calendarId }),
    })
    if (res.ok) {
      setExternalEvents((prev) => prev.filter((e) => e.id !== ev.id))
      toast({ title: language === 'fr' ? 'Événement supprimé' : language === 'zh' ? '活動已刪除' : 'Event deleted', variant: 'success' })
      setEditingEvent(null)
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de la suppression' : language === 'zh' ? '刪除失敗' : 'Failed to delete', variant: 'error' })
    }
  }

  const handleCompleteTask = useCallback(async (task: Task) => {
    const isCompleted = task.status === 'COMPLETED'
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    setTasks(tasks.map((t) => t.id === task.id ? { ...t, status: newStatus, completedAt: isCompleted ? null : new Date().toISOString() } : t))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, completedAt: isCompleted ? null : new Date().toISOString() }),
    })
  }, [tasks, setTasks])

  const handleCompleteHabit = useCallback(async (habit: Habit) => {
    const alreadyDone = (habit.completions?.length ?? 0) > 0
    if (alreadyDone) return
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
        setTasks(tasks.map((task) => task.id === editingTask.id ? updated : task))
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
        setTasks([...tasks, created])
        toast({ title: language === 'fr' ? 'Tâche créée !' : language === 'zh' ? '任務已建立！' : 'Task created!', variant: 'success' })
      }
    }
    setEditingTask(null)
    setSelectedDate(null)
  }

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(tasks.filter((task) => task.id !== id))
    setEditingTask(null)
  }

  const handleCellClick = (day: Date, hour: number) => {
    const dt = new Date(day)
    dt.setHours(hour, 0, 0, 0)
    setSelectedDate(dt)
    setShowTaskForm(true)
  }

  const handleTaskClick = (task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
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
      persistDismissed(suggestion.event.id)
      setRetroSuggestion(null)
    }
  }

  const persistDismissed = (id: string) => {
    dismissedRef.current.add(id)
    try {
      sessionStorage.setItem('retro_dismissed', JSON.stringify([...dismissedRef.current]))
    } catch { /* ignore */ }
  }

  const handleDismissRetroSuggestion = () => {
    if (retroSuggestion) persistDismissed(retroSuggestion.event.id)
    setRetroSuggestion(null)
  }

  // ─── Drag helpers ────────────────────────────────────────────────────────────

  const finalizeDrop = useCallback((drag: DragState, preview: { dayIdx: number; hour: number } | null) => {
    if (!preview) return
    const targetDay = weekDaysRef.current[preview.dayIdx]
    if (!targetDay) return
    if (preview.hour < 7) {
      const newStart = new Date(targetDay); newStart.setHours(0, 0, 0, 0)
      const newEnd = new Date(newStart); newEnd.setHours(23, 59, 59, 999)
      handleSaveEventRef.current(drag.event, drag.event.title, newStart.toISOString(), newEnd.toISOString(), true)
    } else {
      const newStart = new Date(targetDay); newStart.setHours(preview.hour, 0, 0, 0)
      const newEnd = new Date(newStart.getTime() + drag.eventDurationMs)
      handleSaveEventRef.current(drag.event, drag.event.title, newStart.toISOString(), newEnd.toISOString(), false)
    }
  }, [])

  const startDrag = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    if (!ev.editable) return
    e.preventDefault(); e.stopPropagation()
    const durationMs = ev.start && ev.end
      ? new Date(ev.end as string).getTime() - new Date(ev.start as string).getTime()
      : 60 * 60 * 1000
    dragRef.current = { event: ev, startMouseY: e.clientY, startMouseX: e.clientX, eventDurationMs: durationMs }
    setDraggingEventId(ev.id)
    const onMouseUp = () => {
      document.removeEventListener('mouseup', onMouseUp)
      const drag = dragRef.current; const preview = dragPreviewRef.current
      dragRef.current = null; setDraggingEventId(null); setDragPreview(null)
      if (drag) finalizeDrop(drag, preview)
    }
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeDrop])

  const startAllDayDrag = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    if (!ev.editable) return
    e.preventDefault(); e.stopPropagation()
    dragRef.current = { event: ev, startMouseY: e.clientY, startMouseX: e.clientX, eventDurationMs: 60 * 60 * 1000 }
    setDraggingEventId(ev.id)
    const onMouseUp = () => {
      document.removeEventListener('mouseup', onMouseUp)
      const drag = dragRef.current; const preview = dragPreviewRef.current
      dragRef.current = null; setDraggingEventId(null); setDragPreview(null)
      if (drag && preview && preview.hour >= 7) finalizeDrop(drag, preview)
    }
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeDrop])

  const handleCellMouseMove = useCallback((dayIdx: number, hour: number) => {
    if (dragRef.current) setDragPreview({ dayIdx, hour })
  }, [])

  const handleAllDayCellMouseMove = useCallback((dayIdx: number) => {
    if (dragRef.current) setDragPreview({ dayIdx, hour: 0 })
  }, [])

  const isDragging = draggingEventId !== null

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#a87f3e]" /></div>
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#ab3326]" />
            <h1 className="text-2xl font-serif text-[#2a2420]">{t('calendar', language)}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setStartDate((d) => addDays(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-[#5c5347] px-2 min-w-[160px] text-center">
              {format(weekStart, 'dd MMM', { locale })} – {format(weekEnd, 'dd MMM yyyy', { locale })}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => setStartDate((d) => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setHours(0,0,0,0); const dow = d.getDay(); d.setDate(d.getDate() + (dow === 0 ? 1 : 1 - dow)); setStartDate(d) }}>
              {t('today', language)}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {undoStackRef.current.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              title={language === 'fr' ? 'Annuler (Ctrl+Z)' : language === 'zh' ? '復原 (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
              onClick={() => {
                const item = undoStackRef.current.pop()
                if (item) handleSaveEventRef.current(item.event, item.event.title, item.prevStart, item.prevEnd, item.prevAllDay)
              }}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-[#a99873]" />}
          {calendarAccounts.length > 0 && (
            <div className="flex items-center gap-1.5">
              {calendarAccounts.map((acc) => {
                const hidden = hiddenAccountIds.has(acc.id)
                return (
                  <button
                    key={acc.id}
                    title={hidden ? acc.name + ' (masqué)' : acc.name}
                    onClick={() => toggleAccount(acc.id)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-0.5 border transition-all text-xs hover:opacity-80"
                    style={{
                      borderColor: hidden ? '#d1c9b8' : acc.color,
                      backgroundColor: hidden ? 'transparent' : acc.color + '20',
                      color: hidden ? '#a99873' : acc.color,
                      textDecoration: hidden ? 'line-through' : 'none',
                      opacity: hidden ? 0.5 : 1,
                    }}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: hidden ? '#a99873' : acc.color }} />
                    <span className="max-w-[80px] truncate">{acc.name}</span>
                  </button>
                )
              })}
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

      {/* Body: calendar grid + detail side panel */}
      <div className="flex flex-1 min-h-0">

      {/* Calendar grid — swipe to change week */}
      <div
        className={cn('flex-1 overflow-auto min-w-0', isDragging && 'cursor-grabbing select-none')}
        style={{ touchAction: 'pan-y' }}
        onTouchStart={(e) => { touchStartXRef.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchStartXRef.current === null) return
          const delta = e.changedTouches[0].clientX - touchStartXRef.current
          if (delta > 40) setStartDate((d) => addDays(d, -1))
          else if (delta < -40) setStartDate((d) => addDays(d, 1))
          touchStartXRef.current = null
        }}
      >
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#ece2cb] bg-[#fbf7ee] sticky top-0 z-10">
            <div className="py-3 px-2 text-xs text-[#a99873] border-r border-[#ece2cb]" />
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
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b-2 border-[#e2d6bc] bg-[#f3ecdd]/60">
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
                    const isLinkedDone = tasks.some((t) => t.calendarEventId === ev.id && t.status === 'COMPLETED')
                    return (
                      <div
                        key={ev.id}
                        className={cn('rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border border-dashed', ev.editable && !isDragging ? 'cursor-grab' : '', isDraggingThis && 'opacity-40', isLinkedDone && 'opacity-50')}
                        style={{ backgroundColor: color + '22', borderColor: color }}
                        title={ev.title}
                        onMouseDown={(e) => { if (ev.editable) startAllDayDrag(e, ev) }}
                        onClick={(e) => { e.stopPropagation(); if (!isDragging) setEditingEvent(ev) }}
                      >
                        <span className={cn('text-[#2a2420]', isLinkedDone && 'line-through text-[#a99873]')}>{ev.title}</span>
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
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border cursor-pointer hover:brightness-95 transition-all',
                          done ? 'opacity-50 bg-emerald-50 border-emerald-200' : cn(q?.bgColor, 'border-[#e2d6bc]')
                        )}
                        style={!done && borderColor ? { borderLeftColor: borderColor, borderLeftWidth: 2 } : {}}
                        title={`${task.title} — I:${task.importance} U:${task.urgency}`}
                        onClick={(e) => { e.stopPropagation(); handleTaskClick(task) }}
                      >
                        <span className={cn(done ? 'line-through text-[#a99873]' : 'text-[#2a2420]')}>{task.title}</span>
                        <span className="ml-1 text-[10px] opacity-60">I:{task.importance} U:{task.urgency}</span>
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
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#f3ecdd] h-[60px]">
                <div className="px-2 py-1 text-xs text-[#a99873] text-right border-r border-[#ece2cb] w-12 shrink-0">
                  {hour}:00
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
            <div className="absolute inset-0 grid grid-cols-[60px_repeat(7,1fr)] pointer-events-none">
              <div className="w-12 shrink-0" />
              {weekDays.map((day, dayIdx) => {
                const blocks = getDayBlocks(day)
                const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && (dragPreview?.hour ?? -1) >= GRID_START_HOUR
                return (
                  <div key={day.toISOString()} className="relative px-1">
                    {blocks.map((block) => {
                      const top = block.start
                      const height = Math.max(block.end - block.start, MIN_BLOCK_HEIGHT)
                      const widthPct = 100 / block.cols
                      const leftPct = block.col * widthPct
                      const boxStyle: React.CSSProperties = {
                        position: 'absolute',
                        top,
                        height,
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - 4px)`,
                      }

                      if (block.kind === 'event') {
                        const ev = block.data
                        const evColor = ev.color ?? calendarAccounts.find((a) => a.id === ev.calendarAccountId)?.color ?? '#6366F1'
                        const isDraggingThis = draggingEventId === ev.id
                        return (
                          <div
                            key={block.id}
                            onClick={(e) => { e.stopPropagation(); if (!isDragging) setEditingEvent(ev) }}
                            onMouseDown={(e) => { if (ev.editable) startDrag(e, ev) }}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs border border-dashed overflow-hidden group',
                              isDragging ? 'pointer-events-none' : 'pointer-events-auto',
                              ev.editable ? 'cursor-grab hover:brightness-95' : 'select-none',
                              isDraggingThis && 'opacity-40'
                            )}
                            style={{ ...boxStyle, backgroundColor: evColor + '22', borderColor: evColor }}
                          >
                            <p className="font-medium truncate text-[#2a2420]">{ev.title}</p>
                            {ev.start && ev.end && (
                              <p className="flex items-center gap-1 text-[#5c5347]">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(ev.start)} – {formatTime(ev.end)}
                              </p>
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
                        return (
                          <div
                            key={block.id}
                            onClick={(e) => { e.stopPropagation(); handleTaskClick(task) }}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs cursor-pointer border transition-all hover:shadow-sm overflow-hidden group relative',
                              isDragging ? 'pointer-events-none' : 'pointer-events-auto',
                              done
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-70'
                                : isRetro
                                ? 'border-dashed border-purple-300 bg-purple-50/80 text-purple-900'
                                : cn(q?.bgColor, q?.color)
                            )}
                            style={{ ...boxStyle, ...(!done && !isRetro && acc ? { borderLeftColor: acc.color, borderLeftWidth: 3 } : {}) }}
                          >
                            {isRetro && <GitBranch className="h-2.5 w-2.5 absolute top-1 right-1 opacity-50" />}
                            <p className={cn('font-medium truncate', done && 'line-through')}>{task.title}</p>
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
                          <p className={cn('font-medium truncate', doneToday && 'line-through')}>
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
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(null)}
          onTasksRefresh={async () => {
            const res = await fetch('/api/tasks')
            if (res.ok) setTasks(await res.json())
          }}
          onNavigateToDate={(date: Date) => {
            // Jump to the Monday of the week containing `date`
            const d = new Date(date); d.setHours(0, 0, 0, 0)
            const dow = d.getDay()
            const toMon = dow === 0 ? -6 : 1 - dow
            d.setDate(d.getDate() + toMon)
            setStartDate(d)
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
    </div>
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
                const stageDateStr = stageDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })
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

function EventDetailPanel({
  event, lang, saving, tasks, onSave, onDelete, onClose, onTasksRefresh, onNavigateToDate,
}: {
  event: CalendarEvent
  lang: 'fr' | 'en' | 'zh'
  saving: boolean
  tasks: Task[]
  onSave: (ev: CalendarEvent, title: string, start: string, end: string) => void
  onDelete: (ev: CalendarEvent) => void
  onClose: () => void
  onTasksRefresh: () => void
  onNavigateToDate?: (date: Date) => void
}) {
  const toLocal = (d: Date | string) => {
    const dt = new Date(d)
    const offset = dt.getTimezoneOffset() * 60000
    return new Date(dt.getTime() - offset).toISOString().slice(0, 16)
  }
  const [editing, setEditing] = React.useState(false)
  const [title, setTitle] = React.useState(event.title)
  const [start, setStart] = React.useState(toLocal(event.start))
  const [end, setEnd] = React.useState(toLocal(event.end))

  React.useEffect(() => {
    setEditing(false)
    setTitle(event.title)
    setStart(toLocal(event.start))
    setEnd(toLocal(event.end))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  // Tasks directly linked to this calendar event
  const directlyLinkedTasks = React.useMemo(
    () => tasks.filter((t) => t.calendarEventId === event.id),
    [tasks, event.id]
  )
  // Find the chain parent: task linked directly or parent of a linked sub-task
  const chainParent = React.useMemo(() => {
    const direct = directlyLinkedTasks.find((t) => !t.parentTaskId)
    if (direct) return direct
    const sub = directlyLinkedTasks.find((t) => t.parentTaskId)
    return sub ? tasks.find((t) => t.id === sub.parentTaskId) ?? null : null
  }, [directlyLinkedTasks, tasks])
  const chainSiblings = React.useMemo(() => {
    if (!chainParent) return []
    const byParent = tasks.filter((t) => t.parentTaskId === chainParent.id)
    const directExtras = directlyLinkedTasks.filter(
      (t) => t.id !== chainParent.id && !byParent.some((s) => s.id === t.id)
    )
    return [...byParent, ...directExtras]
  }, [chainParent, tasks, directlyLinkedTasks])
  // Fallback: fuzzy title match for old tasks not linked via calendarEventId
  const relatedChains = React.useMemo(() => {
    if (chainParent) return []
    const words = event.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    return tasks.filter((t) => t.parentTaskId && words.some((w) => t.title.toLowerCase().includes(w)))
  }, [event.title, tasks, chainParent])

  const [linkingChain, setLinkingChain] = React.useState(false)
  const [linkMode, setLinkMode] = React.useState<'tasks' | 'events'>('tasks')
  const [availableEvents, setAvailableEvents] = React.useState<{ id: string; title: string; start: string }[]>([])
  const [selectedLinkIds, setSelectedLinkIds] = React.useState<Set<string>>(new Set())
  const [linkSaving, setLinkSaving] = React.useState(false)
  const [linkSearch, setLinkSearch] = React.useState('')
  const [newTaskSaving, setNewTaskSaving] = React.useState(false)

  // Relevance: count event-title chars found in task title (higher = more relevant)
  const relevanceScore = React.useCallback((taskTitle: string): number => {
    const evChars = new Set(event.title.toLowerCase().replace(/\s/g, '').split(''))
    let score = 0
    for (const c of taskTitle.toLowerCase().replace(/\s/g, '').split('')) {
      if (evChars.has(c)) score++
    }
    return score
  }, [event.title])

  const handleCreateTask = async () => {
    setNewTaskSaving(true)
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: event.title, calendarEventId: event.id, deadline: event.start, importance: 7, urgency: 6 }),
      })
      onTasksRefresh()
    } catch { /* ignore */ } finally { setNewTaskSaving(false) }
  }

  const handleLinkExistingTasks = async () => {
    if (selectedLinkIds.size === 0) return
    setLinkSaving(true)
    try {
      await Promise.all([...selectedLinkIds].map((id) =>
        fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarEventId: event.id }),
        })
      ))
      onTasksRefresh()
      setLinkingChain(false)
    } catch { /* ignore */ } finally { setLinkSaving(false) }
  }

  const openLinkDialog = async (mode: 'tasks' | 'events' = 'tasks') => {
    setLinkMode(mode)
    setLinkingChain(true)
    setSelectedLinkIds(new Set())
    setLinkSearch('')
    if (mode === 'events') {
      const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year back
      const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      try {
        const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`)
        if (res.ok) {
          const evs: { id: string; title: string; start: string }[] = await res.json()
          setAvailableEvents(evs.filter((e) => e.id !== event.id))
        }
      } catch { /* best-effort */ }
    }
  }

  const handleCreateChain = async () => {
    if (selectedLinkIds.size === 0) return
    setLinkSaving(true)
    try {
      // Create parent task representing this event chain
      const parentRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          deadline: event.start,
          calendarEventId: event.id,
          importance: 7,
          urgency: 6,
        }),
      })
      if (!parentRes.ok) throw new Error()
      const parent = await parentRes.json()
      // Create sub-tasks for each selected event
      const selected = availableEvents.filter((e) => selectedLinkIds.has(e.id))
      await Promise.all(selected.map((e) =>
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: e.title,
            deadline: e.start,
            calendarEventId: e.id,
            parentTaskId: parent.id,
            importance: 7,
            urgency: 6,
          }),
        })
      ))
      onTasksRefresh()
    } catch { /* ignore */ } finally {
      setLinkSaving(false)
      setLinkingChain(false)
    }
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
        {/* Title */}
        {editing ? (
          <input
            autoFocus
            className="w-full border border-[#e2d6bc] rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-300 bg-white text-[#2a2420]"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        ) : (
          <h2 className="text-sm font-semibold text-[#2a2420] leading-snug">{event.title}</h2>
        )}

        {/* Date / time */}
        {editing ? (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] font-medium text-[#8a7a5e] mb-1 block uppercase tracking-wide">
                {lang === 'fr' ? 'Début' : lang === 'zh' ? '開始' : 'Start'}
              </label>
              <input type="datetime-local" className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-[#8a7a5e] mb-1 block uppercase tracking-wide">
                {lang === 'fr' ? 'Fin' : lang === 'zh' ? '結束' : 'End'}
              </label>
              <input type="datetime-local" className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 text-[#5c5347]">
            <Clock className="h-3.5 w-3.5 text-[#a99873] shrink-0 mt-0.5" />
            <span className="text-xs leading-relaxed">{event.allDay ? (lang === 'fr' ? 'Toute la journée · ' : lang === 'zh' ? '整天 · ' : 'All day · ') + dateLabel : dateLabel}</span>
          </div>
        )}

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

          {/* Existing chain display */}
          {(chainParent || relatedChains.length > 0) && (
            <div className="flex flex-col gap-1">
              {chainParent ? (
                <>
                  <div
                    className={cn('flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 bg-red-50 border border-red-200', chainParent.deadline && onNavigateToDate ? 'cursor-pointer hover:bg-red-100 transition-colors' : '')}
                    onClick={() => chainParent.deadline && onNavigateToDate?.(new Date(String(chainParent.deadline)))}
                  >
                    <GitBranch className="h-3 w-3 text-red-600 shrink-0" />
                    <span className="text-[#3a3326] truncate flex-1 font-medium">{chainParent.title}</span>
                    {chainParent.deadline && (
                      <span className="text-red-500 shrink-0 text-[10px] flex items-center gap-0.5">
                        {new Date(chainParent.deadline).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })}
                        {onNavigateToDate && <ChevronRight className="h-2.5 w-2.5" />}
                      </span>
                    )}
                  </div>
                  {chainSiblings.map((t) => (
                    <div
                      key={t.id}
                      className={cn('flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 bg-[#f3ecdd] border border-[#ece2cb] ml-3', t.deadline && onNavigateToDate ? 'cursor-pointer hover:bg-[#ece2cb] transition-colors' : '')}
                      onClick={() => t.deadline && onNavigateToDate?.(new Date(String(t.deadline)))}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#a99873] shrink-0" />
                      <span className={`truncate flex-1 ${t.calendarEventId === event.id ? 'text-[#ab3326] font-medium' : 'text-[#3a3326]'}`}>{t.title}</span>
                      {t.deadline && (
                        <span className="text-[#a99873] shrink-0 text-[10px] flex items-center gap-0.5">
                          {new Date(t.deadline).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })}
                          {onNavigateToDate && <ChevronRight className="h-2.5 w-2.5" />}
                        </span>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                relatedChains.map((t) => (
                  <div
                    key={t.id}
                    className={cn('flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 bg-[#f3ecdd] border border-[#ece2cb]', t.deadline && onNavigateToDate ? 'cursor-pointer hover:bg-[#ece2cb] transition-colors' : '')}
                    onClick={() => t.deadline && onNavigateToDate?.(new Date(String(t.deadline)))}
                  >
                    <span className="text-[#3a3326] truncate flex-1">{t.title}</span>
                    {t.deadline && (
                      <span className="text-[#a99873] ml-2 shrink-0 text-[10px] flex items-center gap-0.5">
                        {new Date(t.deadline).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })}
                        {onNavigateToDate && <ChevronRight className="h-2.5 w-2.5" />}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Always-visible add buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={() => openLinkDialog('tasks')}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[#8a7a5e] hover:text-[#ab3326] border border-dashed border-[#e2d6bc] rounded-lg px-3 py-2 hover:border-red-300 transition-colors"
            >
              <GitBranch className="h-3 w-3" />
              {lang === 'fr' ? 'Lier une tâche' : lang === 'zh' ? '連結任務' : 'Link task'}
            </button>
            <button
              onClick={handleCreateTask}
              disabled={newTaskSaving}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white bg-[#ab3326] hover:bg-[#861f17] rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
            >
              {newTaskSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              {lang === 'fr' ? 'Créer' : lang === 'zh' ? '新增' : 'New task'}
            </button>
          </div>
        </div>

        {/* Link chain dialog */}
        {linkingChain && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setLinkingChain(false)}>
            <div className="bg-[#fbf7ee] rounded-2xl border border-[#e2d6bc] shadow-xl w-80 max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-[#ece2cb] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a2420]">
                  {lang === 'zh' ? '連結任務' : lang === 'fr' ? 'Lier une tâche' : 'Link a task'}
                </p>
                <button onClick={() => setLinkingChain(false)} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Mode tabs */}
              <div className="px-4 pt-2 pb-1 flex gap-1">
                {(['tasks', 'events'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setLinkMode(m); setSelectedLinkIds(new Set()); if (m === 'events' && availableEvents.length === 0) openLinkDialog('events') }}
                    className={`flex-1 text-[11px] rounded-lg py-1.5 font-medium transition-colors ${linkMode === m ? 'bg-[#ab3326] text-white' : 'bg-[#ece2cb] text-[#5c5347] hover:bg-[#e2d6bc]'}`}
                  >
                    {m === 'tasks'
                      ? (lang === 'zh' ? '既有任務' : lang === 'fr' ? 'Tâches existantes' : 'Existing tasks')
                      : (lang === 'zh' ? '日曆行程' : lang === 'fr' ? 'Événements' : 'Calendar events')}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="px-4 py-2 border-b border-[#ece2cb]">
                <input
                  className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  placeholder={lang === 'zh' ? '搜尋...' : lang === 'fr' ? 'Rechercher...' : 'Search...'}
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
              </div>
              {/* List */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                {linkMode === 'tasks' ? (
                  tasks
                    .filter((t) => !linkSearch || t.title.toLowerCase().includes(linkSearch.toLowerCase()))
                    .sort((a, b) => relevanceScore(b.title) - relevanceScore(a.title))
                    .slice(0, 40)
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedLinkIds((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}
                        className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left transition-colors ${selectedLinkIds.has(t.id) ? 'bg-red-50 border border-red-200' : 'hover:bg-[#f3ecdd] border border-transparent'}`}
                      >
                        <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selectedLinkIds.has(t.id) ? 'bg-red-600 border-red-600' : 'border-[#c4b48a]'}`}>
                          {selectedLinkIds.has(t.id) && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="truncate flex-1 text-[#3a3326]">{t.title}</span>
                        {t.deadline && (
                          <span className="text-[#a99873] shrink-0 text-[10px]">
                            {new Date(String(t.deadline)).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </button>
                    ))
                ) : (
                  availableEvents
                    .filter((e) => !linkSearch || e.title.toLowerCase().includes(linkSearch.toLowerCase()))
                    .slice(0, 30)
                    .map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setSelectedLinkIds((prev) => { const n = new Set(prev); n.has(e.id) ? n.delete(e.id) : n.add(e.id); return n })}
                        className={`flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left transition-colors ${selectedLinkIds.has(e.id) ? 'bg-red-50 border border-red-200' : 'hover:bg-[#f3ecdd] border border-transparent'}`}
                      >
                        <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selectedLinkIds.has(e.id) ? 'bg-red-600 border-red-600' : 'border-[#c4b48a]'}`}>
                          {selectedLinkIds.has(e.id) && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="truncate flex-1 text-[#3a3326]">{e.title}</span>
                        <span className="text-[#a99873] shrink-0 text-[10px]">
                          {new Date(e.start).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </button>
                    ))
                )}
                {linkMode === 'events' && availableEvents.length === 0 && (
                  <p className="text-xs text-[#a99873] text-center py-4">{lang === 'zh' ? '載入中...' : 'Loading...'}</p>
                )}
              </div>
              {/* Footer */}
              <div className="px-4 py-3 border-t border-[#ece2cb] flex gap-2">
                <button onClick={() => setLinkingChain(false)} className="flex-1 rounded-xl border border-[#e2d6bc] text-[#5c5347] text-xs py-2 hover:bg-[#ece2cb] transition-colors">
                  {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
                <button
                  onClick={linkMode === 'tasks' ? handleLinkExistingTasks : handleCreateChain}
                  disabled={selectedLinkIds.size === 0 || linkSaving}
                  className="flex-1 rounded-xl bg-[#ab3326] text-white text-xs py-2 hover:bg-[#861f17] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {linkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                  {lang === 'zh' ? `連結 (${selectedLinkIds.size})` : lang === 'fr' ? `Lier (${selectedLinkIds.size})` : `Link (${selectedLinkIds.size})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {event.editable && (
        <div className="shrink-0 border-t border-[#e2d6bc] px-4 py-3 flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="flex-1 rounded-xl border border-[#e2d6bc] text-[#5c5347] text-xs py-2 hover:bg-[#ece2cb] transition-colors">
                {lang === 'fr' ? 'Annuler' : lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={() => { onSave(event, title, new Date(start).toISOString(), new Date(end).toISOString()); setEditing(false) }}
                disabled={saving}
                className="flex-1 rounded-xl bg-[#ab3326] text-white text-xs py-2 hover:bg-[#861f17] transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : (lang === 'fr' ? 'Enregistrer' : lang === 'zh' ? '儲存' : 'Save')}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onDelete(event)} className="flex items-center gap-1 rounded-xl border border-red-200 text-red-600 text-xs px-3 py-2 hover:bg-red-50 transition-colors">
                <Trash2 className="h-3 w-3" />
                {lang === 'fr' ? 'Suppr.' : lang === 'zh' ? '刪除' : 'Delete'}
              </button>
              <button onClick={() => setEditing(true)} className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-[#ab3326] text-white text-xs py-2 hover:bg-[#861f17] transition-colors">
                <Pencil className="h-3 w-3" />
                {lang === 'fr' ? 'Modifier' : lang === 'zh' ? '編輯' : 'Edit'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
