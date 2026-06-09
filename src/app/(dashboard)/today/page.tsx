'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, Habit } from '@/types'
import { t } from '@/lib/i18n'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { AIChat } from '@/components/ai/AIChat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { generatePriorityList, formatDate, formatTime } from '@/lib/utils'
import {
  Plus, Sparkles, Sun, Flame, RefreshCw, MessageSquare, ChevronRight,
  CheckCircle2, Clock, Loader2, X, AlarmCheck,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function TodayPage() {
  const { language, tasks, habits, setTasks, setHabits, calendarAccounts } = useAppStore()
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

  const today = format(new Date(), 'PPPP', { locale: language === 'fr' ? fr : enUS })

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

  const prioritizedTasks = generatePriorityList(
    tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.parentTaskId === null)
  )

  const completedToday = tasks.filter(
    (t) => t.status === 'COMPLETED' && t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
  )

  const handleComplete = async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    })
    if (res.ok) {
      setTasks(tasks.map((t) => t.id === id ? { ...t, status: 'COMPLETED', completedAt: new Date().toISOString() } : t))
      toast({ title: language === 'fr' ? 'Tâche terminée !' : 'Task completed!', variant: 'success' })
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
        toast({ title: language === 'fr' ? 'Tâche créée !' : 'Task created!', variant: 'success' })
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
    toast({ title: language === 'fr' ? 'Sous-tâches créées !' : 'Subtasks created!', variant: 'success' })
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
    toast({ title: language === 'fr' ? 'Tâche reprogrammée !' : 'Task rescheduled!', variant: 'success' })
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
      setHabits(habits.map((h) => h.id === habitId ? { ...h, streak } : h))
      toast({ title: language === 'fr' ? `Habitude accomplie ! 🔥 Série: ${streak}` : `Habit done! 🔥 Streak: ${streak}`, variant: 'success' })
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe8f8] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/30">
              <Sun className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#0f0d1e] tracking-tight">{t('today', language)}</h1>
          </div>
          <p className="text-[13px] text-[#9896a8] mt-0.5 capitalize pl-9">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          {AI_ENABLED && (
            <Button variant="outline" size="sm" onClick={handleGenerateRecap} disabled={recapLoading}
              className="border-[#ebe8f8] text-[#4a4866] hover:bg-[#f7f6ff] hover:border-indigo-200 transition-all">
              {recapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t('morningRecap', language)}
            </Button>
          )}
          {AI_ENABLED && (
            <Button variant="ghost" size="icon" onClick={() => setShowChat(!showChat)}
              className="text-[#9896a8] hover:text-indigo-600 hover:bg-[#f7f6ff]">
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" onClick={() => setShowTaskForm(true)}
            className="bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white border-0 shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            {t('addTask', language)}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {AI_ENABLED && recap && (
            <div className="relative rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-5">
              <button onClick={() => setRecap(null)} className="absolute right-3 top-3 p-1 rounded-lg hover:bg-white/50 text-gray-400">
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-700">{t('morningRecap', language)}</span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{recap}</p>
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
                  <div className="rounded-xl bg-white border border-amber-200 p-3">
                    <p className="text-xs font-semibold text-gray-600 mb-1">{language === 'fr' ? 'Créneau suggéré' : 'Suggested slot'}</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(rescheduleSuggestion.start, language)} · {formatTime(rescheduleSuggestion.start)} – {formatTime(rescheduleSuggestion.end)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{rescheduleSuggestion.reason}</p>
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
                label: language === 'fr' ? 'À faire' : 'To do',
                value: prioritizedTasks.length,
                icon: AlarmCheck,
                gradient: 'from-indigo-500 to-violet-600',
                shadow: 'shadow-indigo-500/20',
                textColor: 'text-indigo-700',
                bg: 'bg-gradient-to-br from-indigo-50 to-violet-50',
                border: 'border-indigo-100',
              },
              {
                label: language === 'fr' ? 'Terminées' : 'Completed',
                value: completedToday.length,
                icon: CheckCircle2,
                gradient: 'from-emerald-400 to-teal-500',
                shadow: 'shadow-emerald-500/20',
                textColor: 'text-emerald-700',
                bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
                border: 'border-emerald-100',
              },
              {
                label: language === 'fr' ? 'Habitudes' : 'Habits',
                value: todayHabits.length,
                icon: Flame,
                gradient: 'from-amber-400 to-orange-500',
                shadow: 'shadow-amber-500/20',
                textColor: 'text-amber-700',
                bg: 'bg-gradient-to-br from-amber-50 to-orange-50',
                border: 'border-amber-100',
              },
            ].map(({ label, value, icon: Icon, gradient, shadow, textColor, bg, border }) => (
              <div key={label} className={`card-lift rounded-2xl border ${border} ${bg} p-4 flex items-center gap-3.5`}>
                <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md ${shadow} shrink-0`}>
                  <Icon className="h-4.5 w-4.5 text-white h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0f0d1e] leading-none mb-0.5">{value}</p>
                  <p className={`text-xs font-medium ${textColor}`}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {todayHabits.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#4a4866] mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                {t('habits', language)}
              </h2>
              <div className="flex flex-wrap gap-2">
                {todayHabits.map((habit) => {
                  const doneToday = (habit as Habit & { completions?: { id: string }[] }).completions?.length ?? 0
                  return (
                    <button
                      key={habit.id}
                      onClick={() => doneToday === 0 && handleCompleteHabit(habit.id)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition-all ${
                        doneToday > 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: habit.color }} />
                      {habit.title}
                      {habit.streak > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600">
                          <Flame className="h-3 w-3" />
                          {habit.streak}
                        </span>
                      )}
                      {doneToday > 0 && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#4a4866] flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                {language === 'fr' ? 'Tâches prioritaires' : 'Priority tasks'}
                <Badge variant="default" className="text-xs bg-indigo-100 text-indigo-700 border-0">{prioritizedTasks.length}</Badge>
              </h2>
            </div>

            {prioritizedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">{t('noTasks', language)}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowTaskForm(true)}>
                  <Plus className="h-4 w-4" />
                  {t('addTask', language)}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {prioritizedTasks.map((task, index) => (
                  <div key={task.id} className="flex items-start gap-3">
                    <span className="h-6 w-6 flex items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 shrink-0 mt-3">
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
              <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {language === 'fr' ? `Terminées aujourd'hui (${completedToday.length})` : `Completed today (${completedToday.length})`}
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
          <div className="w-80 shrink-0 border-l border-gray-100 overflow-hidden flex flex-col">
            <AIChat lang={language} onClose={() => setShowChat(false)} />
          </div>
        )}
      </div>

      <TaskForm
        open={showTaskForm}
        onClose={() => { setShowTaskForm(false); setEditingTask(null) }}
        onSave={handleSaveTask}
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
