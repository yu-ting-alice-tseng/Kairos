'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task } from '@/types'
import { t } from '@/lib/i18n'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatTime, getQuadrant, EISENHOWER_QUADRANTS } from '@/lib/utils'
import {
  ChevronLeft, ChevronRight, Calendar, Plus, Clock, Loader2,
} from 'lucide-react'
import {
  format, startOfWeek, endOfWeek, addDays, isSameDay, addWeeks, subWeeks,
  isToday, startOfDay, getHours, getMinutes,
} from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7)

export default function CalendarPage() {
  const { language, tasks, setTasks, calendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmChange, setConfirmChange] = useState<{ task: Task; newStart: Date; newEnd: Date } | null>(null)

  const locale = language === 'fr' ? fr : enUS
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const loadTasks = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/tasks')
    setTasks(await res.json())
    setLoading(false)
  }, [setTasks])

  useEffect(() => { loadTasks() }, [loadTasks])

  const scheduledTasks = tasks.filter((t) => t.scheduledStart && t.scheduledEnd)

  const getTasksForDayHour = (day: Date, hour: number) =>
    scheduledTasks.filter((task) => {
      if (!task.scheduledStart) return false
      const start = new Date(task.scheduledStart)
      return isSameDay(start, day) && getHours(start) === hour
    })

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
        setTasks(tasks.map((t) => t.id === editingTask.id ? updated : t))
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
              {format(weekStart, 'dd MMM', { locale })} – {format(endOfWeek(currentWeek, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale })}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentWeek(new Date())}>
              {t('today', language)}
            </Button>
          </div>
        </div>
        <Button size="sm" onClick={() => { setSelectedDate(new Date()); setShowTaskForm(true) }}>
          <Plus className="h-4 w-4" />
          {t('addTask', language)}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-[700px]">
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

          <div className="relative">
            {HOURS.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-50 min-h-[56px]">
                <div className="px-2 py-1 text-xs text-gray-400 text-right border-r border-gray-100 w-12 shrink-0">
                  {hour}:00
                </div>
                {weekDays.map((day) => {
                  const cellTasks = getTasksForDayHour(day, hour)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'border-r border-gray-100 px-1 py-0.5 cursor-pointer hover:bg-gray-50 transition-colors min-h-[56px]',
                        isToday(day) && 'bg-indigo-50/30'
                      )}
                      onClick={() => cellTasks.length === 0 && handleCellClick(day, hour)}
                    >
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
    </div>
  )
}
