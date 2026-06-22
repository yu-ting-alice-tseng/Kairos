'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, CalendarEvent } from '@/types'
import { t } from '@/lib/i18n'
import { EisenhowerMatrix } from '@/components/matrix/EisenhowerMatrix'
import { GoalsSection } from '@/components/matrix/GoalsSection'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, Loader2, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn, formatTime } from '@/lib/utils'
import { startOfDay, endOfDay } from 'date-fns'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function MatrixPage() {
  const { language, tasks, setTasks, calendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)

  // Feature 3: sub-calendar filter
  const [filterAccountId, setFilterAccountId] = useState<string | 'all'>('all')

  // Feature 2: calendar import panel
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [todayEventsLoading, setTodayEventsLoading] = useState(false)
  const [importedEventIds, setImportedEventIds] = useState<Set<string>>(new Set())
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
        const nonAllDay = events.filter((e) => !e.allDay)
        setTodayEvents(nonAllDay)
        setCalendarPanelOpen(nonAllDay.length > 0)
      }
    } catch {
      // best-effort
    }
    setTodayEventsLoading(false)
  }, [calendarAccounts.length])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => { loadTodayEvents() }, [loadTodayEvents])

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
      toast({ title: language === 'fr' ? 'Tâche créée depuis l\'événement' : 'Task created from event', variant: 'success' })
    } else {
      toast({ title: language === 'fr' ? 'Erreur lors de l\'import' : 'Failed to import event', variant: 'error' })
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
      toast({ title: language === 'fr' ? 'Tâche déplacée' : 'Task moved', variant: 'info' })
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

  const handleTaskClick = (task: Task) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  // Feature 3: filter tasks by calendar account
  const filteredTasks = filterAccountId === 'all'
    ? tasks
    : tasks.filter((t) => t.calendarAccountId === filterAccountId)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">{t('matrix', language)}</h1>
          </div>
          <span className="text-sm text-gray-500">
            {language === 'fr' ? 'Glissez les tâches pour les prioriser' : 'Drag tasks to prioritize'}
          </span>
          {/* Feature 3: calendar filter dropdown */}
          {calendarAccounts.length > 0 && (
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="all">{language === 'fr' ? 'Tous les calendriers' : 'All calendars'}</option>
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
          <div className="mb-6 border border-gray-200 rounded-2xl bg-white overflow-hidden">
            <button
              onClick={() => setCalendarPanelOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
                {language === 'fr' ? "Événements d'aujourd'hui" : "Today's events"}
                {todayEventsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
                {!todayEventsLoading && (
                  <span className="text-xs font-normal text-gray-400">
                    ({todayEvents.length - importedEventIds.size > 0
                      ? `${todayEvents.length - importedEventIds.size} ${language === 'fr' ? 'à importer' : 'to import'}`
                      : language === 'fr' ? 'aucun' : 'none'})
                  </span>
                )}
              </div>
              {calendarPanelOpen
                ? <ChevronUp className="h-4 w-4 text-gray-400" />
                : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {calendarPanelOpen && (
              <div className="px-4 pb-4 border-t border-gray-100">
                {todayEvents.length === 0 && !todayEventsLoading && (
                  <p className="text-sm text-gray-400 py-3 text-center">
                    {language === 'fr' ? 'Aucun événement aujourd\'hui' : 'No events today'}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-3">
                  {todayEvents.map((ev) => {
                    const isImported = importedEventIds.has(ev.id)
                    const acc = calendarAccounts.find((a) => a.id === ev.calendarAccountId)
                    const color = ev.color ?? acc?.color ?? '#6366F1'
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          'flex items-center gap-2 border rounded-xl px-3 py-2 text-xs transition-all',
                          isImported
                            ? 'border-gray-100 bg-gray-50 opacity-60'
                            : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-sm'
                        )}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-gray-800 max-w-[160px] truncate">{ev.title}</span>
                        {ev.start && ev.end && (
                          <span className="text-gray-400 whitespace-nowrap">
                            {formatTime(ev.start)} – {formatTime(ev.end)}
                          </span>
                        )}
                        {isImported ? (
                          <span className="text-green-500 font-medium ml-1">
                            {language === 'fr' ? 'importé' : 'imported'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImportEvent(ev)}
                            className="ml-1 flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                            title={language === 'fr' ? 'Importer comme tâche' : 'Import as task'}
                          >
                            <Plus className="h-3 w-3" />
                            {language === 'fr' ? 'Importer' : 'Import'}
                          </button>
                        )}
                      </div>
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
