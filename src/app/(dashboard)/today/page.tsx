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
import { generatePriorityList, formatDate, formatTime } from '@/lib/utils'
import {
  Plus, Sparkles, Sun, Flame, RefreshCw, MessageSquare, ChevronRight,
  CheckCircle2, Clock, Loader2, X, AlarmCheck, Zap, CalendarDays,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function TodayPage() {
  const { language, tasks, habits, setTasks, setHabits, calendarAccounts, todayExcludePatterns } = useAppStore()
  const { toast } = useGlobalToast()

  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [recap, setRecap] = useState<string | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null)
  const [rescheduleSuggestion, setRescheduleSuggestion] = useState<{ start: string; end: string; reason: string } | null>(null)
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [tomorrowEvents, setTomorrowEvents] = useState<CalendarEvent[]>([])

  const today = format(new Date(), 'PPPP', { locale: language === 'fr' ? fr : language === 'zh' ? zhTW : enUS })

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
        const now = new Date()
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
        const tmrStart = new Date(now); tmrStart.setDate(tmrStart.getDate() + 1); tmrStart.setHours(0, 0, 0, 0)
        const tmrEnd = new Date(now); tmrEnd.setDate(tmrEnd.getDate() + 1); tmrEnd.setHours(23, 59, 59, 999)

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
  }, [calendarAccounts.length])

  const isExcludedFromToday = (title: string) =>
    todayExcludePatterns.some((p) => p && title.toLowerCase().includes(p.toLowerCase()))

  const prioritizedTasks = generatePriorityList(
    tasks.filter((t) =>
      t.status !== 'COMPLETED' &&
      t.status !== 'CANCELLED' &&
      t.parentTaskId === null &&
      !t.calendarEventId &&
      !isExcludedFromToday(t.title)
    )
  )

  const completedToday = tasks.filter(
    (t) => t.status === 'COMPLETED' && t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
  )

  const handleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const isCompleted = task.status === 'COMPLETED'
    const newStatus = isCompleted ? 'PENDING' : 'COMPLETED'
    const nowStr = new Date().toISOString()

    // Optimistic update — UI responds immediately
    setTasks(tasks.map((t) => t.id === id ? { ...t, status: newStatus, completedAt: isCompleted ? null : nowStr } : t))

    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      // Revert on error
      setTasks(tasks.map((t) => t.id === id ? task : t))
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
        setTasks(tasks.map((t) => t.id === editingTask.id ? updated : t))
      }
    } else {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks([...tasks, created])
        toast({ title: language === 'fr' ? 'Tâche créée !' : language === 'zh' ? '任務已建立！' : 'Task created!', variant: 'success' })
      }
    }
    setEditingTask(null)
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(tasks.filter((t) => t.id !== id))
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
    const dow = new Date().getDay()
    if (h.frequency === 'DAILY') return true
    if (h.frequency === 'WEEKDAYS') return dow >= 1 && dow <= 5
    if (h.frequency === 'WEEKENDS') return dow === 0 || dow === 6
    return true
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f7f6ff]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-red-500 to-amber-700 flex items-center justify-center shadow-lg shadow-red-500/30 animate-float">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-red-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2d6bc] bg-[#fbf7ee]/85 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <Sundial className="h-8 w-8" />
            <h1 className="text-2xl font-brush text-[#2a2420] tracking-tight leading-none">{t('today', language)}</h1>

          </div>
          <p className="text-[13px] text-[#8a7a5e] mt-1 capitalize pl-[42px]">{today}</p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={() => setShowTaskForm(true)}
            className="bg-gradient-to-br from-[#c44a3a] to-[#861f17] hover:from-[#ab3326] hover:to-[#6e190f] text-[#f3ecdd] border-0 shadow-md shadow-[#ab3326]/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            {t('addTask', language)}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 animate-fade-in">
          {AI_ENABLED && recap && (
            <div className="relative rounded-2xl bg-gradient-to-br from-red-50 to-amber-50 border border-red-100 p-5">
              <button onClick={() => setRecap(null)} className="absolute right-3 top-3 p-1 rounded-lg hover:bg-[#fbf7ee]/50 text-[#a99873]">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-red-800" />
                <span className="text-sm font-semibold text-red-900">{t('morningRecap', language)}</span>
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

          {todayEvents.length > 0 && (
            <div className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#ece2cb]">
                <CalendarDays className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-[#5c5347]">
                  {language === 'fr' ? "Agenda du jour" : language === 'zh' ? '今日行程' : "Today's schedule"}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                {todayEvents
                  .filter(ev => !ev.allDay)
                  .sort((a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime())
                  .map(ev => {
                    const acc = calendarAccounts.find(a => a.id === ev.calendarAccountId)
                    const color = ev.color ?? acc?.color ?? '#6366F1'
                    return (
                      <div key={ev.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm border border-[#ece2cb] bg-white/40">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium text-[#2a2420] flex-1 truncate">{ev.title}</span>
                        {ev.start && ev.end && (
                          <span className="text-xs text-[#8a7a5e] shrink-0">{formatTime(ev.start)} – {formatTime(ev.end)}</span>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {tomorrowEvents.filter(ev => !ev.allDay).length > 0 && (
            <div className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#ece2cb]">
                <CalendarDays className="h-4 w-4 text-[#a99873]" />
                <span className="text-sm font-semibold text-[#5c5347]">
                  {language === 'fr' ? 'Demain' : language === 'zh' ? '明日行程' : "Tomorrow's schedule"}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-1.5">
                {tomorrowEvents
                  .filter(ev => !ev.allDay)
                  .sort((a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime())
                  .map(ev => {
                    const acc = calendarAccounts.find(a => a.id === ev.calendarAccountId)
                    const color = ev.color ?? acc?.color ?? '#6366F1'
                    return (
                      <div key={ev.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm border border-[#ece2cb] bg-white/40">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-medium text-[#2a2420] flex-1 truncate">{ev.title}</span>
                        {ev.start && ev.end && (
                          <span className="text-xs text-[#8a7a5e] shrink-0">{formatTime(ev.start)} – {formatTime(ev.end)}</span>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 stagger">
            {[
              {
                label: language === 'fr' ? 'À faire' : language === 'zh' ? '待辦' : 'To do',
                value: prioritizedTasks.length,
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

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#4a4866] flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-500" />
                {language === 'fr' ? 'Tâches prioritaires' : language === 'zh' ? '優先任務' : 'Priority tasks'}
                <Badge variant="default" className="text-xs bg-red-100 text-red-900 border-0">{prioritizedTasks.length}</Badge>
              </h2>
            </div>

            {prioritizedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#ebe8f8] py-12 text-center bg-[#fbf7ee]/60">
                <div className="h-14 w-14 rounded-2xl bg-[#f7f6ff] border border-[#ebe8f8] flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-7 w-7 text-red-300" />
                </div>
                <p className="text-sm font-medium text-[#9896a8]">{t('noTasks', language)}</p>
                <Button variant="outline" size="sm"
                  className="mt-4 border-[#ebe8f8] text-[#4a4866] hover:bg-[#f7f6ff] hover:border-red-200"
                  onClick={() => setShowTaskForm(true)}>
                  <Plus className="h-4 w-4" />
                  {t('addTask', language)}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 stagger">
                {prioritizedTasks.map((task, index) => (
                  <div key={task.id} className="flex items-start gap-3">
                    <span className="h-6 w-6 flex items-center justify-center rounded-full bg-red-50 text-xs font-bold text-red-400 shrink-0 mt-3 border border-red-100">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <TaskCard
                        task={task}
                        onComplete={handleComplete}
                        onEdit={(t) => { setEditingTask(t); setShowTaskForm(true) }}
                        onDelete={handleDelete}
                        onBreakdown={setBreakdownTask}
                        onReschedule={handleReschedule}
                        lang={language}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {completedToday.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#b8b4cc] mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {language === 'fr' ? `Terminées aujourd'hui (${completedToday.length})` : language === 'zh' ? `今日已完成 (${completedToday.length})` : `Completed today (${completedToday.length})`}
              </h2>
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
