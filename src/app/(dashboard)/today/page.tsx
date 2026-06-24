'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, Habit, CalendarEvent } from '@/types'
import { t } from '@/lib/i18n'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { AIChat } from '@/components/ai/AIChat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sundial } from '@/components/ui/Sundial'
import { Candle } from '@/components/ui/Candle'
import { InkLoader } from '@/components/ui/InkLoader'
import { generatePriorityList, formatDate, formatTime, cn } from '@/lib/utils'
import {
  Plus, Sparkles, Sun, Flame, RefreshCw, MessageSquare, ChevronRight, ChevronLeft,
  CheckCircle2, Clock, Loader2, X, AlarmCheck, Zap, CalendarDays, SlidersHorizontal,
} from 'lucide-react'
import { format, isSameDay } from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import {
  DndContext, DragEndEvent,
  useDraggable, useDroppable,
} from '@dnd-kit/core'

const SCHEDULE_HOURS = Array.from({ length: 16 }, (_, i) => i + 7) // 07–22

function DraggableTaskRow({ task, index, onComplete, onEdit, onDelete, onBreakdown, onReschedule, lang, selectedDate }: {
  task: Task; index: number
  onComplete: (id: string) => Promise<void>
  onEdit: (t: Task) => void
  onDelete: (id: string) => Promise<void>
  onBreakdown: (t: Task) => void
  onReschedule: (t: Task) => void
  lang: 'fr' | 'en' | 'zh'
  selectedDate?: Date
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-start gap-3"
    >
      <span className="h-6 w-6 flex items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-400 shrink-0 mt-3 border border-red-100">
        {index + 1}
      </span>
      <div
        {...listeners}
        {...attributes}
        className="mt-3 cursor-grab text-[#c9b89a] hover:text-[#ab3326] shrink-0"
        title="Glisser pour planifier"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="5" r="1" fill="currentColor" /><circle cx="15" cy="5" r="1" fill="currentColor" />
          <circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" />
          <circle cx="9" cy="19" r="1" fill="currentColor" /><circle cx="15" cy="19" r="1" fill="currentColor" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <TaskCard task={task} onComplete={onComplete} onEdit={onEdit} onDelete={onDelete} onBreakdown={onBreakdown} onReschedule={onReschedule} lang={lang} selectedDate={selectedDate} />
      </div>
    </div>
  )
}

function DraggableScheduledTask({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `scheduled-${task.id}` })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1.5 leading-tight cursor-pointer group"
      onClick={() => onEdit(task)}
    >
      <div {...listeners} {...attributes} className="shrink-0 text-[#c9b89a] hover:text-[#ab3326] cursor-grab">
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
          <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
        </svg>
      </div>
      <span className="truncate text-[#3a3326] group-hover:text-red-700 text-[11px]">{task.title}</span>
      {task.scheduledStart && task.scheduledEnd && (
        <span className="text-[#a99873] shrink-0 ml-auto text-[10px]">
          {formatTime(String(task.scheduledStart))}–{formatTime(String(task.scheduledEnd))}
        </span>
      )}
    </div>
  )
}

