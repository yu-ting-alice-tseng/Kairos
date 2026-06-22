'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, CalendarEvent } from '@/types'
import { t } from '@/lib/i18n'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Button } from '@/components/ui/button'
import { cn, formatTime, getQuadrant, EISENHOWER_QUADRANTS } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, Clock, Loader2, Pencil, Trash2, X,
} from 'lucide-react'
import {
  format, startOfWeek, endOfWeek, addDays, isSameDay, addWeeks, subWeeks,
  isToday, getHours,
} from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

interface DragState {
  event: CalendarEvent
  startMouseY: number
  startMouseX: number
  eventDurationMs: number
}

export default function CalendarPage() {
  const { language, tasks, setTasks, calendarAccounts } = useAppStore()
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

  const locale = language === 'fr' ? fr : enUS
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

  const getTasksForDayHour = (day: Date, hour: number) =>
    scheduledTasks.filter((task) => {
      if (!task.scheduledStart) return false
      const start = new Date(task.scheduledStart)
      return isSameDay(start, day) && getHours(start) === hour
    })

  const getEventsForDayHour = (day: Date, hour: number) =>
    externalEvents.filter((ev) => {
      if (!ev.start || ev.allDay) return false
      const start = new Date(ev.start)
      return isSameDay(start, day) && getHours(start) === hour
    })

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
      toast({ title: language === 'fr' ? 'Événement mis à jour' : 'Event updated', variant: 'success' })
      setEditingEvent(null)
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de la mise à jour' : 'Failed to update event', variant: 'error' })
    }
    setEventSaving(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // Stable ref so drag mouseup closures can always call the latest handleSaveEvent
  const handleSaveEventRef = useRef(handleSaveEvent)
  handleSaveEventRef.current = handleSaveEvent

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    if (!confirm(language === 'fr' ? 'Supprimer cet événement ?' : 'Delete this event?')) return
    const res = await fetch('/api/calendar/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: ev.id, calendarAccountId: ev.calendarAccountId, calendarId: ev.calendarId }),
    })
    if (res.ok) {
      setExternalEvents((prev) => prev.filter((e) => e.id !== ev.id))
      toast({ title: language === 'fr' ? 'Événement supprimé' : 'Event deleted', variant: 'success' })
      setEditingEvent(null)
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de la suppression' : 'Failed to delete event', variant: 'error' })
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
        toast({ title: language === 'fr' ? 'Événement modifié' : 'Event updated', variant: 'success' })
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
        toast({ title: language === 'fr' ? 'Événement créé !' : 'Event created!', variant: 'success' })
      }
    }
    setEditingTask(null)
    setSelectedDate(null)
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
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const isDragging = draggingEventId !== null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">{t('calendar', language)}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 px-2 min-w-[160px] text-center">
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
          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          {calendarAccounts.length > 0 && (
            <div className="flex items-center gap-1.5" title={language === 'fr' ? 'Calendriers connectés' : 'Connected calendars'}>
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
          <div className="grid grid-cols-8 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div className="py-3 px-2 text-xs text-gray-400 border-r border-gray-100" />
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  'py-3 px-2 text-center border-r border-gray-100',
                  isToday(day) && 'bg-indigo-50'
                )}
              >
                <p className="text-xs text-gray-500 uppercase">{format(day, 'EEE', { locale })}</p>
                <p className={cn('text-sm font-semibold mt-0.5', isToday(day) ? 'text-indigo-600' : 'text-gray-900')}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>

          {/* All-day / deadline row */}
          <div className="grid grid-cols-8 border-b-2 border-gray-200 bg-gray-50/60">
            <div className="px-2 py-1.5 text-xs text-gray-400 text-right border-r border-gray-200 flex items-start justify-end pt-2 shrink-0">
              {language === 'fr' ? 'Dû' : 'Due'}
            </div>
            {weekDays.map((day, dayIdx) => {
              const deadlineTasks = getDeadlineTasksForDay(day)
              const allDayEvs = getAllDayEventsForDay(day)
              const total = deadlineTasks.length + allDayEvs.length
              const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && (dragPreview?.hour ?? 7) < 7
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-r border-gray-200 px-1 py-1 min-h-[32px]',
                    isToday(day) && 'bg-indigo-50/40',
                    isPreviewHere && 'bg-indigo-100/60'
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
                        style={{ backgroundColor: color + '15', borderColor: color, color }}
                        title={ev.title}
                        onMouseDown={(e) => { if (ev.editable) startAllDayDrag(e, ev) }}
                      >
                        {ev.title}
                      </div>
                    )
                  })}
                  {deadlineTasks.slice(0, 3).map((task) => {
                    const qId = getQuadrant(task.importance, task.urgency)
                    const q = EISENHOWER_QUADRANTS.find((q) => q.id === qId)
                    const acc = calendarAccounts.find((a) => a.id === task.calendarAccountId)
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        title={task.title}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs cursor-pointer mb-0.5 truncate border transition-all hover:shadow-sm hover:brightness-95',
                          q?.bgColor, q?.color
                        )}
                        style={acc ? { borderLeftColor: acc.color, borderLeftWidth: 3 } : {}}
                      >
                        {task.title}
                      </div>
                    )
                  })}
                  {deadlineTasks.length > 3 && (
                    <p className="text-xs text-gray-400 px-1 leading-tight">
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

          {/* Time grid */}
          <div className="relative" ref={gridRef}>
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-50 min-h-[56px]">
                <div className="px-2 py-1 text-xs text-gray-400 text-right border-r border-gray-100 w-12 shrink-0">
                  {hour}:00
                </div>
                {weekDays.map((day, dayIdx) => {
                  const cellTasks = getTasksForDayHour(day, hour)
                  const cellEvents = getEventsForDayHour(day, hour)
                  const isEmpty = cellTasks.length === 0 && cellEvents.length === 0
                  const isPreviewHere = isDragging && dragPreview?.dayIdx === dayIdx && dragPreview?.hour === hour
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'border-r border-gray-100 px-1 py-0.5 cursor-pointer hover:bg-gray-50 transition-colors min-h-[56px]',
                        isToday(day) && 'bg-indigo-50/30',
                        isPreviewHere && 'bg-indigo-100/40'
                      )}
                      onClick={() => isEmpty && !isDragging && handleCellClick(day, hour)}
                      onMouseMove={() => handleCellMouseMove(dayIdx, hour)}
                    >
                      {/* External calendar events — dashed border to distinguish from tasks */}
                      {cellEvents.map((ev) => {
                        const evColor = ev.color ?? calendarAccounts.find((a) => a.id === ev.calendarAccountId)?.color ?? '#6366F1'
                        const isDraggingThis = draggingEventId === ev.id
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => { e.stopPropagation(); if (ev.editable && !isDragging) setEditingEvent(ev) }}
                            onMouseDown={(e) => { if (ev.editable) startDrag(e, ev) }}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs mb-0.5 border border-dashed',
                              ev.editable ? 'cursor-grab hover:brightness-95' : 'select-none',
                              isDraggingThis && 'opacity-40'
                            )}
                            style={{
                              backgroundColor: evColor + '1a',
                              borderColor: evColor,
                              color: evColor,
                            }}
                          >
                            <p className="font-medium truncate">{ev.title}</p>
                            {ev.start && ev.end && (
                              <p className="opacity-70 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(ev.start)} – {formatTime(ev.end)}
                              </p>
                            )}
                          </div>
                        )
                      })}

                      {/* Ghost/preview for dragged event in this cell */}
                      {isPreviewHere && dragRef.current && (() => {
                        const drag = dragRef.current!
                        const evColor = drag.event.color ?? calendarAccounts.find((a) => a.id === drag.event.calendarAccountId)?.color ?? '#6366F1'
                        return (
                          <div
                            className="rounded-lg px-2 py-1 text-xs mb-0.5 border-2 border-dashed pointer-events-none"
                            style={{
                              backgroundColor: evColor + '30',
                              borderColor: evColor,
                              color: evColor,
                            }}
                          >
                            <p className="font-medium truncate">{drag.event.title}</p>
                          </div>
                        )
                      })()}

                      {/* FlowPlan tasks */}
                      {cellTasks.map((task) => {
                        const qId = getQuadrant(task.importance, task.urgency)
                        const q = EISENHOWER_QUADRANTS.find((q) => q.id === qId)
                        const acc = calendarAccounts.find((a) => a.id === task.calendarAccountId)
                        return (
                          <div
                            key={task.id}
                            onClick={(e) => { e.stopPropagation(); handleTaskClick(task) }}
                            className={cn(
                              'rounded-lg px-2 py-1 text-xs cursor-pointer mb-0.5 border transition-all hover:shadow-sm',
                              q?.bgColor, q?.color
                            )}
                            style={acc ? { borderLeftColor: acc.color, borderLeftWidth: 3 } : {}}
                          >
                            <p className="font-medium truncate">{task.title}</p>
                            {task.scheduledStart && task.scheduledEnd && (
                              <p className="opacity-70 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(task.scheduledStart)} – {formatTime(task.scheduledEnd)}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null); setSelectedDate(null) }}
        onSave={handleSaveTask}
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
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  )
}

function EditEventModal({
  event, lang, saving, onSave, onDelete, onClose,
}: {
  event: CalendarEvent
  lang: 'fr' | 'en'
  saving: boolean
  onSave: (ev: CalendarEvent, title: string, start: string, end: string) => void
  onDelete: (ev: CalendarEvent) => void
  onClose: () => void
}) {
  const toLocal = (d: Date | string) => {
    const dt = new Date(d)
    const offset = dt.getTimezoneOffset() * 60000
    return new Date(dt.getTime() - offset).toISOString().slice(0, 16)
  }
  const [title, setTitle] = React.useState(event.title)
  const [start, setStart] = React.useState(toLocal(event.start))
  const [end, setEnd] = React.useState(toLocal(event.end))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-indigo-500" />
            {lang === 'fr' ? 'Modifier l\'événement' : 'Edit event'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">{lang === 'fr' ? 'Titre' : 'Title'}</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{lang === 'fr' ? 'Début' : 'Start'}</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">{lang === 'fr' ? 'Fin' : 'End'}</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => onDelete(event)}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {lang === 'fr' ? 'Supprimer' : 'Delete'}
          </button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>{lang === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button size="sm" disabled={saving} onClick={() => onSave(event, title, new Date(start).toISOString(), new Date(end).toISOString())}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (lang === 'fr' ? 'Enregistrer' : 'Save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
