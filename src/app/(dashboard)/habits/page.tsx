'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Habit } from '@/types'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Repeat2, Plus, Flame, CheckCircle2, Trophy, Loader2, Trash2, Edit2, Clock } from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const HABIT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#84CC16',
]

const HABIT_ICONS = ['🎯', '📚', '💪', '🧘', '🏃', '💧', '🌿', '✍️', '🎵', '😴', '🍎', '🧠']

const FREQUENCIES = ['DAILY', 'WEEKDAYS', 'WEEKENDS', 'WEEKLY'] as const

function HabitForm({ open, onClose, onSave, habit, lang }: {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Habit>) => Promise<void>
  habit?: Habit | null
  lang: 'fr' | 'en'
}) {
  const [title, setTitle] = useState(habit?.title ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [color, setColor] = useState(habit?.color ?? '#6366F1')
  const [icon, setIcon] = useState(habit?.icon ?? '🎯')
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>(habit?.frequency as typeof FREQUENCIES[number] ?? 'DAILY')
  const [scheduledTime, setScheduledTime] = useState(habit?.scheduledTime ?? '')
  const [durationMinutes, setDurationMinutes] = useState(habit?.durationMinutes ?? 15)
  const [saving, setSaving] = useState(false)

  const freqLabels = {
    DAILY: lang === 'fr' ? 'Quotidien' : 'Daily',
    WEEKDAYS: lang === 'fr' ? 'Jours de semaine' : 'Weekdays',
    WEEKENDS: lang === 'fr' ? 'Week-ends' : 'Weekends',
    WEEKLY: lang === 'fr' ? 'Hebdomadaire' : 'Weekly',
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title, description, color, icon, frequency, scheduledTime, durationMinutes })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{habit ? t('edit', lang) : t('addHabit', lang)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('habits', lang)}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'fr' ? 'Ex: Méditation du matin' : 'E.g. Morning meditation'} autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Icône' : 'Icon'}</Label>
            <div className="flex gap-2 flex-wrap">
              {HABIT_ICONS.map((ic) => (
                <button key={ic} onClick={() => setIcon(ic)} className={cn('h-8 w-8 rounded-lg text-lg flex items-center justify-center border transition-all', icon === ic ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300')}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Couleur' : 'Color'}</Label>
            <div className="flex gap-2 flex-wrap">
              {HABIT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn('h-7 w-7 rounded-full border-2 transition-all', color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Fréquence' : 'Frequency'}</Label>
            <div className="flex gap-2 flex-wrap">
              {FREQUENCIES.map((f) => (
                <button key={f} onClick={() => setFrequency(f)} className={cn('rounded-xl px-3 py-1.5 text-sm border transition-all', frequency === f ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                  {freqLabels[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'fr' ? 'Heure' : 'Time'}</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('estimatedTime', lang)} (min)</Label>
              <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function HabitsPage() {
  const { language, habits, setHabits } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

  const loadHabits = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/habits')
    setHabits(await res.json())
    setLoading(false)
  }, [setHabits])

  useEffect(() => { loadHabits() }, [loadHabits])

  const handleSave = async (data: Partial<Habit>) => {
    if (editingHabit) {
      const res = await fetch(`/api/habits/${editingHabit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) setHabits(habits.map((h) => h.id === editingHabit.id ? { ...h, ...data } : h))
    } else {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const created = await res.json()
        setHabits([...habits, created])
        toast({ title: language === 'fr' ? 'Habitude créée !' : 'Habit created!', variant: 'success' })
      }
    }
    setEditingHabit(null)
  }

  const handleComplete = async (habitId: string) => {
    const res = await fetch('/api/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId }),
    })
    if (res.ok) {
      const { streak } = await res.json()
      setHabits(habits.map((h) => h.id === habitId ? { ...h, streak } : h))
      toast({ title: `🔥 ${language === 'fr' ? 'Série' : 'Streak'}: ${streak}`, variant: 'success' })
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/habits/${id}`, { method: 'DELETE' })
    setHabits(habits.filter((h) => h.id !== id))
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  const totalStreak = habits.reduce((acc, h) => acc + h.streak, 0)
  const topStreak = Math.max(0, ...habits.map((h) => h.longestStreak))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Repeat2 className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">{t('habits', language)}</h1>
          <Badge variant="default">{habits.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          {t('addHabit', language)}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: language === 'fr' ? 'Total habitudes' : 'Total habits', value: habits.length, icon: Repeat2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: language === 'fr' ? 'Séries actives' : 'Active streaks', value: totalStreak, icon: Flame, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: language === 'fr' ? 'Record' : 'Best streak', value: topStreak, icon: Trophy, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-2xl ${bg} p-4 flex items-center gap-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-600">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <Repeat2 className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">{t('noHabits', language)}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              {t('addHabit', language)}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {habits.map((habit) => {
              const completedToday = (habit as Habit & { completions?: { id: string }[] }).completions?.length ?? 0
              return (
                <div key={habit.id} className={cn('rounded-2xl border bg-white p-4 transition-all hover:shadow-md', completedToday > 0 ? 'border-emerald-200' : 'border-gray-100')}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{habit.icon ?? '🎯'}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{habit.title}</p>
                        <p className="text-xs text-gray-500">{habit.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingHabit(habit); setShowForm(true) }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(habit.id)} className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1">
                      <Flame className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-bold text-gray-900">{habit.streak}</span>
                      <span className="text-xs text-gray-500">{t('days', language)}</span>
                    </div>
                    {habit.scheduledTime && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {habit.scheduledTime}
                      </div>
                    )}
                    {habit.durationMinutes && (
                      <div className="text-xs text-gray-500">{habit.durationMinutes} min</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (habit.streak / Math.max(habit.longestStreak, 7)) * 100)}%`, backgroundColor: habit.color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">{language === 'fr' ? 'Série actuelle' : 'Current'}: {habit.streak}</span>
                      <span className="text-xs text-gray-400">{language === 'fr' ? 'Record' : 'Best'}: {habit.longestStreak}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => completedToday === 0 && handleComplete(habit.id)}
                    variant={completedToday > 0 ? 'success' : 'outline'}
                    size="sm"
                    className="w-full"
                    disabled={completedToday > 0}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {completedToday > 0 ? (language === 'fr' ? 'Accompli !' : 'Done!') : t('markDone', language)}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <HabitForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingHabit(null) }}
        onSave={handleSave}
        habit={editingHabit}
        lang={language}
      />
    </div>
  )
}
