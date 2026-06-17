'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, CalendarEvent, Habit } from '@/types'
import { t } from '@/lib/i18n'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Button } from '@/components/ui/button'
import { cn, formatTime, getQuadrant, EISENHOWER_QUADRANTS } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, Clock, Loader2, Pencil, Trash2, X,
  MapPin, ExternalLink, GitBranch, AlignLeft,
} from 'lucide-react'
import {
  format, startOfWeek, endOfWeek, addDays, isSameDay, addWeeks, subWeeks,
  isToday,
} from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)
const ROW_HEIGHT = 60 // px per hour — 1px per minute, keeps every hour row identical
const GRID_START_HOUR = HOURS[0]
const GRID_TOTAL_MIN = HOURS.length * 60
const MIN_BLOCK_HEIGHT = 20 // px — floor so very short/zero-duration items stay visible

interface DragState {
  event: CalendarEvent
  startMouseY: number
  startMouseX: number
  eventDurationMs: number
}

/**
 * Greedy interval-partitioning layout (the standard "calendar overlap" algorithm):
 * assigns each item a column index + the total column count of its overlap
 * cluster, so concurrent items sit side-by-side instead of stacking and
 * inflating the row height.
 */
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
    if (colIdx === -1) {
      colIdx = columnEnds.length
      columnEnds.push(item.end)
    } else {
      columnEnds[colIdx] = item.end
    }
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