function ScheduleHourSlot({ hour, events, scheduledTasks, calendarAccounts, isActive, onEditTask }: {
  hour: number
  events: CalendarEvent[]
  scheduledTasks: Task[]
  calendarAccounts: { id: string; color: string }[]
  isActive: boolean
  onEditTask: (t: Task) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `hour-${hour}` })
  const label = `${String(hour).padStart(2, '0')}:00`
  const hasContent = events.length > 0 || scheduledTasks.length > 0
  return (
    <div
      ref={setNodeRef}
      className={`flex gap-2 min-h-[40px] rounded-xl px-2 py-2 border transition-all text-xs ${
        isOver
          ? 'border-red-400 bg-red-50 shadow-sm'
          : hasContent
            ? 'border-[#e2d6bc] bg-[#fbf7ee]'
            : 'border-dashed border-[#e2d6bc] bg-transparent'
      }`}
    >
      <span className={`w-10 shrink-0 font-mono text-[10px] mt-0.5 ${isActive ? 'text-red-500 font-bold' : 'text-[#a99873]'}`}>{label}</span>
      <div className="flex-1 flex flex-col gap-0.5">
        {events.map((ev) => {
          const acc = calendarAccounts.find((a) => a.id === ev.calendarAccountId)
          const color = ev.color ?? acc?.color ?? '#6366F1'
          return (
            <div key={ev.id} className="flex items-center gap-1.5 leading-tight min-w-0">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="truncate text-[#3a3326] text-[11px]">{ev.title}</span>
            </div>
          )
        })}
        {scheduledTasks.map((task) => (
          <DraggableScheduledTask key={task.id} task={task} onEdit={onEditTask} />
        ))}
        {isOver && <div className="text-red-400 italic text-[10px]">→ {label}</div>}
      </div>
    </div>
  )
}

