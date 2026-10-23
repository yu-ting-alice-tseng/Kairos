'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useUserTimeZone } from '@/components/providers/TimezoneSync'
import { zonedYmd } from '@/lib/timezones'
import { syncCalendarTasks } from '@/lib/calendar-sync'
import { Task, Habit, CalendarEvent } from '@/types'
import { t } from '@/lib/i18n'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { AIChat } from '@/components/ai/AIChat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sundial } from '@/components/ui/Sundial'
import { Shortcut, usePageShortcuts, openShortcutsHelp } from '@/components/ui/ShortcutsDialog'
import { Candle } from '@/components/ui/Candle'
import { createTaskOptimistic, saveTaskEdit } from '@/lib/task-mutations'
import { completeHabitOptimistic, uncompleteHabitOptimistic } from '@/lib/habit-mutations'
import { generatePriorityList, isPendingTaskId, dueInLabel, formatDate, formatDeadlineLabel, deadlineTooltip, formatTime, cn } from '@/lib/utils'
import {
  Plus, Sparkles, Sun, Flame, RefreshCw, MessageSquare, ChevronRight, ChevronLeft,
  CheckCircle2, Clock, Loader2, X, AlarmCheck, ChevronDown, Zap, CalendarDays, SlidersHorizontal, Keyboard, Bell, Hourglass,
} from 'lucide-react'
import { format, isSameDay, differenceInCalendarDays } from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import {
  DndContext, DragEndEvent,
  useDraggable, useDroppable,
} from '@dnd-kit/core'

const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i) // 00–23
// Hour the schedule scrolls to on first load
const SCHEDULE_INITIAL_HOUR = 7

/**
 * Does an event belong to `day`? The fetch covers today *and* tomorrow, so the
 * day it renders on is decided here. All-day events are compared as calendar
 * dates with an exclusive end (how Google/Outlook report them) — parsing their
 * date-only strings as instants would shift them by the UTC offset and spill a
 * 6 August event onto 7 August.
 */
function eventOccursOn(ev: CalendarEvent, day: Date): boolean {
  if (!ev.start) return false
  const dayKey = format(day, 'yyyy-MM-dd')
  if (ev.allDay) {
    const startKey = String(ev.start).slice(0, 10)
    const endKey = ev.end ? String(ev.end).slice(0, 10) : startKey
    return endKey > startKey ? dayKey >= startKey && dayKey < endKey : dayKey === startKey
  }
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999)
  const start = new Date(ev.start)
  const end = ev.end ? new Date(ev.end) : start
  return start <= dayEnd && end >= dayStart
}

/**
 * Collapses tasks the calendar sync produced more than once for what is really
 * the same entry — same title, same day. The server already dedupes by event
 * id; this catches the case it cannot see, an event mirrored on two connected
 * calendars, where each copy carries its own id. Tasks the user typed in stay
 * untouched, duplicate titles and all.
 */
function dedupeCalendarTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>()
  return tasks.filter((task) => {
    if (!task.calendarEventId) return true
    const day = task.deadline ? new Date(String(task.deadline)).toDateString() : 'none'
    const key = `${task.title}|${day}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Editable list of title keywords, used by the Today filter panel. */
function PatternEditor({ icon, label, hint, placeholder, patterns, onChange, className }: {
  icon: React.ReactNode
  label: string
  hint?: string
  placeholder: string
  patterns: string[]
  onChange: (patterns: string[]) => void
  className?: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value) return
    if (!patterns.includes(value)) onChange([...patterns, value])
    setDraft('')
  }
  return (
    <div className={className}>
      <p className="text-xs font-semibold text-[#5c5347] mb-2 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      {hint && <p className="text-[11px] text-[#8a7a5e] -mt-1 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        {patterns.map((p) => (
          <span key={p} className="flex items-center gap-1 rounded-lg bg-[#f3ecdd] border border-[#e2d6bc] px-2.5 py-1 text-xs text-[#5c5347]">
            {p}
            <button onClick={() => onChange(patterns.filter((x) => x !== p))} className="text-[#a99873] hover:text-red-500 ml-0.5">×</button>
          </span>
        ))}
        <div className="flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder={placeholder}
            className="border border-[#e2d6bc] rounded-lg px-2.5 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-red-300 bg-[#fbf7ee]"
          />
          <button onClick={add} className="text-xs px-2 py-1 rounded-lg bg-[#c44a3a] text-white hover:bg-[#ab3326]">+</button>
        </div>
      </div>
    </div>
  )
}

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

/** Small done/not-done toggle used on the schedule timeline. */
function DoneToggle({ done, onToggle, lang }: { done: boolean; onToggle: () => void; lang: string }) {
  const label = done
    ? (lang === 'fr' ? 'Marquer comme non fait' : lang === 'zh' ? '標記為未完成' : 'Mark as not done')
    : (lang === 'fr' ? 'Marquer comme fait' : lang === 'zh' ? '標記為已完成' : 'Mark as done')
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className="shrink-0 hover:scale-110 transition-transform"
    >
      {done
        ? <CheckCircle2 className="h-3.5 w-3.5 text-[#4f6f5e]" />
        : <span className="h-3.5 w-3.5 rounded-full border-2 border-[#c4b48a] inline-block align-middle" />}
    </button>
  )
}

function DraggableScheduledTask({ task, onEdit, onToggleDone, lang }: {
  task: Task
  onEdit: (t: Task) => void
  onToggleDone: (t: Task) => void
  lang: string
}) {
  const done = task.status === 'COMPLETED'
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
      <DoneToggle done={done} onToggle={() => onToggleDone(task)} lang={lang} />
      <span className={`truncate text-[11px] group-hover:text-red-700 ${done ? 'line-through text-[#a99873]' : 'text-[#3a3326]'}`}>{task.title}</span>
      {task.scheduledStart && task.scheduledEnd && (
        <span className="text-[#a99873] shrink-0 ml-auto text-[10px]">
          {formatTime(String(task.scheduledStart))}–{formatTime(String(task.scheduledEnd))}
        </span>
      )}
    </div>
  )
}

function ScheduleHourSlot({ hour, events, scheduledTasks, calendarAccounts, isActive, onEditTask, isEventDone, onToggleEvent, onToggleTask, lang }: {
  hour: number
  events: CalendarEvent[]
  scheduledTasks: Task[]
  calendarAccounts: { id: string; color: string }[]
  isActive: boolean
  onEditTask: (t: Task) => void
  isEventDone: (ev: CalendarEvent) => boolean
  onToggleEvent: (ev: CalendarEvent) => void
  onToggleTask: (t: Task) => void
  lang: string
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
          const done = isEventDone(ev)
          return (
            <div key={ev.id} className="flex items-center gap-1.5 leading-tight min-w-0">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <DoneToggle done={done} onToggle={() => onToggleEvent(ev)} lang={lang} />
              <span className={`truncate text-[11px] ${done ? 'line-through text-[#a99873]' : 'text-[#3a3326]'}`}>{ev.title}</span>
              {ev.start && (
                <span className="text-[#a99873] shrink-0 ml-auto text-[10px]">{formatTime(String(ev.start))}</span>
              )}
            </div>
          )
        })}
        {scheduledTasks.map((task) => (
          <DraggableScheduledTask key={task.id} task={task} onEdit={onEditTask} onToggleDone={onToggleTask} lang={lang} />
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
      className={`md:flex-1 min-w-0 md:min-h-0 transition-all rounded-2xl flex flex-col md:overflow-hidden ${
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

const TODAY_SHORTCUTS: Shortcut[] = [
  { keys: ['C'], zh: '新增任務', fr: 'Nouvelle tâche', en: 'New task' },
  { keys: ['T'], zh: '回到今天', fr: "Aller à aujourd'hui", en: 'Go to today' },
  { keys: ['J', 'N', '→'], zh: '下一天', fr: 'Jour suivant', en: 'Next day' },
  { keys: ['K', 'P', '←'], zh: '前一天', fr: 'Jour précédent', en: 'Previous day' },
  { keys: ['F'], zh: '開關篩選', fr: 'Afficher/masquer les filtres', en: 'Toggle filters' },
]
const TODAY_AI_SHORTCUTS: Shortcut[] = [
  { keys: ['A'], zh: '開關 AI 助理', fr: "Afficher/masquer l'assistant IA", en: 'Toggle AI assistant' },
]

const TODAY_PAGE_SHORTCUTS = AI_ENABLED ? [...TODAY_SHORTCUTS, ...TODAY_AI_SHORTCUTS] : TODAY_SHORTCUTS

export default function TodayClient({ initialTasks, initialHabits }: {
  initialTasks: Task[]
  initialHabits: Habit[]
}) {
  const { language, tasks: storeTasks, habits: storeHabits, dataSeeded, seedServerData, setTasks, updateTask, removeTask, addTask, setHabits, calendarAccounts, todayExcludePatterns, setTodayExcludePatterns, todayReminderPatterns, setTodayReminderPatterns, keywordRules, hideHabitsViews, toggleHabitsView } = useAppStore()
  const habitsHidden = hideHabitsViews.includes('today')
  const { toast } = useGlobalToast()

  // The server already rendered this list, so the first paint reads the props —
  // which is also what keeps the markup identical through hydration. The store
  // takes over as soon as it holds that same data, and every edit from then on
  // goes through it.
  useEffect(() => {
    seedServerData(initialTasks, initialHabits)
  }, [initialTasks, initialHabits, seedServerData])
  const tasks = dataSeeded ? storeTasks : initialTasks
  const habits = dataSeeded ? storeHabits : initialHabits

  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [recap, setRecap] = useState<string | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null)
  const [rescheduleSuggestion, setRescheduleSuggestion] = useState<{ start: string; end: string; reason: string } | null>(null)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [showCatchUp, setShowCatchUp] = useState(false)
  const [showOverdue, setShowOverdue] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(true)
  const [confirmDismissAll, setConfirmDismissAll] = useState(false)
  // "Today" is the date in the person's timezone (device or Settings), held
  // as a local-midnight Date like every other day this page handles.
  const timeZone = useUserTimeZone()
  const todayDate = () => { const { year, month, day } = zonedYmd(timeZone); return new Date(year, month - 1, day) }
  const [selectedDate, setSelectedDate] = useState<Date>(todayDate)
  const dateInputRef = React.useRef<HTMLInputElement>(null)
  // The schedule covers the whole day; open it at the start of a typical day.
  const didInitialScheduleScrollRef = React.useRef(false)
  const scheduleScrollRef = React.useCallback((el: HTMLDivElement | null) => {
    if (!el || didInitialScheduleScrollRef.current) return
    const slot = el.children[SCHEDULE_HOURS.indexOf(SCHEDULE_INITIAL_HOUR)] as HTMLElement | undefined
    if (!slot) return
    didInitialScheduleScrollRef.current = true
    el.scrollTop = slot.offsetTop - el.offsetTop - 8
  }, [])

  const dateFnsLocale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS
  const today = format(selectedDate, 'PPPP', { locale: dateFnsLocale })
  const isSelectedToday = isSameDay(selectedDate, todayDate())
  const prevDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  const nextDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  const goToday = () => setSelectedDate(todayDate())

  usePageShortcuts(TODAY_PAGE_SHORTCUTS, (key) => {
    if (showTaskForm) return false
    switch (key) {
      case 'ArrowLeft': case 'k': case 'p': prevDay(); return true
      case 'ArrowRight': case 'j': case 'n': nextDay(); return true
      case 't': goToday(); return true
      case 'c': setShowTaskForm(true); return true
      case 'f': setFilterPanelOpen((o) => !o); return true
      case 'a': if (!AI_ENABLED) return false; setShowChat((v) => !v); return true
    }
    return false
  })

  // Re-read after something changed the data behind our back (a calendar sync,
  // an AI breakdown). The first load needs none of this — it came with the page.
  const loadData = useCallback(async () => {
    const [tasksRes, habitsRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/habits'),
    ])
    if (tasksRes.ok) setTasks(await tasksRes.json())
    if (habitsRes.ok) setHabits(await habitsRes.json())
  }, [setTasks, setHabits])

  // Calendar sync, held back until after the first paint: it reaches out to
  // Google across the full range of linked deadlines, and letting it start in
  // the same tick as the events fetch only made both slower.
  useEffect(() => {
    const timer = setTimeout(() => {
      syncCalendarTasks().then((changed) => { if (changed) loadData() })
    }, 800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fires without waiting for the sidebar's account list: the server resolves the
  // user's accounts itself, so gating on the client copy only added a round trip
  // to first paint. A later change to the connected set still refetches below.
  const accountKey = calendarAccounts.map((a) => a.id).sort().join(',')
  const prevFetchKeyRef = React.useRef<{ accounts: string; date: string } | null>(null)

  useEffect(() => {
    const dateKey = selectedDate.toISOString()
    const prev = prevFetchKeyRef.current
    prevFetchKeyRef.current = { accounts: accountKey, date: dateKey }
    // Skip exactly one re-run: the sidebar's account list landing on an unchanged
    // date. The fetch already asked the server for every connected account.
    if (prev && prev.date === dateKey && prev.accounts === '' && accountKey !== '') return
    const fetchEvents = async () => {
      try {
        // One request for today *and* tomorrow. Two overlapping range fetches
        // used to run in parallel, and a multi-day all-day event lands in both:
        // each request found no task for it and created one, so those events
        // showed up twice in the list. Tomorrow stays in the range because the
        // fetch is also what syncs its events into tasks.
        const rangeStart = new Date(selectedDate); rangeStart.setHours(0, 0, 0, 0)
        const rangeEnd = new Date(selectedDate); rangeEnd.setDate(rangeEnd.getDate() + 1); rangeEnd.setHours(23, 59, 59, 999)

        const res = await fetch(`/api/calendar/events?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`)
        if (res.ok) {
          const events: CalendarEvent[] = await res.json()
          setTodayEvents(events.filter((ev) => eventOccursOn(ev, selectedDate)))
        } else {
          toast({ title: language === 'fr' ? 'Erreur de synchronisation du calendrier' : language === 'zh' ? '日曆同步失敗' : 'Calendar sync failed', variant: 'error' })
        }
      } catch {
        toast({ title: language === 'fr' ? 'Erreur de synchronisation du calendrier' : language === 'zh' ? '日曆同步失敗' : 'Calendar sync failed', variant: 'error' })
      }
    }
    fetchEvents()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, selectedDate])

  const isExcludedFromToday = (title: string) =>
    todayExcludePatterns.some((p) => p && title.toLowerCase().includes(p.toLowerCase()))

  // Reminders (birthdays…) are not work: they leave the to-do list and the
  // schedule and get their own strip, only on the day they fall on.
  const isReminder = (title: string) =>
    todayReminderPatterns.some((p) => p && title.toLowerCase().includes(p.toLowerCase()))

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
    const dl = new Date(String(deadline))
    const endOfDate = new Date(date); endOfDate.setHours(23, 59, 59, 999)
    return dl <= endOfDate // include overdue tasks (deadline in the past)
  }

  const applyKeywordRules = (task: Task): Task => {
    const title = task.title.toLowerCase()
    const match = keywordRules.find((r) => title.includes(r.keyword.toLowerCase()))
    if (!match) return task
    return { ...task, importance: match.importance, urgency: match.urgence }
  }

  const selectedDayStart = new Date(selectedDate); selectedDayStart.setHours(0, 0, 0, 0)
  // A slot booked on an earlier day and never done is overdue work again: it
  // goes back to the list instead of haunting every later day's timeline.
  const isBeforeSelectedDay = (d: string | Date) => new Date(String(d)) < selectedDayStart
  const isStaleSchedule = (t: Task) =>
    !!t.scheduledStart && new Date(String(t.scheduledStart)) < selectedDayStart && t.status !== 'COMPLETED'

  const prioritizedTasks = dedupeCalendarTasks(generatePriorityList(
    tasks.filter((t) =>
      t.status !== 'COMPLETED' &&
      t.status !== 'CANCELLED' &&
      t.parentTaskId === null &&
      (!t.calendarEventId || allDayLinkedTaskIds.has(t.id)) &&
      !t.scheduledStart &&
      (!t.deadline || !isBeforeSelectedDay(t.deadline) || allDayLinkedTaskIds.has(t.id)) &&
      isDueOnDate(t.deadline, selectedDate) &&
      !isExcludedFromToday(t.title) &&
      !isReminder(t.title)
    ).map(applyKeywordRules)
  ))

  // All-day events that aren't linked to any task — shown as calendar entries in the list
  const linkedCalendarEventIds = new Set(tasks.map((t) => t.calendarEventId).filter(Boolean))
  const unmatchedAllDayEvents = todayAllDayEvents
    .filter((ev) => !linkedCalendarEventIds.has(ev.id) && !isExcludedFromToday(ev.title) && !isReminder(ev.title))
    .sort((a, b) => a.title.localeCompare(b.title))

  // Everything whose day has passed without being done: overdue tasks, slots
  // left undone and calendar events that ended (the last 14 days; older ones
  // are history, not a to-do). Kept apart so the day's own list stays the day's.
  const OVERDUE_EVENT_DAYS = 14
  const overdueEventCutoff = new Date(selectedDayStart.getTime() - OVERDUE_EVENT_DAYS * 86400_000)
  const overdueTasks = dedupeCalendarTasks(tasks.filter((t) => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED' || t.parentTaskId !== null) return false
    if (isExcludedFromToday(t.title) || isReminder(t.title)) return false
    if (isStaleSchedule(t)) return true
    if (t.scheduledStart || !t.deadline || !isBeforeSelectedDay(t.deadline)) return false
    if (!t.calendarEventId) return true
    if (allDayLinkedTaskIds.has(t.id)) return false // multi-day event still running
    return new Date(String(t.deadline)) >= overdueEventCutoff
  })).sort((a, b) =>
    String(b.scheduledStart ?? b.deadline ?? '').localeCompare(String(a.scheduledStart ?? a.deadline ?? '')))

  // Due in the next few days: the list above only holds what is due by the
  // day shown, so a big task due on Friday stayed invisible until Friday.
  // Calendar-linked tasks are left out (they are events, already on the
  // calendar) and so are tasks already given a slot.
  const UPCOMING_DAYS = 7
  const upcomingTasks = tasks.filter((t) => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED' || t.parentTaskId !== null) return false
    if (!t.deadline || t.scheduledStart || t.calendarEventId) return false
    if (isExcludedFromToday(t.title) || isReminder(t.title)) return false
    const days = differenceInCalendarDays(new Date(String(t.deadline)), selectedDate)
    return days >= 1 && days <= UPCOMING_DAYS
  }).map(applyKeywordRules).sort((a, b) =>
    String(a.deadline).localeCompare(String(b.deadline)) || (b.priority ?? 0) - (a.priority ?? 0))

  // Only the slots booked on the day being shown; done ones stay, struck through.
  const scheduledTasks = tasks.filter(
    (t) => t.status !== 'CANCELLED' && !!t.scheduledStart && !isReminder(t.title) &&
      isSameDay(new Date(String(t.scheduledStart)), selectedDate)
  )

  const reminderTasks = dedupeCalendarTasks(tasks.filter((t) => {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED' || t.parentTaskId !== null) return false
    if (isExcludedFromToday(t.title) || !isReminder(t.title)) return false
    const when = t.scheduledStart ?? t.deadline
    return !!when && isSameDay(new Date(String(when)), selectedDate)
  }))
  const reminderEvents = todayEvents
    .filter((ev) => !linkedCalendarEventIds.has(ev.id) && !isExcludedFromToday(ev.title) && isReminder(ev.title))
    .sort((a, b) => a.title.localeCompare(b.title))

  const scheduledTasksByHour = (hour: number) =>
    scheduledTasks.filter((t) => t.scheduledStart && new Date(String(t.scheduledStart)).getHours() === hour)

  // A completed task shows on the day it was completed, and also on its
  // deadline day. Going by the deadline alone made overdue or early tasks
  // vanish the moment they were checked off instead of moving down here.
  const completedToday = dedupeCalendarTasks(tasks.filter((t) => {
    if (t.status !== 'COMPLETED' || t.parentTaskId !== null) return false
    if (t.completedAt && isSameDay(new Date(String(t.completedAt)), selectedDate)) return true
    return !!t.deadline && isSameDay(new Date(String(t.deadline)), selectedDate)
  })).sort((a, b) => String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? '')))
  // Overdue tasks from earlier days that were cleared on this day. They count,
  // but sit in their own folded group so the day's own work reads first.
  const isCatchUp = (t: Task) => !!t.deadline && new Date(String(t.deadline)) < selectedDayStart
  const completedOwn = completedToday.filter((t) => !isCatchUp(t))
  const completedCatchUp = completedToday.filter(isCatchUp)

  const handleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task || isPendingTaskId(id)) return
    const isCompleted = task.status === 'COMPLETED'
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    const nowStr = new Date().toISOString()

    // Optimistic update — UI responds immediately
    updateTask(id, { status: newStatus, completedAt: isCompleted ? null : nowStr })

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const data = await res.json(); updateTask(id, data)
        if (!isCompleted) toast({ title: language === 'fr' ? 'Tâche terminée !' : language === 'zh' ? '任務已完成！' : 'Task completed!', variant: 'success' })
      } else {
        updateTask(id, task) // roll back
        toast({ title: language === 'fr' ? 'Erreur de mise à jour' : language === 'zh' ? '更新失敗' : 'Update failed', variant: 'error' })
      }
    } catch {
      updateTask(id, task) // roll back on network error
      toast({ title: language === 'fr' ? 'Erreur réseau' : language === 'zh' ? '網路錯誤' : 'Network error', variant: 'error' })
    }
  }

  // A calendar event has no done state of its own: it is tracked through the
  // task linked to it, created the first time the event is checked off.
  const taskForEvent = (ev: CalendarEvent) => tasks.find((t) => t.calendarEventId === ev.id)
  const isEventDone = (ev: CalendarEvent) => taskForEvent(ev)?.status === 'COMPLETED'

  const handleToggleEvent = async (ev: CalendarEvent) => {
    const linked = taskForEvent(ev)
    if (linked) return handleComplete(linked.id)
    try {
      const deadline = ev.end ?? ev.start
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ev.title,
          calendarEventId: ev.id,
          calendarAccountId: ev.calendarAccountId,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const created: Task = await res.json()
      const doneRes = await fetch(`/api/tasks/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      if (!doneRes.ok) throw new Error()
      const done: Task = await doneRes.json()
      if (tasks.some((t) => t.id === done.id)) updateTask(done.id, done)
      else addTask(done)
    } catch {
      toast({ title: language === 'fr' ? 'Erreur de mise à jour' : language === 'zh' ? '更新失敗' : 'Update failed', variant: 'error' })
    }
  }

  const handleSaveTask = async (data: Partial<Task>) => {
    const failed = (fr: string, zh: string, en: string) => () =>
      toast({ title: language === 'fr' ? fr : language === 'zh' ? zh : en, variant: 'error' })
    if (editingTask) {
      setEditingTask(null)
      await saveTaskEdit(editingTask.id, data, failed('Modification non enregistrée', '修改未儲存', 'Change not saved'))
      return
    }
    setEditingTask(null)
    // Sync the new task to Google Calendar first if an account is selected
    const createEvent = async (): Promise<Partial<Task>> => {
      if (!data.calendarAccountId || !data.deadline) return {}
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
        if (evRes.ok) return { calendarEventId: (await evRes.json()).eventId }
      } catch { /* best-effort */ }
      return {}
    }
    await createTaskOptimistic(data, failed('Impossible de créer la tâche', '無法建立任務', 'Could not create the task'), createEvent)
  }

  // Dismissing an overdue item marks it cancelled: off every list, but kept
  // (deleting a calendar-linked task would only have the sync recreate it).
  const handleDismiss = async (ids: string[]) => {
    const before = tasks
    ids.forEach((id) => updateTask(id, { status: 'CANCELLED' }))
    const results = await Promise.all(ids.map((id) =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      }).then((r) => r.ok).catch(() => false)))
    if (results.some((ok) => !ok)) {
      setTasks(before)
      toast({ title: language === 'fr' ? 'Erreur de mise à jour' : language === 'zh' ? '更新失敗' : 'Update failed', variant: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    if (isPendingTaskId(id)) return
    const before = tasks
    removeTask(id)
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) {
      setTasks(before)
      toast({ title: language === 'fr' ? 'Suppression impossible' : language === 'zh' ? '刪除失敗' : 'Delete failed', variant: 'error' })
      return
    }
    // Mirror the server: children of a deleted task are detached, and a deleted
    // subtask leaves its parent's list.
    for (const t of before) {
      if (t.parentTaskId === id) updateTask(t.id, { parentTaskId: null })
      if (t.subTasks?.some((sub) => sub.id === id)) updateTask(t.id, { subTasks: t.subTasks.filter((sub) => sub.id !== id) })
    }
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

  const habitFailed = () =>
    toast({ title: language === 'fr' ? 'Erreur de mise à jour' : language === 'zh' ? '更新失敗' : 'Update failed', variant: 'error' })
  const handleCompleteHabit = (habitId: string) => completeHabitOptimistic(habitId, habitFailed)
  const handleUncompleteHabit = (habitId: string) => uncompleteHabitOptimistic(habitId, habitFailed)

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
        toast({ title: language === 'fr' ? 'Retiré du planning' : language === 'zh' ? '已移出行程' : 'Removed from schedule', variant: 'success' })
      }
      return
    }

    // Schedule: drag from right panel to hour slot
    if (!overId.startsWith('hour-') || activeId.startsWith('scheduled-')) return
    const hour = parseInt(overId.replace('hour-', ''), 10)
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, 0, 0)
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2 px-4 py-3 md:px-6 md:py-0 md:h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <Sundial className="h-8 w-8" />
            <h1 className="text-2xl font-serif text-[#2a2420] tracking-tight leading-none">{t('today', language)}</h1>

          </div>
          <p className="hidden sm:block text-[13px] text-[#8a7a5e] mt-1 capitalize pl-[42px]">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
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
            <span className="hidden sm:inline">{language === 'fr' ? 'Filtres' : language === 'zh' ? '篩選' : 'Filters'}</span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={language === 'fr' ? 'Raccourcis clavier (?)' : language === 'zh' ? '鍵盤快捷鍵（?）' : 'Keyboard shortcuts (?)'}
            title={language === 'fr' ? 'Raccourcis clavier (?)' : language === 'zh' ? '鍵盤快捷鍵（?）' : 'Keyboard shortcuts (?)'}
            onClick={openShortcutsHelp}
            className="hidden md:inline-flex text-[#8a7a5e] hover:text-[#ab3326] hover:bg-[#f3ecdd]"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setShowTaskForm(true)} data-tour="add-task"
            className="bg-gradient-to-br from-[#c44a3a] to-[#861f17] hover:from-[#ab3326] hover:to-[#6e190f] text-[#f3ecdd] border-0 shadow-md shadow-[#ab3326]/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('addTask', language)}</span>
          </Button>
        </div>
      </div>

      {/* Today exclude-pattern filter panel */}
      {filterPanelOpen && (
        <div className="border-b border-[#ece2cb] bg-[#f8f4ea] px-4 md:px-6 py-4">
          <PatternEditor
            icon={<span>🚫</span>}
            label={language === 'fr' ? "Masquer de Aujourd'hui" : language === 'zh' ? '從今日頁面隱藏' : 'Hide from Today'}
            placeholder={language === 'fr' ? 'ex: Meeting' : language === 'zh' ? '例：會議' : 'e.g. Meeting'}
            patterns={todayExcludePatterns}
            onChange={setTodayExcludePatterns}
          />
          <PatternEditor
            className="mt-4"
            icon={<Bell className="h-3.5 w-3.5 text-[#b08948]" />}
            label={language === 'fr' ? 'Rappels (anniversaires…)' : language === 'zh' ? '提醒（生日等）' : 'Reminders (birthdays…)'}
            hint={language === 'fr'
              ? 'Les tâches et événements dont le titre contient ces mots apparaissent dans « Rappels » et non dans la liste.'
              : language === 'zh'
                ? '標題含有這些字的任務與事件會放進「提醒」區，不列入待辦。'
                : 'Tasks and events whose title contains these words go to Reminders instead of the to-do list.'}
            placeholder={language === 'fr' ? 'ex: Anniversaire' : language === 'zh' ? '例：生日' : 'e.g. Birthday'}
            patterns={todayReminderPatterns}
            onChange={setTodayReminderPatterns}
          />
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto md:overflow-hidden min-h-0 p-4 md:p-6 flex flex-col gap-4 animate-fade-in">
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

          <div className="grid grid-cols-3 gap-2 md:gap-4 stagger">
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
              <div key={label} className={`card-lift rounded-2xl border ${border} ${bg} paper-surface p-3 md:p-4 flex items-center gap-2 md:gap-3.5 min-w-0`}>
                <div className={`hidden sm:flex h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} items-center justify-center shadow-md ${shadow} shrink-0`}>
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
                <button
                  onClick={() => toggleHabitsView('today')}
                  className={`ml-auto text-[10px] rounded-full px-2 py-0.5 border transition-colors ${habitsHidden ? 'border-[#d1c9b8] text-[#a99873] bg-transparent' : 'border-[#4f6f5e]/40 text-[#4f6f5e] bg-[#4f6f5e]/10'}`}
                >
                  {habitsHidden ? (language === 'zh' ? '顯示' : language === 'fr' ? 'Afficher' : 'Show') : (language === 'zh' ? '隱藏' : language === 'fr' ? 'Masquer' : 'Hide')}
                </button>
              </h2>
              {!habitsHidden && <div className="flex flex-wrap gap-2">
                {todayHabits.map((habit) => {
                  const doneToday = isSelectedToday ? ((habit as Habit & { completions?: { id: string }[] }).completions?.length ?? 0) : 0
                  return (
                    <button
                      key={habit.id}
                      onClick={() => doneToday > 0 ? handleUncompleteHabit(habit.id) : handleCompleteHabit(habit.id)}
                      // Check-ins are recorded for the actual today; on any other
                      // day the chips only show the habit, they don't log anything.
                      disabled={!isSelectedToday}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition-all disabled:cursor-default disabled:opacity-70 ${
                        doneToday > 0
                          ? 'bg-[#4f6f5e]/10 border-[#4f6f5e]/30 text-[#3d5a4b] hover:bg-[#ab3326]/10 hover:border-[#ab3326]/30 hover:text-[#861f17]'
                          : 'bg-[#fbf7ee] border-[#e2d6bc] text-[#5c5347] hover:border-[#cba968] hover:bg-[#f3ecdd]'
                      }`}
                      title={!isSelectedToday
                        ? (language === 'fr' ? "Pointage possible seulement aujourd'hui" : language === 'zh' ? '只能在今天打卡' : 'Check-ins only for today')
                        : doneToday > 0 ? (language === 'fr' ? 'Annuler' : language === 'zh' ? '取消' : 'Undo') : undefined}
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
              </div>}
            </div>
          )}

          {(reminderTasks.length > 0 || reminderEvents.length > 0) && (
            <div>
              <h2 className="text-sm font-semibold text-[#5c5347] mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#b08948]" />
                {language === 'fr' ? 'Rappels' : language === 'zh' ? '提醒' : 'Reminders'}
              </h2>
              <div className="flex flex-wrap gap-2">
                {reminderTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => { setEditingTask(task); setShowTaskForm(true) }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm border bg-[#b08948]/[0.08] border-[#cba968]/50 text-[#6e5228] hover:bg-[#b08948]/15 transition-colors"
                  >
                    <Bell className="h-3.5 w-3.5 text-[#b08948]" />
                    {task.title}
                    {task.scheduledStart && (
                      <span className="text-xs text-[#a99873]">{formatTime(String(task.scheduledStart))}</span>
                    )}
                  </button>
                ))}
                {reminderEvents.map((ev) => (
                  <span
                    key={ev.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm border bg-[#b08948]/[0.08] border-[#cba968]/50 text-[#6e5228]"
                  >
                    <Bell className="h-3.5 w-3.5 text-[#b08948]" />
                    {ev.title}
                    {!ev.allDay && ev.start && (
                      <span className="text-xs text-[#a99873]">{formatTime(String(ev.start))}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Two-column split: left = today's schedule, right = priority tasks */}
          <DndContext onDragEnd={handleScheduleTask}>
            <div className="md:flex-1 md:min-h-0 flex flex-col md:flex-row gap-4">
              {/* Left: Today's schedule timeline (below the tasks on phones) */}
              <div className="order-2 md:order-none w-full md:w-[400px] max-h-[480px] md:max-h-none shrink-0 rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] overflow-hidden flex flex-col">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#ece2cb]">
                  <CalendarDays className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-[#5c5347]">
                    {language === 'fr' ? "Agenda du jour" : language === 'zh' ? '今日行程' : "Today's schedule"}
                  </span>
                  <span className="text-[10px] text-[#a99873] ml-auto">
                    {language === 'fr' ? 'Déposer pour planifier' : language === 'zh' ? '拖入以排程' : 'Drop to schedule'}
                  </span>
                </div>
                <div ref={scheduleScrollRef} className="overflow-y-auto p-2 flex flex-col gap-0.5">
                  {SCHEDULE_HOURS.map((hour) => {
                    const nowHour = new Date().getHours()
                    const eventsAtHour = todayEvents
                      .filter((ev) => !ev.allDay && ev.start && !isReminder(ev.title))
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
                        isEventDone={isEventDone}
                        onToggleEvent={handleToggleEvent}
                        onToggleTask={(t) => handleComplete(t.id)}
                        lang={language}
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
                    <img src="/img/empty-task.webp" alt="" className="h-20 w-20 mb-4 opacity-70" />
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
                          <span
                            className="text-[10px] text-red-400 shrink-0"
                            title={deadlineTooltip(String(task.deadline), language, selectedDate)}
                          >
                            {formatDeadlineLabel(String(task.deadline), language, selectedDate)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {overdueTasks.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setShowOverdue((v) => !v)}
                        className="text-xs font-semibold text-[#ab3326] flex items-center gap-1.5 shrink-0"
                      >
                        {showOverdue ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <AlarmCheck className="h-3.5 w-3.5" />
                        {language === 'fr' ? `En retard (${overdueTasks.length})` : language === 'zh' ? `過期未完成 (${overdueTasks.length})` : `Overdue (${overdueTasks.length})`}
                      </button>
                      <div className="flex-1 h-px bg-[#e7c894]/50" />
                      {showOverdue && overdueTasks.length > 1 && (
                        <button
                          onClick={() => {
                            if (!confirmDismissAll) { setConfirmDismissAll(true); return }
                            setConfirmDismissAll(false)
                            handleDismiss(overdueTasks.map((t) => t.id))
                          }}
                          onBlur={() => setConfirmDismissAll(false)}
                          className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${confirmDismissAll ? 'border-red-300 bg-red-50 text-red-700' : 'border-[#d1c9b8] text-[#a99873] hover:text-[#5c5347]'}`}
                        >
                          {confirmDismissAll
                            ? (language === 'fr' ? 'Confirmer ?' : language === 'zh' ? '確定全部略過？' : 'Confirm?')
                            : (language === 'fr' ? 'Tout ignorer' : language === 'zh' ? '全部略過' : 'Dismiss all')}
                        </button>
                      )}
                    </div>
                    {showOverdue && (
                      <div className="flex flex-col gap-1.5">
                        {overdueTasks.map((task) => {
                          const when = task.scheduledStart ?? task.deadline
                          return (
                            <div
                              key={task.id}
                              className="group flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/30 px-3 py-1.5 hover:bg-red-50/60 transition-colors cursor-pointer"
                              onClick={() => { setEditingTask(task); setShowTaskForm(true) }}
                            >
                              <button
                                onClick={async (e) => { e.stopPropagation(); await handleComplete(task.id) }}
                                className="shrink-0 hover:scale-110 transition-transform"
                                title={language === 'fr' ? 'Marquer comme fait' : language === 'zh' ? '標記為已完成' : 'Mark as done'}
                              >
                                <span className="h-3.5 w-3.5 rounded-full border-2 border-[#c4b48a] inline-block" />
                              </button>
                              {task.calendarEventId && <CalendarDays className="h-3 w-3 text-[#a99873] shrink-0" />}
                              <span className="flex-1 text-xs text-[#3a3326] truncate">{task.title}</span>
                              {when && (
                                <span className="text-[10px] text-red-400 shrink-0">
                                  {language === 'fr' ? `prévu le ${formatDate(String(when), language)}` : language === 'zh' ? `原定 ${formatDate(String(when), language)}` : `was ${formatDate(String(when), language)}`}
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDismiss([task.id]) }}
                                className="shrink-0 text-[10px] text-[#a99873] hover:text-[#5c5347] opacity-0 group-hover:opacity-100 transition-opacity"
                                title={language === 'fr' ? "Ignorer (ne plus afficher)" : language === 'zh' ? '略過（不再顯示）' : 'Dismiss (hide for good)'}
                              >
                                {language === 'fr' ? 'Ignorer' : language === 'zh' ? '略過' : 'Dismiss'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {upcomingTasks.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setShowUpcoming((v) => !v)}
                        className="text-xs font-semibold text-[#8a6b3e] flex items-center gap-1.5 shrink-0"
                      >
                        {showUpcoming ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <Hourglass className="h-3.5 w-3.5" />
                        {language === 'fr' ? `Bientôt (${upcomingTasks.length})` : language === 'zh' ? `即將到期 (${upcomingTasks.length})` : `Coming up (${upcomingTasks.length})`}
                      </button>
                      <div className="flex-1 h-px bg-[#e7c894]/50" />
                    </div>
                    {showUpcoming && (
                      <div className="flex flex-col gap-1.5">
                        {upcomingTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-2 rounded-xl border border-[#ece2cb] bg-[#fbf7ee] px-3 py-1.5 hover:bg-[#f3ecdd] transition-colors cursor-pointer"
                            onClick={() => { setEditingTask(task); setShowTaskForm(true) }}
                          >
                            <button
                              onClick={async (e) => { e.stopPropagation(); await handleComplete(task.id) }}
                              className="shrink-0 hover:scale-110 transition-transform"
                              title={language === 'fr' ? 'Marquer comme fait' : language === 'zh' ? '標記為已完成' : 'Mark as done'}
                            >
                              <span className="h-3.5 w-3.5 rounded-full border-2 border-[#c4b48a] inline-block" />
                            </button>
                            {/* Important work gets a red mark so it can be started early */}
                            {task.importance >= 7 && <span className="h-1.5 w-1.5 rounded-full bg-[#ab3326] shrink-0" />}
                            <span className="flex-1 text-xs text-[#3a3326] truncate">{task.title}</span>
                            {task.estimatedMinutes ? (
                              <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-[#a99873] shrink-0">
                                <Clock className="h-3 w-3" />
                                {task.estimatedMinutes >= 60
                                  ? `${Math.floor(task.estimatedMinutes / 60)}h${task.estimatedMinutes % 60 ? String(task.estimatedMinutes % 60).padStart(2, '0') : ''}`
                                  : `${task.estimatedMinutes} min`}
                              </span>
                            ) : null}
                            <span
                              className="text-[10px] text-[#8a6b3e] shrink-0"
                              title={deadlineTooltip(String(task.deadline), language, selectedDate)}
                            >
                              {dueInLabel(String(task.deadline), selectedDate, language)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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
                      {completedOwn.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={handleComplete}
                          onEdit={(t) => { setEditingTask(t); setShowTaskForm(true) }}
                          onDelete={handleDelete}
                          onBreakdown={setBreakdownTask}
                          onReschedule={handleReschedule}
                          lang={language}
                          selectedDate={selectedDate}
                          compact
                        />
                      ))}
                    </div>
                    {completedCatchUp.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setShowCatchUp((v) => !v)}
                          className="flex items-center gap-1 text-xs text-[#8a7a5e] hover:text-[#5c5347] py-1"
                        >
                          {showCatchUp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          {language === 'fr'
                            ? `${completedCatchUp.length} tâche(s) en retard rattrapée(s) ce jour`
                            : language === 'zh'
                              ? `這天補完的逾期任務（${completedCatchUp.length}）`
                              : `${completedCatchUp.length} overdue task(s) caught up this day`}
                        </button>
                        {showCatchUp && (
                          <div className="flex flex-col gap-2 mt-1">
                            {completedCatchUp.map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                onComplete={handleComplete}
                                onEdit={(t) => { setEditingTask(t); setShowTaskForm(true) }}
                                onDelete={handleDelete}
                                onBreakdown={setBreakdownTask}
                                onReschedule={handleReschedule}
                                lang={language}
                                selectedDate={selectedDate}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
