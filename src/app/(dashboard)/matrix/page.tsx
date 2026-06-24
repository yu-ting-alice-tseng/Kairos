'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore, AppState, KeywordRule } from '@/stores/useAppStore'
import { Task, Habit, CalendarEvent } from '@/types'
import { t } from '@/lib/i18n'
import { EisenhowerMatrix } from '@/components/matrix/EisenhowerMatrix'
import { GoalsSection } from '@/components/matrix/GoalsSection'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, Loader2, Settings, Wand2, Trash2, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { isSameDay, format } from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn } from '@/lib/utils'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function MatrixPage() {
  const { language, tasks, setTasks, updateTask, removeTask, addTask, habits, setHabits, calendarAccounts, matrixExcludePatterns, setMatrixExcludePatterns, keywordRules, setKeywordRules } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [newRuleKeyword, setNewRuleKeyword] = useState('')
  const [newRuleImportance, setNewRuleImportance] = useState(5)
  const [newRuleUrgence, setNewRuleUrgence] = useState(5)
  const [newExcludePattern, setNewExcludePattern] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const dateInputRef = React.useRef<HTMLInputElement>(null)

  const syncRules = async (rules: KeywordRule[]) => {
    setKeywordRules(rules)
    await fetch('/api/keyword-rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rules) })
  }

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }, [setTasks])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Auto-import today's all-day calendar events as tasks (no scheduled time = belongs in matrix)
  const importedRef = React.useRef(false)
  useEffect(() => {
    if (loading || calendarAccounts.length === 0 || importedRef.current) return
    importedRef.current = true
    const run = async () => {
      try {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const end = new Date(); end.setHours(23, 59, 59, 999)
        const res = await fetch(`/api/calendar/events?start=${today.toISOString()}&end=${end.toISOString()}`)
        if (!res.ok) return
        const events: CalendarEvent[] = await res.json()
        const allDayEvents = events.filter((e) => e.allDay)
        if (allDayEvents.length === 0) return
        const existingCalIds = new Set(tasks.filter((t) => t.calendarEventId).map((t) => t.calendarEventId))
        // Also dedupe by title+today to handle recurring events that get new IDs each day
        const todayTaskTitles = new Set(
          tasks
            .filter((t) => isSameDay(new Date(String(t.createdAt)), today))
            .map((t) => t.title.toLowerCase().trim())
        )
        const toCreate = allDayEvents.filter((e) =>
          !existingCalIds.has(e.id) && !todayTaskTitles.has(e.title.toLowerCase().trim())
        )
        if (toCreate.length === 0) return
        await Promise.all(toCreate.map((e) =>
          fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: e.title,
              importance: 5,
              urgency: 5,
              calendarEventId: e.id,
              calendarAccountId: e.calendarAccountId,
              deadline: today.toISOString(),
            }),
          })
        ))
        const tasksRes = await fetch('/api/tasks')
        if (tasksRes.ok) setTasks(await tasksRes.json())
      } catch { /* best-effort */ }
    }
    run()
  }, [loading, calendarAccounts.length, tasks, setTasks])

  useEffect(() => {
    if (habits.length === 0) {
      fetch('/api/habits').then((r) => r.json()).then(setHabits).catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTaskUpdate = async (id: string, importance: number, urgency: number) => {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importance, urgency }),
    })
    if (res.ok) {
      const updated = await res.json()
      updateTask(id, updated)
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
      if (res.ok) { const updated = await res.json(); updateTask(editingTask.id, updated) }
    } else {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        addTask(created)
      }
    }
    setEditingTask(null)
  }

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    const fresh = await fetch('/api/tasks')
    if (fresh.ok) setTasks(await fresh.json())
    setEditingTask(null)
  }

  const handleCompleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    updateTask(id, { status: newStatus })
    await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
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
    const dow = selectedDate.getDay()
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

  const isDueOnDate = (task: Task, date: Date) => {
    if (task.deadline) return isSameDay(new Date(String(task.deadline)), date)
    // Auto-imported tasks (have calendarEventId) without deadline: pin to creation date
    if (task.calendarEventId) return isSameDay(new Date(String(task.createdAt)), date)
    // Manually created tasks without deadline: show only when viewing today
    return isSameDay(date, new Date())
  }

  const applyKeywordRules = (task: Task): Task => {
    const title = task.title.toLowerCase()
    const match = keywordRules.find((r) => title.includes(r.keyword.toLowerCase()))
    if (!match) return task
    return { ...task, importance: match.importance, urgency: match.urgence }
  }

  // Only unscheduled tasks (no scheduledStart) — same distinction as Calendar vs Matrix
  const filteredTasks = tasks
    .filter((t) =>
      t.status !== 'CANCELLED' &&
      !t.scheduledStart &&
      isDueOnDate(t, selectedDate) &&
      !isExcludedFromMatrix(t.title)
    )
    .map(applyKeywordRules)

  const isSelectedToday = isSameDay(selectedDate, new Date())
  const dateFnsLocale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS
  const prevDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  const nextDay = () => setSelectedDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  const goToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d) }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#a87f3e]" /></div>

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-red-800" />
            <h1 className="text-2xl font-serif text-[#2a2420]">{t('matrix', language)}</h1>
          </div>
          <span className="text-sm text-[#8a7a5e]">
            {language === 'fr' ? 'Glissez les tâches pour les prioriser' : language === 'zh' ? '拖曳任務以排定優先順序' : 'Drag tasks to prioritize'}
          </span>
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
          <button
            onClick={() => setSettingsPanelOpen((o) => !o)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm border transition-all',
              settingsPanelOpen
                ? 'bg-[#f3ecdd] border-[#cba968] text-[#5c5347]'
                : 'border-[#e2d6bc] text-[#8a7a5e] hover:bg-[#f3ecdd]'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {language === 'fr' ? 'Règles' : language === 'zh' ? '規則' : 'Rules'}
          </button>
          <Button size="sm" onClick={() => setShowTaskForm(true)}>
            <Plus className="h-4 w-4" />
            {t('addTask', language)}
          </Button>
        </div>
      </div>

      {/* Settings panel: filters + keyword rules */}
      {settingsPanelOpen && (
        <div className="border-b border-[#ece2cb] bg-[#f8f4ea] px-6 py-4 flex flex-col gap-5">
          {/* Exclude patterns */}
          <div>
            <p className="text-xs font-semibold text-[#5c5347] mb-2 flex items-center gap-1.5">
              <span>🚫</span>
              {language === 'fr' ? 'Masquer de la Matrice' : language === 'zh' ? '從矩陣隱藏' : 'Hide from Matrix'}
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {matrixExcludePatterns.map((p) => (
                <span key={p} className="flex items-center gap-1 rounded-lg bg-[#f3ecdd] border border-[#e2d6bc] px-2.5 py-1 text-xs text-[#5c5347]">
                  {p}
                  <button onClick={() => setMatrixExcludePatterns(matrixExcludePatterns.filter((x) => x !== p))} className="text-[#a99873] hover:text-red-500 ml-0.5">×</button>
                </span>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  value={newExcludePattern}
                  onChange={(e) => setNewExcludePattern(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newExcludePattern.trim()) { setMatrixExcludePatterns([...matrixExcludePatterns, newExcludePattern.trim()]); setNewExcludePattern('') } }}
                  placeholder={language === 'fr' ? 'ex: Meeting' : language === 'zh' ? '例：會議' : 'e.g. Meeting'}
                  className="border border-[#e2d6bc] rounded-lg px-2.5 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-red-300 bg-[#fbf7ee]"
                />
                <button
                  onClick={() => { if (newExcludePattern.trim()) { setMatrixExcludePatterns([...matrixExcludePatterns, newExcludePattern.trim()]); setNewExcludePattern('') } }}
                  className="text-xs px-2 py-1 rounded-lg bg-[#c44a3a] text-white hover:bg-[#ab3326]"
                >+</button>
              </div>
            </div>
          </div>

          {/* Keyword rules */}
          <div>
            <p className="text-xs font-semibold text-[#5c5347] mb-2 flex items-center gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-[#a87f3e]" />
              {language === 'fr' ? 'Règles par mot-clé' : language === 'zh' ? '關鍵字規則' : 'Keyword rules'}
            </p>
            <div className="flex flex-wrap gap-2 items-center mb-2">
              {keywordRules.map((rule) => (
                <span key={rule.id} className="flex items-center gap-1.5 rounded-lg bg-[#f3ecdd] border border-[#e2d6bc] px-2.5 py-1 text-xs text-[#5c5347]">
                  <span className="font-mono bg-white rounded px-1">{rule.keyword}</span>
                  I:{rule.importance} U:{rule.urgence}
                  <button onClick={() => syncRules(keywordRules.filter((r) => r.id !== rule.id))} className="text-[#a99873] hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <input
                value={newRuleKeyword}
                onChange={(e) => setNewRuleKeyword(e.target.value)}
                placeholder="Keyword"
                className="border border-[#e2d6bc] rounded-lg px-2.5 py-1.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-red-300 bg-[#fbf7ee]"
              />
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#8a7a5e]">Imp. ({newRuleImportance})</label>
                <input type="range" min={1} max={10} value={newRuleImportance} onChange={(e) => setNewRuleImportance(Number(e.target.value))} className="w-20 accent-red-600" />
              </div>
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#8a7a5e]">Urg. ({newRuleUrgence})</label>
                <input type="range" min={1} max={10} value={newRuleUrgence} onChange={(e) => setNewRuleUrgence(Number(e.target.value))} className="w-20 accent-amber-600" />
              </div>
              <button
                disabled={!newRuleKeyword.trim()}
                onClick={() => { if (!newRuleKeyword.trim()) return; syncRules([...keywordRules, { id: Date.now().toString(), keyword: newRuleKeyword.trim(), importance: newRuleImportance, urgence: newRuleUrgence }]); setNewRuleKeyword(''); setNewRuleImportance(5); setNewRuleUrgence(5) }}
                className="flex items-center gap-1 rounded-lg bg-[#c44a3a] text-white px-2.5 py-1.5 text-xs font-medium hover:bg-[#ab3326] disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />{language === 'fr' ? 'Ajouter' : language === 'zh' ? '新增' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <GoalsSection lang={language} />

        <EisenhowerMatrix
          tasks={filteredTasks}
          habits={todayHabits}
          onTaskUpdate={handleTaskUpdate}
          onTaskClick={handleTaskClick}
          onComplete={handleCompleteTask}
          onCompleteHabit={(id) => {
            const habit = habits.find((h) => h.id === id)
            const doneToday = ((habit as (Habit & { completions?: { id: string }[] }) | undefined)?.completions?.length ?? 0) > 0
            if (doneToday) handleUncompleteHabit(id)
            else handleCompleteHabit(id)
          }}
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