function DroppableTasksPanel({ children, isHighlight }: { children: React.ReactNode; isHighlight?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unschedule-zone' })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-0 min-h-0 transition-all rounded-2xl flex flex-col overflow-hidden ${
        isOver ? 'ring-2 ring-red-300 ring-offset-1' : ''
      } ${isHighlight ? 'bg-red-50/30' : ''}`}
    >
      {isOver && (
        <div className="shrink-0 text-center text-xs text-red-400 mb-2 py-1 rounded-xl border border-dashed border-red-300 bg-red-50">
          ↩ Retirer du planning
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function TodayPage() {
  const { language, tasks, habits, setTasks, updateTask, removeTask, addTask, setHabits, calendarAccounts, todayExcludePatterns, setTodayExcludePatterns, keywordRules } = useAppStore()
  const { toast } = useGlobalToast()

  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [newExcludePattern, setNewExcludePattern] = useState('')
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [recap, setRecap] = useState<string | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null)
  const [rescheduleSuggestion, setRescheduleSuggestion] = useState<{ start: string; end: string; reason: string } | null>(null)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<CalendarEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const dateInputRef = React.useRef<HTMLInputElement>(null)

  const dateFnsLocale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS
  const today = format(selectedDate, 'PPPP', { locale: dateFnsLocale })
  const isSelectedToday = isSameDay(selectedDate, new Date())
  const prevDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  const nextDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d) }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, habitsRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/habits'),
      ])
      setTasks(await tasksRes.json())
      setHabits(await habitsRes.json())
    } finally {
      setLoading(false)
    }
  }, [setTasks, setHabits])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (calendarAccounts.length === 0) return
    const fetchEvents = async () => {
      try {
        const todayStart = new Date(selectedDate); todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(selectedDate); todayEnd.setHours(23, 59, 59, 999)
        const tmrStart = new Date(selectedDate); tmrStart.setDate(tmrStart.getDate() + 1); tmrStart.setHours(0, 0, 0, 0)
        const tmrEnd = new Date(selectedDate); tmrEnd.setDate(tmrEnd.getDate() + 1); tmrEnd.setHours(23, 59, 59, 999)

        const [todayRes, tmrRes] = await Promise.all([
          fetch(`/api/calendar/events?start=${todayStart.toISOString()}&end=${todayEnd.toISOString()}`),
          fetch(`/api/calendar/events?start=${tmrStart.toISOString()}&end=${tmrEnd.toISOString()}`),
        ])
        if (todayRes.ok) setTodayEvents(await todayRes.json())
        if (tmrRes.ok) setTomorrowEvents(await tmrRes.json())
      } catch { /* best-effort */ }
    }
    fetchEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarAccounts.length, selectedDate])

  const isExcludedFromToday = (title: string) =>
    todayExcludePatterns.some((p) => p && title.toLowerCase().includes(p.toLowerCase()))

  // All-day calendar events for today
  const todayAllDayEvents = todayEvents.filter((ev) => ev.allDay)
  const todayAllDayEventIds = new Set(todayAllDayEvents.map((ev) => ev.id))

  // Tasks linked to today's all-day events (include them alongside regular tasks)
  const allDayLinkedTaskIds = new Set(
    tasks
      .filter((t) => t.calendarEventId && todayAllDayEventIds.has(t.calendarEventId))
      .map((t) => t.id)
  )

  const isDueOnDate = (deadline: string | Date | null | undefined, date: Date) => {
    if (!deadline) return true
    return isSameDay(new Date(String(deadline)), date)
  }

  const applyKeywordRules = (task: Task): Task => {
    const title = task.title.toLowerCase()
    const match = keywordRules.find((r) => title.includes(r.keyword.toLowerCase()))
    if (!match) return task
    return { ...task, importance: match.importance, urgency: match.urgence }
  }

  const prioritizedTasks = generatePriorityList(
    tasks.filter((t) =>
      t.status !== 'COMPLETED' &&
      t.status !== 'CANCELLED' &&
      t.parentTaskId === null &&
      (!t.calendarEventId || allDayLinkedTaskIds.has(t.id)) &&
      !t.scheduledStart &&
      isDueOnDate(t.deadline, selectedDate) &&
      !isExcludedFromToday(t.title)
    ).map(applyKeywordRules)
  )

  // All-day events that aren't linked to any task — shown as calendar entries in the list
  const linkedCalendarEventIds = new Set(tasks.map((t) => t.calendarEventId).filter(Boolean))
  const unmatchedAllDayEvents = todayAllDayEvents
    .filter((ev) => !linkedCalendarEventIds.has(ev.id) && !isExcludedFromToday(ev.title))
    .sort((a, b) => a.title.localeCompare(b.title))

  const scheduledTasks = tasks.filter(
    (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && !!t.scheduledStart
  )

  const scheduledTasksByHour = (hour: number) =>
    scheduledTasks.filter((t) => t.scheduledStart && new Date(String(t.scheduledStart)).getHours() === hour)

  // Show a completed task in the day whose DEADLINE matches, or (no deadline) in the day it was completed
  const completedToday = tasks.filter((t) => {
    if (t.status !== 'COMPLETED') return false
    if (t.deadline) return isSameDay(new Date(String(t.deadline)), selectedDate)
    return !!(t.completedAt && isSameDay(new Date(t.completedAt), selectedDate))
  })

  const handleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const isCompleted = task.status === 'COMPLETED'
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    const nowStr = new Date().toISOString()

    // Optimistic update — UI responds immediately
    updateTask(id, { status: newStatus, completedAt: isCompleted ? null : nowStr })

    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      // Revert on error
      updateTask(id, task)
      toast({ title: language === 'fr' ? 'Erreur de mise à jour' : language === 'zh' ? '更新失敗' : 'Update failed', variant: 'error' })
    } else if (!isCompleted) {
      toast({ title: language === 'fr' ? 'Tâche terminée !' : language === 'zh' ? '任務已完成！' : 'Task completed!', variant: 'success' })
    }
  }

  const handleSaveTask = async (data: Partial<Task>) => {
    if (editingTask) {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const updated = await res.json()
        updateTask(editingTask.id, updated)
      }
    } else {
      // Sync new task to Google Calendar if a calendar account is selected
      let calendarEventId: string | undefined
      if (data.calendarAccountId && data.deadline) {
        try {
          const evStart = new Date(String(data.deadline))
          const evEnd = new Date(evStart.getTime() + 60 * 60 * 1000)
          const evRes = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarAccountId: data.calendarAccountId,
              calendarId: 'primary',
              title: data.title,
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
        body: JSON.stringify({ ...data, calendarEventId }),
      })
      if (res.ok) {
        const created = await res.json()
        addTask(created)
        toast({ title: language === 'fr' ? 'Tâche créée !' : language === 'zh' ? '任務已建立！' : 'Task created!', variant: 'success' })
      }
    }
    setEditingTask(null)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    const fresh = await fetch('/api/tasks')
    if (fresh.ok) setTasks(await fresh.json())
  }

  const handleBreakdownAccept = async (task: Task, subTasks: { title: string; description: string; estimatedMinutes: number; importance: number; urgency: number }[]) => {
    await loadData()
    toast({ title: language === 'fr' ? 'Sous-tâches créées !' : language === 'zh' ? '子任務已建立！' : 'Subtasks created!', variant: 'success' })
  }

  const handleGenerateRecap = async () => {
    setRecapLoading(true)
    try {
      const res = await fetch('/api/ai/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: language }),
      })
      const data = await res.json()
      setRecap(data.summary)
    } finally {
      setRecapLoading(false)
    }
  }

  const handleReschedule = async (task: Task) => {
    setRescheduleTask(task)
    setRescheduleLoading(true)
    try {
      const res = await fetch('/api/ai/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, lang: language }),
      })
      const data = await res.json()
      setRescheduleSuggestion(data.suggestion)
    } finally {
      setRescheduleLoading(false)
    }
  }

  const handleConfirmReschedule = async () => {
    if (!rescheduleTask || !rescheduleSuggestion) return
    await fetch('/api/ai/reschedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: rescheduleTask.id,
        start: rescheduleSuggestion.start,
        end: rescheduleSuggestion.end,
      }),
    })
    await loadData()
    setRescheduleTask(null)
    setRescheduleSuggestion(null)
    toast({ title: language === 'fr' ? 'Tâche reprogrammée !' : language === 'zh' ? '任務已重新排程！' : 'Task rescheduled!', variant: 'success' })
  }

  const todayHabits = habits.filter((h) => {
    const dow = selectedDate.getDay()
    if (!h.isActive) return false
    if (h.frequency === 'DAILY') return true
    if (h.frequency === 'WEEKDAYS') return dow >= 1 && dow <= 5
    if (h.frequency === 'WEEKENDS') return dow === 0 || dow === 6
    return false
  })

  const handleCompleteHabit = async (habitId: string) => {
    const res = await fetch('/api/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId }),
    })
    if (res.ok) {
      const { streak } = await res.json()
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      setHabits(habits.map((h) => h.id === habitId
        ? { ...h, streak, completions: [{ id: 'tmp', habitId, completedAt: new Date().toISOString() }] }
        : h
      ))
      toast({ title: language === 'fr' ? `Habitude accomplie ! 🔥 Série: ${streak}` : language === 'zh' ? `習慣已完成！🔥 連續天數：${streak}` : `Habit done! 🔥 Streak: ${streak}`, variant: 'success' })
    }
  }

  const handleUncompleteHabit = async (habitId: string) => {
    const res = await fetch('/api/habits/complete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId }),
    })
    if (res.ok) {
      const { streak } = await res.json()
      setHabits(habits.map((h) => h.id === habitId ? { ...h, streak, completions: [] } : h))
    }
  }

  const handleScheduleTask = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || !active) return
    const overId = String(over.id)
    const activeId = String(active.id)

    // Unschedule: drag from left panel (scheduled-xxx) to right panel
    if (overId === 'unschedule-zone' && activeId.startsWith('scheduled-')) {
      const taskId = activeId.replace('scheduled-', '')
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledStart: null, scheduledEnd: null }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateTask(taskId, updated)
        setEditingTask(updated)
        setShowTaskForm(true)
        toast({ title: language === 'fr' ? 'Retiré du planning' : language === 'zh' ? '已移出行程' : 'Removed from schedule', variant: 'success' })
      }
      return
    }

    // Schedule: drag from right panel to hour slot
    if (!overId.startsWith('hour-') || activeId.startsWith('scheduled-')) return
    const hour = parseInt(overId.replace('hour-', ''), 10)
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0)
    const task = tasks.find((t) => t.id === activeId)
    const durationMs = (task?.estimatedMinutes ?? 60) * 60 * 1000
    const end = new Date(start.getTime() + durationMs)
    const res = await fetch(`/api/tasks/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() }),
    })
    if (res.ok) {
      const updated = await res.json()
      updateTask(activeId, updated)
      toast({
        title: language === 'fr' ? `Planifié à ${String(hour).padStart(2,'0')}:00` : language === 'zh' ? `已排定於 ${String(hour).padStart(2,'0')}:00` : `Scheduled at ${String(hour).padStart(2,'0')}:00`,
        variant: 'success',
      })
    }
  }

  if (loading) return <InkLoader size="page" />

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <Sundial className="h-8 w-8" />
            <h1 className="text-2xl font-serif text-[#2a2420] tracking-tight leading-none">{t('today', language)}</h1>

          </div>
          <p className="text-[13px] text-[#8a7a5e] mt-1 capitalize pl-[42px]">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Day picker */}
          <div className="flex items-center gap-0.5 rounded-xl border border-[#e2d6bc] bg-white/60 px-1 py-1">
            <button onClick={prevDay} className="p-1 rounded-lg hover:bg-[#f3ecdd] text-[#8a7a5e] transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className="relative px-2 text-xs font-medium text-[#3a3326] hover:text-[#ab3326] transition-colors min-w-[80px] text-center"
            >
              {format(selectedDate, 'd MMM yyyy', { locale: dateFnsLocale })}
              <input
                ref={dateInputRef}
                type="date"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => { if (e.target.value) { const d = new Date(e.target.value); d.setHours(0,0,0,0); setSelectedDate(d) } }}
              />
            </button>
            <button onClick={nextDay} className="p-1 rounded-lg hover:bg-[#f3ecdd] text-[#8a7a5e] transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {!isSelectedToday && (
              <button onClick={goToday} className="ml-0.5 px-1.5 py-0.5 rounded-lg text-[10px] bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
                {language === 'fr' ? 'Auj.' : language === 'zh' ? '今天' : 'Today'}
              </button>
            )}
          </div>
          {AI_ENABLED && (
            <Button variant="outline" size="sm" onClick={handleGenerateRecap} disabled={recapLoading}
              className="border-[#e2d6bc] text-[#5c5347] hover:bg-[#f3ecdd] hover:border-[#cba968] transition-all">
              {recapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('morningRecap', language)}
            </Button>
          )}
          {AI_ENABLED && (
            <Button variant="ghost" size="icon" onClick={() => setShowChat(!showChat)}
              className="text-[#8a7a5e] hover:text-[#ab3326] hover:bg-[#f3ecdd]">
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          <button
            onClick={() => setFilterPanelOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all',
              filterPanelOpen
                ? 'bg-[#f3ecdd] border-[#cba968] text-[#5c5347]'
                : 'border-[#e2d6bc] text-[#8a7a5e] hover:bg-[#f3ecdd]'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {language === 'fr' ? 'Filtres' : language === 'zh' ? '篩選' : 'Filters'}
          </button>
          <Button size="sm" onClick={() => setShowTaskForm(true)}
            className="bg-gradient-to-br from-[#c44a3a] to-[#861f17] hover:from-[#ab3326] hover:to-[#6e190f] text-[#f3ecdd] border-0 shadow-md shadow-[#ab3326]/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            {t('addTask', language)}
          </Button>
        </div>
      </div>

      {/* Today exclude-pattern filter panel */}
      {filterPanelOpen && (
        <div className="border-b border-[#ece2cb] bg-[#f8f4ea] px-6 py-4">
          <p className="text-xs font-semibold text-[#5c5347] mb-2 flex items-center gap-1.5">
            <span>🚫</span>
            {language === 'fr' ? "Masquer de Aujourd'hui" : language === 'zh' ? '從今日頁面隱藏' : "Hide from Today"}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {todayExcludePatterns.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded-lg bg-[#f3ecdd] border border-[#e2d6bc] px-2.5 py-1 text-xs text-[#5c5347]">
                {p}
                <button onClick={() => setTodayExcludePatterns(todayExcludePatterns.filter((x) => x !== p))} className="text-[#a99873] hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                value={newExcludePattern}
                onChange={(e) => setNewExcludePattern(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newExcludePattern.trim()) { setTodayExcludePatterns([...todayExcludePatterns, newExcludePattern.trim()]); setNewExcludePattern('') } }}
                placeholder={language === 'fr' ? 'ex: Meeting' : language === 'zh' ? '例：會議' : 'e.g. Meeting'}
                className="border border-[#e2d6bc] rounded-lg px-2.5 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-red-300 bg-[#fbf7ee]"
              />
              <button
                onClick={() => { if (newExcludePattern.trim()) { setTodayExcludePatterns([...todayExcludePatterns, newExcludePattern.trim()]); setNewExcludePattern('') } }}
                className="text-xs px-2 py-1 rounded-lg bg-[#c44a3a] text-white hover:bg-[#ab3326]"
              >+</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-hidden min-h-0 p-6 flex flex-col gap-4 animate-fade-in">
          {AI_ENABLED && recap && (
            <div className="relative rounded-2xl bg-gradient-to-br from-[#fbeacb] to-[#f3dcb2] border border-[#e7c894] p-5">
              <button onClick={() => setRecap(null)} className="absolute right-3 top-3 p-1 rounded-lg hover:bg-[#e7c894]/30 text-[#a99873]">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-[#ab3326]" />
                <span className="text-sm font-semibold text-[#2a1f12]">{t('morningRecap', language)}</span>
              </div>
              <p className="text-sm text-[#5c5347] whitespace-pre-line leading-relaxed">{recap}</p>
            </div>
          )}

          {AI_ENABLED && rescheduleTask && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700">{t('reschedule', language)}</span>
                </div>
                <button onClick={() => { setRescheduleTask(null); setRescheduleSuggestion(null) }} className="p-1 rounded-lg hover:bg-amber-100 text-amber-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-amber-800 mb-3">{rescheduleTask.title}</p>
              {rescheduleLoading && <Loader2 className="h-5 w-5 animate-spin text-amber-600" />}
              {rescheduleSuggestion && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-xl bg-[#fbf7ee] border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-[#6e6147] mb-1">{language === 'fr' ? 'Créneau suggéré' : language === 'zh' ? '建議時段' : 'Suggested slot'}</p>
                    <p className="text-sm font-medium text-[#2a2420]">
                      {formatDate(rescheduleSuggestion.start, language)} · {formatTime(rescheduleSuggestion.start)} – {formatTime(rescheduleSuggestion.end)}
                    </p>
                    <p className="text-xs text-[#8a7a5e] mt-1">{rescheduleSuggestion.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConfirmReschedule}>{t('confirm', language)}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setRescheduleTask(null); setRescheduleSuggestion(null) }}>{t('cancel', language)}</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 stagger">
            {[
              {
                label: language === 'fr' ? 'À faire' : language === 'zh' ? '待辦' : 'To do',
                value: prioritizedTasks.length + unmatchedAllDayEvents.length,
                icon: AlarmCheck,
                gradient: 'from-[#c44a3a] to-[#861f17]',
                shadow: 'shadow-[#ab3326]/20',
                textColor: 'text-[#861f17]',
                bg: 'bg-gradient-to-br from-[#ab3326]/[0.06] to-[#b08948]/[0.06]',
                border: 'border-[#e2d6bc]',
              },
              {
                label: language === 'fr' ? 'Terminées' : language === 'zh' ? '已完成' : 'Completed',
                value: completedToday.length,
                icon: CheckCircle2,
                gradient: 'from-[#4f6f5e] to-[#3d5a4b]',
                shadow: 'shadow-[#4f6f5e]/20',
                textColor: 'text-[#3d5a4b]',
                bg: 'bg-gradient-to-br from-[#4f6f5e]/[0.07] to-[#4f6f5e]/[0.03]',
                border: 'border-[#e2d6bc]',
              },
              {
                label: language === 'fr' ? 'Habitudes' : language === 'zh' ? '習慣' : 'Habits',
                value: todayHabits.length,
                icon: Flame,
                gradient: 'from-[#cba968] to-[#b08948]',
                shadow: 'shadow-[#b08948]/20',
                textColor: 'text-[#8a6a32]',
                bg: 'bg-gradient-to-br from-[#b08948]/[0.08] to-[#b08948]/[0.03]',
                border: 'border-[#e2d6bc]',
              },
            ].map(({ label, value, icon: Icon, gradient, shadow, textColor, bg, border }) => (
              <div key={label} className={`card-lift rounded-2xl border ${border} ${bg} paper-surface p-4 flex items-center gap-3.5`}>
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md ${shadow} shrink-0`}>
                  <Icon className="h-4.5 w-4.5 text-[#f3ecdd] h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#2a2420] leading-none mb-0.5">{value}</p>
                  <p className={`text-xs font-medium ${textColor}`}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {todayHabits.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#5c5347] mb-3 flex items-center gap-2">
                <Candle className="h-4 w-3.5" />
                {t('habits', language)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {todayHabits.map((habit) => {
                  const doneToday = (habit as Habit & { completions?: { id: string }[] }).completions?.length ?? 0
                  return (
                    <button
                      key={habit.id}
                      onClick={() => doneToday > 0 ? handleUncompleteHabit(habit.id) : handleCompleteHabit(habit.id)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition-all ${
                        doneToday > 0
                          ? 'bg-[#4f6f5e]/10 border-[#4f6f5e]/30 text-[#3d5a4b] hover:bg-[#ab3326]/10 hover:border-[#ab3326]/30 hover:text-[#861f17]'
                          : 'bg-[#fbf7ee] border-[#e2d6bc] text-[#5c5347] hover:border-[#cba968] hover:bg-[#f3ecdd]'
                      }`}
                      title={doneToday > 0 ? (language === 'fr' ? 'Annuler' : language === 'zh' ? '取消' : 'Undo') : undefined}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: habit.color }} />
                      {habit.title}
                      {habit.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-[#8a6a32]">
                          <Flame className="h-3 w-3" />
                          {habit.streak}
                        </span>
                      )}
                      {doneToday > 0 && <CheckCircle2 className="h-3.5 w-3.5 text-[#4f6f5e]" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Two-column split: left = today's schedule, right = priority tasks */}
          <DndContext onDragEnd={handleScheduleTask}>
            <div className="flex-1 min-h-0 flex gap-4">
              {/* Left: Today's schedule timeline */}
              <div className="w-[400px] shrink-0 rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#ece2cb]">
                  <CalendarDays className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-[#5c5347]">
                    {language === 'fr' ? "Agenda du jour" : language === 'zh' ? '今日行程' : "Today's schedule"}
                  </span>
                  <span className="text-[10px] text-[#a99873] ml-auto">
                    {language === 'fr' ? 'Déposer pour planifier' : language === 'zh' ? '拖入以排程' : 'Drop to schedule'}
                  </span>
                </div>
                <div className="overflow-y-auto p-2 flex flex-col gap-0.5">
                  {SCHEDULE_HOURS.map((hour) => {
                    const nowHour = new Date().getHours()
                    const eventsAtHour = todayEvents
                      .filter((ev) => !ev.allDay && ev.start)
                      .filter((ev) => new Date(ev.start!).getHours() === hour)
                    return (
                      <ScheduleHourSlot
                        key={hour}
                        hour={hour}
                        events={eventsAtHour}
                        scheduledTasks={scheduledTasksByHour(hour)}
                        calendarAccounts={calendarAccounts}
                        isActive={hour === nowHour}
                        onEditTask={(t) => { setEditingTask(t); setShowTaskForm(true) }}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Right: Priority tasks (draggable) */}
              <DroppableTasksPanel>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#2a1f12] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-red-500" />
                    {language === 'fr' ? 'Tâches prioritaires' : language === 'zh' ? '優先任務' : 'Priority tasks'}
                    <Badge variant="default" className="text-xs bg-red-100 text-red-900 border-0">{prioritizedTasks.length}</Badge>
                  </h2>
                </div>

                {prioritizedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e7c894]/60 py-12 text-center bg-[#fbeacb]/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_v5/empty-task.png" alt="" className="h-20 w-20 mb-4 opacity-70" />
                    <p className="text-sm font-medium text-[#6b5840]">{t('noTasks', language)}</p>
                    <Button variant="outline" size="sm"
                      className="mt-4 border-[#e7c894] text-[#6b5840] hover:bg-[#f3dcb2] hover:border-[#c9aa72]"
                      onClick={() => setShowTaskForm(true)}>
                      <Plus className="h-4 w-4" />
                      {t('addTask', language)}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 stagger">
                    {/* Top 3: full card */}
                    {prioritizedTasks.slice(0, 3).map((task, index) => (
                      <DraggableTaskRow
                        key={task.id}
                        task={task}
                        index={index}
                        onComplete={handleComplete}
                        onEdit={(t) => { setEditingTask(t); setShowTaskForm(true) }}
                        onDelete={handleDelete}
                        onBreakdown={setBreakdownTask}
                        onReschedule={handleReschedule}
                        lang={language}
                        selectedDate={selectedDate}
                      />
                    ))}
                    {/* Tasks 4+: compact single-line */}
                    {prioritizedTasks.slice(3).map((task, extraIndex) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 rounded-xl border border-[#ece2cb] bg-[#fbf7ee] px-3 py-1.5 hover:bg-[#f3ecdd] transition-colors cursor-pointer"
                        onClick={() => { setEditingTask(task); setShowTaskForm(true) }}
                      >
                        <span className="h-5 w-5 flex items-center justify-center rounded-full bg-[#f3ecdd] text-[10px] font-bold text-[#a99873] shrink-0 border border-[#e2d6bc]">
                          {extraIndex + 4}
                        </span>
                        <button
                          onClick={async (e) => { e.stopPropagation(); await handleComplete(task.id) }}
                          className="shrink-0 hover:scale-110 transition-transform"
                        >
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-[#c4b48a] inline-block" />
                        </button>
                        <span className="flex-1 text-xs text-[#3a3326] truncate">{task.title}</span>
                        {task.deadline && !isSameDay(new Date(String(task.deadline)), selectedDate) && (
                          <span className="text-[10px] text-red-400 shrink-0">{formatDate(String(task.deadline), language)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {completedToday.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-px bg-[#e7c894]/50" />
                      <h3 className="text-xs font-semibold text-[#8a6b3e] flex items-center gap-1.5 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {language === 'fr' ? `Terminées (${completedToday.length})` : language === 'zh' ? `已完成 (${completedToday.length})` : `Done (${completedToday.length})`}
                      </h3>
                      <div className="flex-1 h-px bg-[#e7c894]/50" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {completedToday.slice(0, 5).map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={handleComplete}
                          onEdit={(t) => { setEditingTask(t); setShowTaskForm(true) }}
                          onDelete={handleDelete}
                          onBreakdown={setBreakdownTask}
                          onReschedule={handleReschedule}
                          lang={language}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                )}
              </DroppableTasksPanel>
            </div>
          </DndContext>
        </div>

        {AI_ENABLED && showChat && (
          <div className="w-80 shrink-0 border-l border-[#ece2cb] overflow-hidden flex flex-col">
            <AIChat lang={language} onClose={() => setShowChat(false)} />
          </div>
        )}
      </div>

      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null) }}
        onSave={handleSaveTask}
        onDelete={handleDelete}
        task={editingTask}
        calendarAccounts={calendarAccounts}
        lang={language}
      />

      {AI_ENABLED && (
        <BreakdownDialog
          open={!!breakdownTask}
          onClose={() => setBreakdownTask(null)}
          task={breakdownTask}
          onAccept={handleBreakdownAccept}
          lang={language}
        />
      )}
    </div>
  )
}
