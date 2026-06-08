'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task } from '@/types'
import { t } from '@/lib/i18n'
import { EisenhowerMatrix } from '@/components/matrix/EisenhowerMatrix'
import { TaskForm } from '@/components/tasks/TaskForm'
import { BreakdownDialog } from '@/components/ai/BreakdownDialog'
import { Button } from '@/components/ui/button'
import { Plus, LayoutGrid, Loader2 } from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export default function MatrixPage() {
  const { language, tasks, setTasks, calendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [breakdownTask, setBreakdownTask] = useState<Task | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }, [setTasks])

  useEffect(() => { loadTasks() }, [loadTasks])

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
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('matrix', language)}</h1>
          <span className="text-sm text-gray-500 ml-2">
            {language === 'fr' ? 'Glissez les tâches pour les prioriser' : 'Drag tasks to prioritize'}
          </span>
        </div>
        <Button size="sm" onClick={() => setShowTaskForm(true)}>
          <Plus className="h-4 w-4" />
          {t('addTask', language)}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <EisenhowerMatrix
          tasks={tasks}
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
