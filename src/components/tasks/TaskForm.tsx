'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Task, CalendarAccount, EISENHOWER_QUADRANTS } from '@/types'
import { t, TranslationKey } from '@/lib/i18n'
import { getQuadrant } from '@/lib/utils'
import { Sparkles, Calendar, Clock, Target, GitBranch } from 'lucide-react'
import { RetroplanDialog } from './RetroplanDialog'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Task>) => Promise<void>
  task?: Task | null
  calendarAccounts?: CalendarAccount[]
  lang?: 'fr' | 'en'
  onRetroplanCreated?: () => void
}

function ScaleHint({ value, type, lang }: { value: number; type: 'importance' | 'urgency'; lang: 'fr' | 'en' }) {
  let key: TranslationKey
  let color: string
  if (type === 'importance') {
    if (value <= 3) { key = 'importanceHintLow'; color = 'text-gray-400' }
    else if (value <= 6) { key = 'importanceHintMed'; color = 'text-amber-500' }
    else { key = 'importanceHintHigh'; color = 'text-red-500' }
  } else {
    if (value <= 3) { key = 'urgencyHintLow'; color = 'text-gray-400' }
    else if (value <= 6) { key = 'urgencyHintMed'; color = 'text-amber-500' }
    else { key = 'urgencyHintHigh'; color = 'text-red-500' }
  }
  return <p className={`text-xs mt-1 ${color}`}>{t(key, lang)}</p>
}

export function TaskForm({ open, onClose, onSave, task, calendarAccounts = [], lang = 'fr', onRetroplanCreated }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [retroplanOpen, setRetroplanOpen] = useState(false)
  const [importance, setImportance] = useState(task?.importance ?? 5)
  const [urgency, setUrgency] = useState(task?.urgency ?? 5)
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes ?? 60)
  const [deadline, setDeadline] = useState(
    task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
  )
  const [calendarAccountId, setCalendarAccountId] = useState(task?.calendarAccountId ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const quadrantId = getQuadrant(importance, urgency)
  const quadrant = EISENHOWER_QUADRANTS.find((q) => q.id === quadrantId)

  const handleSave = async () => {
    if (!title.trim()) return
    setIsSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description || undefined,
        importance,
        urgency,
        estimatedMinutes,
        deadline: deadline ? new Date(deadline) : undefined,
        calendarAccountId: calendarAccountId || undefined,
        notes: notes || undefined,
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-indigo-600" />
            {task ? t('edit', lang) : t('addTask', lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>{t('tasks', lang)}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === 'fr' ? 'Titre de la tâche...' : 'Task title...'}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('description', lang)}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'fr' ? 'Description optionnelle...' : 'Optional description...'}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label className="flex items-center justify-between">
                <span>{t('importance', lang)}</span>
                <Badge variant="default" className="text-xs">{importance}/10</Badge>
              </Label>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[importance]}
                onValueChange={([v]) => setImportance(v)}
                className="mt-1"
              />
              <ScaleHint value={importance} type="importance" lang={lang} />
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center justify-between">
                <span>{t('urgency', lang)}</span>
                <Badge variant="warning" className="text-xs">{urgency}/10</Badge>
              </Label>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[urgency]}
                onValueChange={([v]) => setUrgency(v)}
                className="mt-1"
              />
              <ScaleHint value={urgency} type="urgency" lang={lang} />
            </div>
          </div>

          {quadrant && (
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${quadrant.bgColor} ${quadrant.color}`}>
              <Sparkles className="h-4 w-4" />
              {lang === 'fr' ? quadrant.labelFr : quadrant.label}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {t('estimatedTime', lang)} (min)
              </Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t('deadline', lang)}
              </Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          {calendarAccounts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>{t('calendar', lang)}</Label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCalendarAccountId('')}
                  className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm border transition-all ${
                    !calendarAccountId
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Aucun
                </button>
                {calendarAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setCalendarAccountId(acc.id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm border transition-all ${
                      calendarAccountId === acc.id
                        ? 'border-indigo-300 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    style={calendarAccountId === acc.id ? { backgroundColor: acc.color + '20', borderColor: acc.color } : {}}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: acc.color }} />
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label>{t('notes', lang)}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'fr' ? 'Notes supplémentaires...' : 'Additional notes...'}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Retroplan button — only available when editing a task that has a deadline */}
          {task?.id && deadline && (
            <Button
              variant="outline"
              onClick={() => setRetroplanOpen(true)}
              className="sm:mr-auto border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <GitBranch className="h-4 w-4" />
              {t('retroplanSetup', lang)}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
            {isSaving ? t('loading', lang) : t('save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>

      <RetroplanDialog
        open={retroplanOpen}
        onClose={() => setRetroplanOpen(false)}
        task={task ?? null}
        lang={lang}
        calendarAccounts={calendarAccounts}
        onCreated={() => { onRetroplanCreated?.(); setRetroplanOpen(false) }}
      />
    </Dialog>
  )
}
