'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Task, CalendarAccount, EISENHOWER_QUADRANTS, QUADRANT_LABEL_ZH } from '@/types'
import { t, TranslationKey } from '@/lib/i18n'
import { getQuadrant } from '@/lib/utils'
import { Sparkles, Calendar, Clock, Target, GitBranch, Trash2, Wand2 } from 'lucide-react'
import { RetroplanDialog } from './RetroplanDialog'
import { useAppStore } from '@/stores/useAppStore'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Task>) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  task?: Task | null
  calendarAccounts?: CalendarAccount[]
  lang?: 'fr' | 'en' | 'zh'
  onRetroplanCreated?: () => void
}

function ScaleHint({ value, type, lang }: { value: number; type: 'importance' | 'urgency'; lang: 'fr' | 'en' | 'zh' }) {
  let key: TranslationKey
  let color: string
  if (type === 'importance') {
    if (value <= 3) { key = 'importanceHintLow'; color = 'text-[#a99873]' }
    else if (value <= 6) { key = 'importanceHintMed'; color = 'text-amber-500' }
    else { key = 'importanceHintHigh'; color = 'text-red-500' }
  } else {
    if (value <= 3) { key = 'urgencyHintLow'; color = 'text-[#a99873]' }
    else if (value <= 6) { key = 'urgencyHintMed'; color = 'text-amber-500' }
    else { key = 'urgencyHintHigh'; color = 'text-red-500' }
  }
  return <p className={`text-xs mt-1 ${color}`}>{t(key, lang)}</p>
}

export function TaskForm({ open, onClose, onSave, onDelete, task, calendarAccounts = [], lang = 'fr', onRetroplanCreated }: TaskFormProps) {
  const { keywordRules } = useAppStore()
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
  const [isDeleting, setIsDeleting] = useState(false)
  const [ruleApplied, setRuleApplied] = useState<string | null>(null)
  const ruleAppliedRef = useRef(false)

  useEffect(() => {
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setImportance(task?.importance ?? 5)
    setUrgency(task?.urgency ?? 5)
    setEstimatedMinutes(task?.estimatedMinutes ?? 60)
    setDeadline(task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '')
    setCalendarAccountId(task?.calendarAccountId ?? '')
    setNotes(task?.notes ?? '')
    setRuleApplied(null)
    ruleAppliedRef.current = false
  }, [task?.id])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    // Only auto-apply rules for NEW tasks (no existing id), and only once
    if (!task?.id && !ruleAppliedRef.current && keywordRules.length > 0) {
      const lower = value.toLowerCase()
      const matched = keywordRules.find((r) => lower.includes(r.keyword.toLowerCase()))
      if (matched) {
        setImportance(matched.importance)
        setUrgency(matched.urgence)
        setRuleApplied(matched.keyword)
        ruleAppliedRef.current = true
      }
    }
  }

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
        deadline: deadline ? new Date(deadline) : null,
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
            <Target className="h-5 w-5 text-red-800" />
            {task ? t('edit', lang) : t('addTask', lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label>{t('tasks', lang)}</Label>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={lang === 'fr' ? 'Titre de la tâche...' : lang === 'zh' ? '任務標題...' : 'Task title...'}
              autoFocus
            />
            {ruleApplied && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Wand2 className="h-3 w-3" />
                {lang === 'fr' ? `Règle "${ruleApplied}" appliquée` : lang === 'zh' ? `已套用「${ruleApplied}」規則` : `Rule "${ruleApplied}" applied`}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('description', lang)}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={lang === 'fr' ? 'Description optionnelle...' : lang === 'zh' ? '選填描述...' : 'Optional description...'}
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
              {lang === 'fr' ? quadrant.labelFr : lang === 'zh' ? QUADRANT_LABEL_ZH[quadrant.id] : quadrant.label}
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
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]'
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
                        ? 'border-red-300 text-red-900'
                        : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]'
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
              placeholder={lang === 'fr' ? 'Notes supplémentaires...' : lang === 'zh' ? '補充備註...' : 'Additional notes...'}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {task?.id && onDelete && (
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={async () => {
                if (!confirm(lang === 'fr' ? 'Supprimer cette tâche ?' : lang === 'zh' ? '確定刪除此任務？' : 'Delete this task?')) return
                setIsDeleting(true)
                await onDelete(task.id)
                setIsDeleting(false)
                onClose()
              }}
              className="sm:mr-auto border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              {lang === 'fr' ? 'Supprimer' : lang === 'zh' ? '刪除' : 'Delete'}
            </Button>
          )}
          {task?.id && deadline && (
            <Button
              variant="outline"
              onClick={() => setRetroplanOpen(true)}
              className="border-red-200 text-red-800 hover:bg-red-50"
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
