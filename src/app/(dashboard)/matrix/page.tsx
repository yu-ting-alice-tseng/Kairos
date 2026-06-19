'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore, AppState } from '@/stores/useAppStore'
import { Task, CalendarEvent, Habit } from '@/types'
import { t } from '@/lib/i18n'
import { EisenhowerMatrix } from '@/components/matrix/EisenhowerMatrix'
import { GoalsSection } from '@/components/matrix/GoalsSection'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, Loader2, CalendarDays, ChevronDown, ChevronUp, Repeat2, CheckCircle2, Circle } from 'lucide-react'
import { Candle } from '@/components/ui/Candle'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn, formatTime } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function MatrixPage() {
  const { language, tasks, setTasks, calendarAccounts, habits, setHabits } = useAppStore()
  const matrixExcludePatterns = useAppStore((s: AppState) => s.matrixExcludePatterns)
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)

  // Feature 3: sub-calendar filter
  const [filterAccountId, setFilterAccountId] = useState<string | 'all'>('all')

  // Habits panel
  const [habitPanelOpen, setHabitPanelOpen] = useState(true)

  // Feature 2: calendar import panel
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [todayEventsLoading, setTodayEventsLoading] = useState(false)
  const [importedEventIds, setImportedEventIds] = useState<Set<string>>(new Set())
  const [importedHabitEventIds, setImportedHabitEventIds] = useState<Set<string>>(new Set())
  const [calendarPanelOpen, setCalendarPanelOpen] = useState(false)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }, [setTasks])

  const loadTodayEvents = useCallback(async () => {
    if (calendarAccounts.length === 0) return
    setTodayEventsLoading(true)
    try {
      const today = new Date()
      const start = startOfDay(today).toISOString()
      const end = endOfDay(today).toISOString()
      const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`)
      if (res.ok) {
        const events: CalendarEvent[] = await res.json()
        setTodayEvents(events)
        setCalendarPanelOpen(events.length > 0)
        setImportedEventIds(new Set(events.map((e) => e.id)))

        // Auto-import non-allDay events that don't already have a matching task
        const tasksSnap = useAppStore.getState().tasks
        const existingEventIds = new Set(tasksSnap.map((t) => t.calendarEventId).filter(Boolean))
        const toImport = events.filter((ev) => !ev.allDay && !existingEventIds.has(ev.id))
        if (toImport.length > 0) {
          const created = (await Promise.all(
            toImport.map((ev) =>
              fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: ev.title,
                  importance: 5,
                  urgency: 5,
                  scheduledStart: ev.start,
                  scheduledEnd: ev.end,
                  calendarAccountId: ev.calendarAccountId,
                  calendarEventId: ev.id,
                }),
              }).then((r) => r.ok ? r.json() : null)
            )
          )).filter(Boolean)
          if (created.length > 0) {
            setTasks([...useAppStore.getState().tasks, ...created])
            setImportedEventIds(new Set(events.map((e) => e.id)))
          }
        }
      }
    } catch {
      // best-effort
    }
    setTodayEventsLoading(false)
  }, [calendarAccounts.length, setTasks])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => { loadTodayEvents() }, [loadTodayEvents])
  useEffect(() => {
    if (habits.length === 0) {
      fetch('/api/habits').then((r) => r.json()).then(setHabits).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleImportEvent = async (ev: CalendarEvent) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ev.title,
        importance: 5,
        urgency: 5,
        scheduledStart: ev.start,
        scheduledEnd: ev.end,
        calendarAccountId: ev.calendarAccountId,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setTasks([...tasks, created])
      setImportedEventIds((prev) => new Set([...prev, ev.id]))
      toast({ title: language === 'fr' ? 'Tâche créée depuis l\'événement' : language === 'zh' ? '已從活動建立任務' : 'Task created from event', variant: 'success' })
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de l\'import' : language === 'zh' ? '匯入活動失敗' : 'Failed to import event', variant: 'error' })
    }
  }

  const handleImportEventAsHabit = async (ev: CalendarEvent) => {
    const acc = calendarAccounts.find((a) => a.id === ev.calendarAccountId)
    const color = ev.color ?? acc?.color ?? '#10B981'
    const scheduledTime = ev.start
      ? `${String(new Date(ev.start).getHours()).padStart(2, '0')}:${String(new Date(ev.start).getMinutes()).padStart(2, '0')}`
      : undefined
    const durationMinutes = ev.start && ev.end
      ? Math.max(5, Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000))
      : undefined
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ev.title,
        color,
        frequency: 'DAILY',
        scheduledTime,
        durationMinutes,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setHabits([...habits, created])
      setImportedHabitEventIds((prev) => new Set([...prev, ev.id]))
      toast({ title: language === 'fr' ? 'Habitude créée depuis l\'événement' : language === 'zh' ? '已從活動建立習慣' : 'Habit created from event', variant: 'success' })
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de l\'import' : language === 'zh' ? '匯入活動失敗' : 'Failed to import event', variant: 'error' })
    }
  }

  const handleTaskUpdate = async (id: string, importance: number, urgency: number) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importance, urgency }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(tasks.map((t) => t.id === id ? updated : t))
      toast({ title: language === 'fr' ? 'Tâche déplacée' : language === 'zh' ? '任務已移動' : 'Task moved', variant: 'info' })
    }
  }

  const handleSaveTask = async (data: Partial<Task>) => {
    if (editingTask) {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) setTasks(tasks.map((t) => t.id === editingTask.id ? { ...t, ...data } : t))
    } else {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks([...tasks, created])
      }
    }
    setEditingTask(null)
  }

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(tasks.filter((t) => t.id !== id))
    setEditingTask(null)
  }

  const handleTaskClick = (task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  const handleCompleteHabit = async (habitId: string) => {
    const res = await fetch('/api/habits/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habitId }) })
    if (res.ok) {
      const { streak } = await res.json()
      setHabits(habits.map((h) => h.id === habitId ? { ...h, streak, completions: [{ id: 'tmp', habitId, completedAt: new Date().toISOString() }] } : h))
    }
  }

  const handleUncompleteHabit = async (habitId: string) => {
    const res = await fetch('/api/habits/complete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ habitId }) })
    if (res.ok) {
      const { streak } = await res.json()
      setHabits(habits.map((h) => h.id === habitId ? { ...h, streak, completions: [] } : h))
    }
  }

  const todayHabits = (() => {
    const dow = new Date().getDay()
    return habits.filter((h) => {
      if (!h.isActive) return false
      if (h.frequency === 'DAILY') return true
      if (h.frequency === 'WEEKDAYS') return dow >= 1 && dow <= 5
      if (h.frequency === 'WEEKENDS') return dow === 0 || dow === 6
      return false
    })
  })()

  const isExcludedFromMatrix = (title: string) =>
    matrixExcludePatterns.some((p) => p && title.toLowerCase().includes(p.toLowerCase()))

  // Feature 3: filter tasks by calendar account + exclusion patterns
  const filteredTasks = (filterAccountId === 'all' ? tasks : tasks.filter((t) => t.calendarAccountId === filterAccountId))
    .filter((t) => !isExcludedFromMatrix(t.title))

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-red-800" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#ece2cb] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-red-800" />
            <h1 className="text-xl font-bold text-[#2a2420]">{t('matrix', language)}</h1>
          </div>
          <span className="text-sm text-[#8a7a5e]">
            {language === 'fr' ? 'Glissez les tâches pour les prioriser' : language === 'zh' ? '拖曳任務以排定優先順序' : 'Drag tasks to prioritize'}
          </span>
          {/* Feature 3: calendar filter dropdown */}
          {calendarAccounts.length > 0 && (
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="text-sm border border-[#e2d6bc] rounded-lg px-2 py-1 text-[#5c5347] focus:outline-none focus:ring-2 focus:ring-red-300 bg-[#fbf7ee]"
            >
              <option value="all">{language === 'fr' ? 'Tous les calendriers' : language === 'zh' ? '所有日曆' : 'All calendars'}</option>
              {calendarAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          )}
        </div>
        <Button size="sm" onClick={() => setShowTaskForm(true)}>
          <Plus className="h-4 w-4" />
          {t('addTask', language)}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <GoalsSection lang={language} />

        {/* Feature 2: CalendarImport panel */}
        {calendarAccounts.length > 0 && (
          <div className="mb-6 border border-[#e2d6bc] rounded-2xl bg-[#fbf7ee] overflow-hidden">
            <button
              onClick={() => setCalendarPanelOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f3ecdd] transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-[#5c5347]">
                <CalendarDays className="h-4 w-4 text-red-500" />
                {language === 'fr' ? "Événements d'aujourd'hui" : language === 'zh' ? '今日活動' : "Today's events"}
                {todayEventsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#a99873]" />}
                {!todayEventsLoading && (
                  <span className="text-xs font-normal text-[#a99873]">
                    ({todayEvents.length - importedEventIds.size > 0
                      ? `${todayEvents.length - importedEventIds.size} ${language === 'fr' ? 'à importer' : language === 'zh' ? '待匯入' : 'to import'}`
                      : language === 'fr' ? 'aucun' : language === 'zh' ? '無' : 'none'})
                  </span>
                )}
              </div>
              {calendarPanelOpen
                ? <ChevronUp className="h-4 w-4 text-[#a99873]" />
                : <ChevronDown className="h-4 w-4 text-[#a99873]" />}
            </button>

            {calendarPanelOpen && (
              <div className="px-4 pb-4 border-t border-[#ece2cb]">
                {todayEvents.length === 0 && !todayEventsLoading && (
                  <p className="text-sm text-[#a99873] py-3 text-center">
                    {language === 'fr' ? 'Aucun événement aujourd\'hui' : language === 'zh' ? '今日沒有活動' : 'No events today'}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-3">
                  {todayEvents.map((ev) => {
                    const isImported = importedEventIds.has(ev.id)
                    const isImportedHabit = importedHabitEventIds.has(ev.id)
                    const acc = calendarAccounts.find((a) => a.id === ev.calendarAccountId)
                    const color = ev.color ?? acc?.color ?? '#6366F1'
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          'flex items-center gap-2 border rounded-xl px-3 py-2 text-xs transition-all',
                          isImported && isImportedHabit
                            ? 'border-[#ece2cb] bg-[#f3ecdd] opacity-60'
                            : 'border-[#e2d6bc] bg-[#fbf7ee] hover:border-red-200 hover:shadow-sm'
                        )}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-[#3a3326] max-w-[160px] truncate">{ev.title}</span>
                        {ev.allDay ? (
                          <span className="text-[#a99873] whitespace-nowrap text-[10px] italic">
                            {language === 'fr' ? 'Journée' : language === 'zh' ? '整天' : 'All day'}
                          </span>
                        ) : ev.start && ev.end && (
                          <span className="text-[#a99873] whitespace-nowrap">
                            {formatTime(ev.start)} – {formatTime(ev.end)}
                          </span>
                        )}

                        <span className="text-green-500 font-medium ml-1">
                          {language === 'fr' ? '✓ Auto-importé' : language === 'zh' ? '✓ 已自動匯入' : '✓ Auto-imported'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Habits panel */}
        {todayHabits.length > 0 && (
          <div className="mb-6 border border-[#e2d6bc] rounded-2xl bg-[#fbf7ee] overflow-hidden">
            <button
              onClick={() => setHabitPanelOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#f3ecdd] transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-[#5c5347]">
                <Repeat2 className="h-4 w-4 text-amber-500" />
                {language === 'fr' ? "Habitudes du jour" : language === 'zh' ? '今日習慣' : "Today's habits"}
                <span className="text-xs font-normal text-[#a99873]">
                  ({todayHabits.filter((h) => ((h as Habit & { completions?: { id: string }[] }).completions?.length ?? 0) > 0).length}/{todayHabits.length})
                </span>
              </div>
              {habitPanelOpen ? <ChevronUp className="h-4 w-4 text-[#a99873]" /> : <ChevronDown className="h-4 w-4 text-[#a99873]" />}
            </button>
            {habitPanelOpen && (
              <div className="px-4 pb-4 border-t border-[#ece2cb]">
                <div className="flex flex-wrap gap-2 pt-3">
                  {todayHabits.map((habit) => {
                    const doneToday = ((habit as Habit & { completions?: { id: string }[] }).completions?.length ?? 0) > 0
                    return (
                      <button
                        key={habit.id}
                        onClick={() => doneToday ? handleUncompleteHabit(habit.id) : handleCompleteHabit(habit.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition-all',
                          doneToday
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                            : 'bg-[#fbf7ee] border-[#e2d6bc] text-[#5c5347] hover:border-amber-300 hover:bg-amber-50'
                        )}
                      >
                        {doneToday
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          : <Circle className="h-3.5 w-3.5 text-[#cbb98e]" />
                        }
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                        <span className={cn(doneToday && 'line-through')}>{habit.icon} {habit.title}</span>
                        {habit.scheduledTime && <span className="text-xs opacity-60">{habit.scheduledTime}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <EisenhowerMatrix
          tasks={filteredTasks}
          onTaskUpdate={handleTaskUpdate}
          onTaskClick={handleTaskClick}
          lang={language}
        />
      </div>

      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null) }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={editingTask}
        calendarAccounts={calendarAccounts}
        lang={language}
        onRetroplanCreated={loadTasks}
      />

      {AI_ENABLED && (
        <BreakdownDialog
          open={!!breakdownTask}
          onClose={() => setBreakdownTask(null)}
          task={breakdownTask}
          onAccept={async () => { await loadTasks() }}
          lang={language}
        />
      )}
    </div>
  )
}