export default function CalendarPage() {
  const { language, tasks, setTasks, calendarAccounts, habits, setHabits } = useAppStore()
  const { toast } = useGlobalToast()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [externalEvents, setExternalEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [eventSaving, setEventSaving] = useState(false)

  // Drag state — use refs for drag internals to avoid re-renders during drag
  const dragRef = useRef<DragState | null>(null)
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{ dayIdx: number; hour: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Stable refs so closures inside event listeners always read the latest values
  const weekDaysRef = useRef<Date[]>([])
  const dragPreviewRef = useRef<{ dayIdx: number; hour: number } | null>(null)
  dragPreviewRef.current = dragPreview

  const locale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
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
    } catch {
      // External events are best-effort
    }
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

  const scheduledTasks = tasks.filter((task) => task.scheduledStart && task.scheduledEnd)

  const getDeadlineTasksForDay = (day: Date) =>
    tasks.filter((task) => {
      if (!task.deadline) return false
      if (task.scheduledStart) return false
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false
      return isSameDay(new Date(task.deadline), day)
    })

  const getAllDayEventsForDay = (day: Date) =>
    externalEvents.filter((ev) => ev.allDay && ev.start && isSameDay(new Date(ev.start), day))

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

  // Builds the duration-proportional, side-by-side-on-overlap blocks for one day column.
  const getDayBlocks = (day: Date): DayBlock[] => {
    type Raw = { id: string; kind: DayBlock['kind']; start: number; end: number; data: CalendarEvent | Task | Habit }
    const raw: Raw[] = []

    externalEvents.forEach((ev) => {
      if (ev.allDay || !ev.start) return
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
      title,
      start,
      end,
    }
    if (allDay !== undefined) body.allDay = allDay
    const res = await fetch('/api/calendar/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
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
      toast({ title: language === 'fr' ? 'Erreur lors de la mise à jour' : language === 'zh' ? '更新失敗' : 'Failed to update event', variant: 'error' })
    }
    setEventSaving(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Stable ref so drag mouseup closures can always call the latest handleSaveEvent
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
      toast({ title: language === 'fr' ? 'Erreur lors de la suppression' : language === 'zh' ? '刪除失敗' : 'Failed to delete event', variant: 'error' })
    }
  }

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
        toast({ title: language === 'fr' ? 'Événement modifié' : language === 'zh' ? '活動已更新' : 'Event updated', variant: 'success' })
      }
    } else {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks([...tasks, created])
        toast({ title: language === 'fr' ? 'Événement créé !' : language === 'zh' ? '活動已建立！' : 'Event created!', variant: 'success' })
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

  // --- Drag helpers ---

  const finalizeDrop = useCallback((drag: DragState, preview: { dayIdx: number; hour: number } | null) => {
    if (!preview) return
    const targetDay = weekDaysRef.current[preview.dayIdx]
    if (!targetDay) return

    if (preview.hour < 7) {
      // Dropped into all-day row
      const newStart = new Date(targetDay)
      newStart.setHours(0, 0, 0, 0)
      const newEnd = new Date(newStart)
      newEnd.setHours(23, 59, 59, 999)
      handleSaveEventRef.current(drag.event, drag.event.title, newStart.toISOString(), newEnd.toISOString(), true)
    } else {
      const newStart = new Date(targetDay)
      newStart.setHours(preview.hour, 0, 0, 0)
      const newEnd = new Date(newStart.getTime() + drag.eventDurationMs)
      handleSaveEventRef.current(drag.event, drag.event.title, newStart.toISOString(), newEnd.toISOString(), false)
    }
  }, [])

  const startDrag = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    if (!ev.editable) return
    e.preventDefault()
    e.stopPropagation()
    const durationMs = ev.start && ev.end
      ? new Date(ev.end as string).getTime() - new Date(ev.start as string).getTime()
      : 60 * 60 * 1000
    dragRef.current = {
      event: ev,
      startMouseY: e.clientY,
      startMouseX: e.clientX,
      eventDurationMs: durationMs,
    }
    setDraggingEventId(ev.id)

    const onMouseUp = () => {
      document.removeEventListener('mouseup', onMouseUp)
      const drag = dragRef.current
      const preview = dragPreviewRef.current
      dragRef.current = null
      setDraggingEventId(null)
      setDragPreview(null)
      if (drag) finalizeDrop(drag, preview)
    }
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeDrop])

  const startAllDayDrag = useCallback((e: React.MouseEvent, ev: CalendarEvent) => {
    if (!ev.editable) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      event: ev,
      startMouseY: e.clientY,
      startMouseX: e.clientX,
      eventDurationMs: 60 * 60 * 1000,
    }
    setDraggingEventId(ev.id)

    const onMouseUp = () => {
      document.removeEventListener('mouseup', onMouseUp)
      const drag = dragRef.current
      const preview = dragPreviewRef.current
      dragRef.current = null
      setDraggingEventId(null)
      setDragPreview(null)
      // Only drop if user dragged into time grid (hour >= 7)
      if (drag && preview && preview.hour >= 7) finalizeDrop(drag, preview)
    }
    document.addEventListener('mouseup', onMouseUp)
  }, [finalizeDrop])

  const handleCellMouseMove = useCallback((dayIdx: number, hour: number) => {
    if (dragRef.current) setDragPreview({ dayIdx, hour })
  }, [])

  const handleAllDayCellMouseMove = useCallback((dayIdx: number) => {
    if (dragRef.current) setDragPreview({ dayIdx, hour: 0 }) // hour < 7 → all-day
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-800" />
      </div>
    )
  }

  const isDragging = draggingEventId !== null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#ab3326]" />
            <h1 className="text-2xl font-brush text-[#2a2420]">{t('calendar', language)}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-[#5c5347] px-2 min-w-[160px] text-center">
              {format(weekStart, 'dd MMM', { locale })} – {format(weekEnd, 'dd MMM yyyy', { locale })}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
              {t('today', language)}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-[#a99873]" />}
          {calendarAccounts.length > 0 && (
            <div className="flex items-center gap-1.5" title={language === 'fr' ? 'Calendriers connectés' : language === 'zh' ? '已連接的日曆' : 'Connected calendars'}>
              {calendarAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white"
                  style={{ backgroundColor: acc.color }}
                  title={acc.name}
                />
              ))}
            </div>
          )}
          <Button size="sm" onClick={() => { setSelectedDate(new Date()); setShowTaskForm(true) }}>
            <Plus className="h-4 w-4" />
            {t('addTask', language)}
          </Button>
        </div>
      </div>

      <div className={cn('flex-1 overflow-auto', isDragging && 'cursor-grabbing select-none')}>
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-[#ece2cb] bg-[#fbf7ee] sticky top-0 z-10">
            <div className="py-3 px-2 text-xs text-[#a99873] border-r border-[#ece2cb]" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  'py-3 px-2 text-center border-r border-[#ece2cb]',
                  isToday(day) && 'bg-red-50'
                )}
              >
                <p className="text-xs text-[#8a7a5e] uppercase">{format(day, 'EEE', { locale })}</p>
                <p className={cn('text-sm font-semibold mt-0.5', isToday(day) ? 'text-red-800' : 'text-[#2a2420]')}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>

          {/* All-day / deadline row */}
          <div className="grid grid-cols-8 border-b-2 border-[#e2d6bc] bg-[#f3ecdd]/60">
            <div className="px-2 py-1.5 text-xs text-[#a99873] text-right border-r border-[#e2d6bc] flex items-start justify-end pt-2 shrink-0">
              {language === 'fr' ? 'Dû' : language === 'zh' ? '到期' : 'Due'}
            </div>
            {weekDays.map((day, dayIdx) => {
              const deadlineTasks = getDeadlineTasksForDay(day)
              const allDayEvs = getAllDayEventsForDay(day)
              const allDayHabits = getHabitsAllDayForDay(day)
              const total = deadlineTasks.length + allDayEvs.length + allDayHabits.length
              const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && (dragPreview?.hour ?? 7) < 7
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-r border-[#e2d6bc] px-1 py-1 min-h-[32px]',
                    isToday(day) && 'bg-red-50/40',
                    isPreviewHere && 'bg-red-100/60'
                  )}
                  onMouseMove={() => handleAllDayCellMouseMove(dayIdx)}
                >
                  {allDayEvs.map((ev) => {
                    const color = ev.color ?? calendarAccounts.find((a) => a.id === ev.calendarAccountId)?.color ?? '#6366F1'
                    const isDraggingThis = draggingEventId === ev.id
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border border-dashed',
                          ev.editable && !isDragging ? 'cursor-grab' : '',
                          isDraggingThis && 'opacity-40'
                        )}
                        style={{ backgroundColor: color + '22', borderColor: color }}
                        title={ev.title}
                        onMouseDown={(e) => { if (ev.editable) startAllDayDrag(e, ev) }}
                        onClick={(e) => { e.stopPropagation(); if (!isDragging) setEditingEvent(ev) }}
                      >
                        <span className="text-[#2a2420]">{ev.title}</span>
                      </div>
                    )
                  })}
                  {allDayHabits.map((habit) => {
                    const doneToday = isToday(day) ? (habit.completions?.length ?? 0) > 0 : false
                    return (
                      <div
                        key={habit.id}
                        className={cn('rounded px-1.5 py-0.5 text-xs mb-0.5 truncate border border-dashed select-none', doneToday && 'opacity-60')}
                        style={{ backgroundColor: habit.color + '18', borderColor: habit.color, color: habit.color }}
                        title={habit.title}
                      >
                        <span className={cn(doneToday && 'line-through')}>{habit.icon ?? '🔁'} {habit.title}</span>
                      </div>
                    )
                  })}
                  {deadlineTasks.slice(0, 3).map((task) => {
                    const qId = getQuadrant(task.importance, task.urgency)
                    const q = EISENHOWER_QUADRANTS.find((q) => q.id === qId)
                    const acc = calendarAccounts.find((a) => a.id === task.calendarAccountId)
                    const done = task.status === 'COMPLETED'
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        title={task.title}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs cursor-pointer mb-0.5 truncate border transition-all hover:shadow-sm',
                          done ? 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-70 line-through' : cn(q?.bgColor, q?.color)
                        )}
                        style={!done && acc ? { borderLeftColor: acc.color, borderLeftWidth: 3 } : {}}
                      >
                        {task.title}
                      </div>
                    )
                  })}
                  {deadlineTasks.length > 3 && (
                    <p className="text-xs text-[#a99873] px-1 leading-tight">
                      +{deadlineTasks.length - 3}
                    </p>
                  )}
                  {total === 0 && !isPreviewHere && (
                    <div className="h-5" />
                  )}
                  {/* Ghost preview in all-day row */}
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

          {/* Time grid — fixed-height hour rows (uniform spacing) with an absolutely
              positioned overlay whose blocks are sized proportionally to actual duration */}
          <div className="relative" ref={gridRef}>
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-[#f3ecdd] h-[60px]">
                <div className="px-2 py-1 text-xs text-[#a99873] text-right border-r border-[#ece2cb] w-12 shrink-0">
                  {hour}:00
                </div>
                {weekDays.map((day, dayIdx) => {
                  const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && dragPreview?.hour === hour
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'border-r border-[#ece2cb] cursor-pointer hover:bg-[#f3ecdd] transition-colors',
                        isToday(day) && 'bg-red-50/30',
                        isPreviewHere && 'bg-red-100/40'
                      )}
                      onClick={() => handleCellClick(day, hour)}
                      onMouseMove={() => handleCellMouseMove(dayIdx, hour)}
                    />
                  )
                })}
              </div>
            ))}

            <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
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
                            onClick={(e) => { e.stopPropagation(); if (ev.editable && !isDragging) setEditingEvent(ev) }}
                            onMouseDown={(e) => { if (ev.editable) startDrag(e, ev) }}
                            className={cn(
                              'pointer-events-auto rounded-lg px-2 py-1 text-xs border border-dashed overflow-hidden',
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
                        return (
                          <div
                            key={block.id}
                            onClick={(e) => { e.stopPropagation(); handleTaskClick(task) }}
                            className={cn(
                              'pointer-events-auto rounded-lg px-2 py-1 text-xs cursor-pointer border transition-all hover:shadow-sm overflow-hidden',
                              done ? 'bg-emerald-50 border-emerald-200 text-emerald-700 opacity-70' : cn(q?.bgColor, q?.color)
                            )}
                            style={{ ...boxStyle, ...(!done && acc ? { borderLeftColor: acc.color, borderLeftWidth: 3 } : {}) }}
                          >
                            <p className={cn('font-medium truncate', done && 'line-through')}>{task.title}</p>
                            {task.scheduledStart && task.scheduledEnd && (
                              <p className="opacity-70 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(task.scheduledStart)} – {formatTime(task.scheduledEnd)}
                              </p>
                            )}
                          </div>
                        )
                      }

                      const habit = block.data
                      const doneToday = habit.completions?.length ?? 0
                      return (
                        <div
                          key={block.id}
                          title={habit.title}
                          className={cn(
                            'pointer-events-auto rounded-lg px-2 py-1 text-xs border select-none overflow-hidden',
                            doneToday > 0 ? 'border-emerald-200 opacity-60' : 'border-dashed'
                          )}
                          style={{ ...boxStyle, backgroundColor: habit.color + '18', borderColor: habit.color, color: habit.color }}
                        >
                          <p className={cn('font-medium truncate', doneToday > 0 && 'line-through')}>
                            {habit.icon ?? '🔁'} {habit.title}
                          </p>
                          {habit.durationMinutes && (
                            <p className="opacity-70 text-[10px]">{habit.durationMinutes} min</p>
                          )}
                        </div>
                      )
                    })}

                    {/* Ghost preview for the event currently being dragged */}
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

      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); setSelectedDate(null) }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={editingTask}
        calendarAccounts={calendarAccounts}
        lang={language}
      />

      {/* Edit Google Calendar event modal */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          lang={language}
          saving={eventSaving}
          tasks={tasks}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  )
}

