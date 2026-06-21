'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore, AppState, KeywordRule } from '@/stores/useAppStore'
import { Task, Habit } from '@/types'
import { t } from '@/lib/i18n'
import { EisenhowerMatrix } from '@/components/matrix/EisenhowerMatrix'
import { GoalsSection } from '@/components/matrix/GoalsSection'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, Loader2, Repeat2, CheckCircle2, Circle, Settings, Wand2, Trash2, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn } from '@/lib/utils'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function MatrixPage() {
  const { language, tasks, setTasks, calendarAccounts, habits, setHabits, matrixExcludePatterns, setMatrixExcludePatterns, keywordRules, setKeywordRules } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)
  const [filterAccountId, setFilterAccountId] = useState<string | 'all'>('all')
  const [habitPanelOpen, setHabitPanelOpen] = useState(true)
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false)
  const [newRuleKeyword, setNewRuleKeyword] = useState('')
  const [newRuleImportance, setNewRuleImportance] = useState(5)
  const [newRuleUrgence, setNewRuleUrgence] = useState(5)
  const [newExcludePattern, setNewExcludePattern] = useState('')

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

  // Filter tasks: exclude calendar-imported events and exclusion patterns
  const filteredTasks = (filterAccountId === 'all' ? tasks : tasks.filter((t) => t.calendarAccountId === filterAccountId))
    .filter((t) => !t.calendarEventId && !t.scheduledStart && !isExcludedFromMatrix(t.title))

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
        <div className="flex items-center gap-2">
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
