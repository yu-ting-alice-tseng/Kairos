'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Habit, CalendarAccount } from '@/types'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Repeat2, Plus, Flame, CheckCircle2, Trophy, Loader2, Trash2, Edit2, Clock, CalendarDays } from 'lucide-react'
import { Candle } from '@/components/ui/Candle'
import { InkLoader } from '@/components/ui/InkLoader'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const HABIT_COLORS = [
  '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#F97316', '#EC4899', '#14B8A6', '#84CC16',
]

const HABIT_ICONS = ['🎯', '📚', '💪', '🧘', '🏃', '💧', '🌿', '✍️', '🎵', '😴', '🍎', '🧠']

const FREQUENCIES = ['DAILY', 'WEEKDAYS', 'WEEKENDS', 'WEEKLY'] as const

type SubCalendarItem = { externalId: string; name: string; color?: string }

function HabitForm({ open, onClose, onSave, habit, lang, calendarAccounts }: {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Habit>) => Promise<void>
  habit?: Habit | null
  lang: 'fr' | 'en' | 'zh'
  calendarAccounts: CalendarAccount[]
}) {
  const [title, setTitle] = useState(habit?.title ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [color, setColor] = useState(habit?.color ?? '#6366F1')
  const [icon, setIcon] = useState(habit?.icon ?? '🎯')
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>(habit?.frequency as typeof FREQUENCIES[number] ?? 'DAILY')
  const [scheduledTime, setScheduledTime] = useState(habit?.scheduledTime ?? '')
  const [durationMinutes, setDurationMinutes] = useState(habit?.durationMinutes ?? 15)
  const [calendarAccountId, setCalendarAccountId] = useState(habit?.calendarAccountId ?? '')
  const [calendarId, setCalendarId] = useState(habit?.calendarId ?? '')
  const [subCalendars, setSubCalendars] = useState<SubCalendarItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(habit?.title ?? '')
    setDescription(habit?.description ?? '')
    setColor(habit?.color ?? '#6366F1')
    setIcon(habit?.icon ?? '🎯')
    setFrequency((habit?.frequency as typeof FREQUENCIES[number]) ?? 'DAILY')
    setScheduledTime(habit?.scheduledTime ?? '')
    setDurationMinutes(habit?.durationMinutes ?? 15)
    setCalendarAccountId(habit?.calendarAccountId ?? '')
    setCalendarId(habit?.calendarId ?? '')
  }, [habit?.id])

  useEffect(() => {
    if (!calendarAccountId) { setSubCalendars([]); return }
    fetch(`/api/calendar/accounts/${calendarAccountId}/calendars`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSubCalendars(data.map((sc: { externalId: string; name: string; color?: string }) => ({ externalId: sc.externalId, name: sc.name, color: sc.color })))
      })
      .catch(() => setSubCalendars([]))
  }, [calendarAccountId])

  const freqLabels = {
    DAILY: lang === 'fr' ? 'Quotidien' : lang === 'zh' ? '每天' : 'Daily',
    WEEKDAYS: lang === 'fr' ? 'Jours de semaine' : lang === 'zh' ? '平日' : 'Weekdays',
    WEEKENDS: lang === 'fr' ? 'Week-ends' : lang === 'zh' ? '週末' : 'Weekends',
    WEEKLY: lang === 'fr' ? 'Hebdomadaire' : lang === 'zh' ? '每週' : 'Weekly',
  }

  const handleSave = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onSave({ title, description, color, icon, frequency, scheduledTime, durationMinutes, calendarAccountId: calendarAccountId || undefined, calendarId: calendarId || undefined })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{habit ? t('edit', lang) : t('addHabit', lang)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t('habits', lang)}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={lang === 'fr' ? 'Ex: Méditation du matin' : lang === 'zh' ? '例如：晨間靜坐' : 'E.g. Morning meditation'} autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Icône' : lang === 'zh' ? '圖示' : 'Icon'}</Label>
            <div className="flex gap-2 flex-wrap">
              {HABIT_ICONS.map((ic) => (
                <button key={ic} onClick={() => setIcon(ic)} className={cn('h-8 w-8 rounded-lg text-lg flex items-center justify-center border transition-all', icon === ic ? 'border-red-400 bg-red-50' : 'border-[#e2d6bc] hover:border-[#cbb98e]')}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Couleur' : lang === 'zh' ? '顏色' : 'Color'}</Label>
            <div className="flex gap-2 flex-wrap">
              {HABIT_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className={cn('h-7 w-7 rounded-full border-2 transition-all', color === c ? 'border-[#2a2420] scale-110' : 'border-transparent hover:scale-105')} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Fréquence' : lang === 'zh' ? '頻率' : 'Frequency'}</Label>
            <div className="flex gap-2 flex-wrap">
              {FREQUENCIES.map((f) => (
                <button key={f} onClick={() => setFrequency(f)} className={cn('rounded-xl px-3 py-1.5 text-sm border transition-all', frequency === f ? 'bg-red-50 border-red-300 text-red-900' : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]')}>
                  {freqLabels[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{lang === 'fr' ? 'Heure' : lang === 'zh' ? '時間' : 'Time'}</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('estimatedTime', lang)} (min)</Label>
              <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </div>
          </div>

          {calendarAccounts.filter((a) => a.provider === 'GOOGLE').length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {lang === 'fr' ? 'Synchroniser avec Google Calendar' : lang === 'zh' ? '同步至 Google 日曆' : 'Sync to Google Calendar'}
              </Label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => { setCalendarAccountId(''); setCalendarId('') }}
                  className={cn('rounded-xl px-3 py-1.5 text-sm border transition-all', !calendarAccountId ? 'bg-red-50 border-red-300 text-red-900' : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]')}
                >
                  {lang === 'fr' ? 'Aucun' : lang === 'zh' ? '無' : 'None'}
                </button>
                {calendarAccounts.filter((a) => a.provider === 'GOOGLE').map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => { setCalendarAccountId(acc.id); setCalendarId('') }}
                    className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm border transition-all', calendarAccountId === acc.id ? 'border-red-300 text-red-900' : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]')}
                    style={calendarAccountId === acc.id ? { backgroundColor: acc.color + '20', borderColor: acc.color } : {}}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                    {acc.name}
                  </button>
                ))}
              </div>
              {calendarAccountId && subCalendars.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-[#8a7a5e]">{lang === 'fr' ? 'Sous-calendrier' : lang === 'zh' ? '子日曆' : 'Sub-calendar'}</Label>
                  <div className="flex gap-2 flex-wrap">
                    {subCalendars.map((sc) => (
                      <button
                        key={sc.externalId}
                        onClick={() => setCalendarId(sc.externalId)}
                        className={cn('rounded-xl px-3 py-1.5 text-sm border transition-all flex items-center gap-1.5', calendarId === sc.externalId ? 'border-red-300 bg-red-50 text-red-900' : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]')}
                      >
                        {sc.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sc.color }} />}
                        {sc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
  const { language, habits, setHabits, calendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

  const loadHabits = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/habits')
      if (res.ok) setHabits(await res.json())
    } catch { /* best-effort */ } finally {
      setLoading(false)
    }
  }, [setHabits])

  useEffect(() => { loadHabits() }, [loadHabits])

  const handleSave = async (data: Partial<Habit>) => {
    const errorMsg = language === 'fr' ? 'Erreur lors de la sauvegarde' : language === 'zh' ? '儲存失敗，請稍後再試' : 'Failed to save, please try again'
    if (editingHabit) {
      try {
        const res = await fetch(`/api/habits/${editingHabit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          const updated = await res.json()
          setHabits(habits.map((h) => h.id === editingHabit.id ? updated : h))
          toast({ title: language === 'fr' ? 'Habitude mise à jour !' : language === 'zh' ? '習慣已更新！' : 'Habit updated!', variant: 'success' })
        } else {
          const err = await res.json().catch(() => ({}))
          console.error('PATCH habit error:', err)
          toast({ title: errorMsg, variant: 'error' })
        }
      } catch (e) {
        console.error(e)
        toast({ title: errorMsg, variant: 'error' })
      }
    } else {
      try {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          const created = await res.json()
          setHabits([...habits, created])
          toast({ title: language === 'fr' ? 'Habitude créée !' : language === 'zh' ? '習慣已建立！' : 'Habit created!', variant: 'success' })
        } else {
          const err = await res.json().catch(() => ({}))
          console.error('POST habit error:', err)
          toast({ title: errorMsg, variant: 'error' })
        }
      } catch (e) {
        console.error(e)
        toast({ title: errorMsg, variant: 'error' })
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
      toast({ title: `🔥 ${language === 'fr' ? 'Série' : language === 'zh' ? '連續天數' : 'Streak'}: ${streak}`, variant: 'success' })
    }
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/habits/${id}`, { method: 'DELETE' })
    setHabits(habits.filter((h) => h.id !== id))
  }

  if (loading) return <InkLoader size="page" />

  const totalStreak = habits.reduce((acc, h) => acc + h.streak, 0)
  const topStreak = Math.max(0, ...habits.map((h) => h.longestStreak))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <Candle className="h-7 w-7" />
          <h1 className="text-2xl font-serif text-[#2a2420]">{t('habits', language)}</h1>
          <Badge variant="default" className="bg-[#ab3326] text-[#f3ecdd]">{habits.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          {t('addHabit', language)}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: language === 'fr' ? 'Total habitudes' : language === 'zh' ? '習慣總數' : 'Total habits', value: habits.length, icon: Repeat2, color: 'text-[#4f6f5e]', bg: 'bg-[#4f6f5e]/10' },
            { label: language === 'fr' ? 'Séries actives' : language === 'zh' ? '進行中的連續天數' : 'Active streaks', value: totalStreak, icon: Flame, color: 'text-[#ab3326]', bg: 'bg-[#ab3326]/8' },
            { label: language === 'fr' ? 'Record' : language === 'zh' ? '最佳紀錄' : 'Best streak', value: topStreak, icon: Trophy, color: 'text-[#b08948]', bg: 'bg-[#b08948]/10' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={cn('rounded-2xl paper-surface border border-[#e2d6bc] p-4 flex items-center gap-3', bg)}>
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-2xl font-bold text-[#2a2420]">{value}</p>
                <p className="text-xs text-[#8a7a5e]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e2d6bc] py-16 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_v5/empty-habits.png" alt="" className="h-32 w-auto mb-4 object-contain opacity-85" />
            <p className="text-sm font-medium text-[#8a7a5e]">{t('noHabits', language)}</p>
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
                <div key={habit.id} className={cn('rounded-2xl border bg-[#fbf7ee] p-4 transition-all hover:shadow-md', completedToday > 0 ? 'border-emerald-200' : 'border-[#ece2cb]')}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{habit.icon ?? '🎯'}</span>
                      <div>
                        <p className="font-semibold text-[#2a2420] text-sm">{habit.title}</p>
                        <p className="text-xs text-[#8a7a5e]">{habit.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingHabit(habit); setShowForm(true) }} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(habit.id)} className="p-1 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Candle className="h-5 w-6" lit={habit.streak > 0} />
                      <span className="text-sm font-bold text-[#2a2420]">{habit.streak}</span>
                      <span className="text-xs text-[#8a7a5e]">{t('days', language)}</span>
                    </div>
                    {habit.scheduledTime && (
                      <div className="flex items-center gap-1 text-xs text-[#8a7a5e]">
                        <Clock className="h-3 w-3" />
                        {habit.scheduledTime}
                      </div>
                    )}
                    {habit.durationMinutes && (
                      <div className="text-xs text-[#8a7a5e]">{habit.durationMinutes} min</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="h-1.5 rounded-full bg-[#ece2cb] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (habit.streak / Math.max(habit.longestStreak, 7)) * 100)}%`, backgroundColor: habit.color }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-[#a99873]">{language === 'fr' ? 'Série actuelle' : language === 'zh' ? '目前連續' : 'Current'}: {habit.streak}</span>
                      <span className="text-xs text-[#a99873]">{language === 'fr' ? 'Record' : language === 'zh' ? '最佳紀錄' : 'Best'}: {habit.longestStreak}</span>
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
                    {completedToday > 0 ? (language === 'fr' ? 'Accompli !' : language === 'zh' ? '已完成！' : 'Done!') : t('markDone', language)}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <HabitForm
        key={showForm ? (editingHabit?.id ?? 'new') : 'closed'}
        open={showForm}
        onClose={() => { setShowForm(false); setEditingHabit(null) }}
        onSave={handleSave}
        habit={editingHabit}
        lang={language}
        calendarAccounts={calendarAccounts}
      />
    </div>
  )
}