function EditEventModal({
  event, lang, saving, tasks, onSave, onDelete, onClose,
}: {
  event: CalendarEvent
  lang: 'fr' | 'en' | 'zh'
  saving: boolean
  tasks: Task[]
  onSave: (ev: CalendarEvent, title: string, start: string, end: string) => void
  onDelete: (ev: CalendarEvent) => void
  onClose: () => void
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

  // Find retroplanning chains linked to this event by title keywords
  const relatedChains = React.useMemo(() => {
    const words = event.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    return tasks.filter((t) =>
      t.parentTaskId &&
      words.some((w) => t.title.toLowerCase().includes(w))
    )
  }, [event.title, tasks])

  // Extract URLs from description
  const links = React.useMemo(() => {
    if (!event.description) return []
    const urlRe = /https?:\/\/[^\s<>"]+/g
    return Array.from(new Set(event.description.match(urlRe) ?? []))
  }, [event.description])

  const evColor = event.color ?? '#ab3326'

  if (editing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-[#fbf7ee] rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2a2420] flex items-center gap-2">
              <Pencil className="h-4 w-4 text-red-500" />
              {lang === 'fr' ? "Modifier l'événement" : lang === 'zh' ? '編輯活動' : 'Edit event'}
            </h2>
            <button onClick={() => setEditing(false)} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-[#8a7a5e] mb-1 block">{lang === 'fr' ? 'Titre' : lang === 'zh' ? '標題' : 'Title'}</label>
              <input
                className="w-full border border-[#e2d6bc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#8a7a5e] mb-1 block">{lang === 'fr' ? 'Début' : lang === 'zh' ? '開始' : 'Start'}</label>
                <input
                  type="datetime-local"
                  className="w-full border border-[#e2d6bc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#8a7a5e] mb-1 block">{lang === 'fr' ? 'Fin' : lang === 'zh' ? '結束' : 'End'}</label>
                <input
                  type="datetime-local"
                  className="w-full border border-[#e2d6bc] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button
              onClick={() => onDelete(event)}
              className="flex-1 rounded-xl border border-red-200 text-red-600 text-sm py-2 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4 inline mr-1" />
              {lang === 'fr' ? 'Supprimer' : lang === 'zh' ? '刪除' : 'Delete'}
            </button>
            <button
              onClick={() => onSave(event, title, new Date(start).toISOString(), new Date(end).toISOString())}
              disabled={saving}
              className="flex-1 rounded-xl bg-[#ab3326] text-white text-sm py-2 hover:bg-[#861f17] transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (lang === 'fr' ? 'Enregistrer' : lang === 'zh' ? '儲存' : 'Save')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Detail view (default)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-[#fbf7ee] rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Colour accent bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: evColor }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold text-[#2a2420] leading-snug">{event.title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873] shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            {/* Time */}
            {!event.allDay && event.start && event.end && (
              <div className="flex items-center gap-2 text-[#5c5347]">
                <Clock className="h-4 w-4 text-[#a99873] shrink-0" />
                <span>{formatTime(event.start)} – {formatTime(event.end)}</span>
              </div>
            )}
            {event.allDay && (
              <div className="flex items-center gap-2 text-[#5c5347]">
                <Clock className="h-4 w-4 text-[#a99873] shrink-0" />
                <span>{lang === 'fr' ? 'Toute la journée' : lang === 'zh' ? '整天' : 'All day'}</span>
              </div>
            )}

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-2 text-[#5c5347]">
                <MapPin className="h-4 w-4 text-[#a99873] shrink-0 mt-0.5" />
                <span className="break-words">{event.location}</span>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-2">
                <AlignLeft className="h-4 w-4 text-[#a99873] shrink-0 mt-0.5" />
                <p className="text-[#5c5347] text-xs leading-relaxed whitespace-pre-wrap break-words line-clamp-6">
                  {event.description}
                </p>
              </div>
            )}

            {/* Extracted links */}
            {links.length > 0 && (
              <div className="flex flex-col gap-1">
                {links.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[#ab3326] hover:underline truncate"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {url.replace(/^https?:\/\//, '').split('/')[0]}
                  </a>
                ))}
              </div>
            )}

            {/* Open in Google Calendar */}
            {event.htmlLink && (
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#8a7a5e] hover:text-[#ab3326] transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {lang === 'fr' ? 'Ouvrir dans Google Calendar' : lang === 'zh' ? '在 Google 日曆中開啟' : 'Open in Google Calendar'}
              </a>
            )}

            {/* Related retroplanning chains */}
            {relatedChains.length > 0 && (
              <div className="border-t border-[#ece2cb] pt-3 mt-1">
                <p className="text-xs font-semibold text-[#8a7a5e] flex items-center gap-1.5 mb-2">
                  <GitBranch className="h-3.5 w-3.5" />
                  {lang === 'fr' ? 'Rétroplanning lié' : lang === 'zh' ? '關聯逆向規劃' : 'Related retroplanning'}
                </p>
                <div className="flex flex-col gap-1">
                  {relatedChains.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 bg-[#f3ecdd] border border-[#ece2cb]">
                      <span className="text-[#3a3326] truncate flex-1">{t.title}</span>
                      {t.deadline && (
                        <span className="text-[#a99873] ml-2 shrink-0">
                          {new Date(t.deadline).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {event.editable && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-[#ece2cb]">
              <button
                onClick={() => onDelete(event)}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 text-red-600 text-xs px-3 py-2 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {lang === 'fr' ? 'Supprimer' : lang === 'zh' ? '刪除' : 'Delete'}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#ab3326] text-white text-xs px-3 py-2 hover:bg-[#861f17] transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                {lang === 'fr' ? 'Modifier' : lang === 'zh' ? '編輯' : 'Edit'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

}
