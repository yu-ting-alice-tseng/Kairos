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
import { Sparkles, Calendar, Clock, Target, GitBranch, Trash2, Wand2, Plus, Link2, Check, X } from 'lucide-react'
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
  const { keywordRules, tasks: allTasks, setTasks } = useAppStore()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [retroplanOpen, setRetroplanOpen] = useState(false)
  const [importance, setImportance] = useState(task?.importance ?? 10)
  const [urgency, setUrgency] = useState(task?.urgency ?? 10)
  const [estimatedMinutes, setEstimatedMinutes] = useState(task?.estimatedMinutes ?? 60)
  const [deadline, setDeadline] = useState(
    task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
  )
  const defaultCalendarId = task?.calendarAccountId ?? (calendarAccounts.length === 1 ? calendarAccounts[0].id : '')
  const [calendarAccountId, setCalendarAccountId] = useState(defaultCalendarId)
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [ruleApplied, setRuleApplied] = useState<string | null>(null)
  const ruleAppliedRef = useRef(false)

  // Chain linking state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkSaving, setLinkSaving] = useState(false)
  const [newSubTaskTitle, setNewSubTaskTitle] = useState('')
  const [newSubTaskSaving, setNewSubTaskSaving] = useState(false)

  // Tasks already in this task's chain
  const chainChildren = allTasks.filter((t) => t.parentTaskId === task?.id)

  const handleLinkTask = async (targetId: string) => {
    if (!task?.id) return
    setLinkSaving(true)
    try {
      const res = await fetch(`/api/tasks/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentTaskId: task.id }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTasks(allTasks.map((t) => t.id === targetId ? updated : t))
      }
    } finally {
      setLinkSaving(false)
      setLinkDialogOpen(false)
    }
  }

  const handleCreateSubTask = async () => {
    if (!task?.id || !newSubTaskTitle.trim()) return
    setNewSubTaskSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSubTaskTitle.trim(),
          parentTaskId: task.id,
          importance: importance,
          urgency: urgency,
          calendarAccountId: calendarAccountId || undefined,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks([...allTasks, created])
        setNewSubTaskTitle('')
      }
    } finally {
      setNewSubTaskSaving(false)
    }
  }

  useEffect(() => {
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setImportance(task?.importance ?? 10)
    setUrgency(task?.urgency ?? 10)
    setEstimatedMinutes(task?.estimatedMinutes ?? 60)
    setDeadline(task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '')
    setCalendarAccountId(task?.calendarAccountId ?? (calendarAccounts.length === 1 ? calendarAccounts[0].id : ''))
    setNotes(task?.notes ?? '')
    setRuleApplied(null)
    ruleAppliedRef.current = false
  }, [task?.id, calendarAccounts.length])

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

  const isNewTask = !task
  const handleSave = async () => {
    if (!title.trim()) return
    // Require calendar selection for new tasks when accounts are available
    if (isNewTask && calendarAccounts.length > 0 && !calendarAccountId) {
      setCalendarAccountId(calendarAccounts[0].id) // auto-select first
    }
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
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
              <Label>
                {t('calendar', lang)}
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              {!calendarAccountId && (
                <p className="text-xs text-red-500">
                  {lang === 'fr' ? 'Veuillez choisir un calendrier.' : lang === 'zh' ? '請選擇一個日曆。' : 'Please select a calendar.'}
                </p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {calendarAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setCalendarAccountId(acc.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition-all truncate ${
                      calendarAccountId === acc.id
                        ? 'border-red-300 text-red-900'
                        : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]'
                    }`}
                    style={calendarAccountId === acc.id ? { backgroundColor: acc.color + '20', borderColor: acc.color } : {}}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                    <span className="truncate">{acc.name}</span>
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

        {/* Chain section — only for existing tasks */}
        {task?.id && (
          <div className="flex flex-col gap-2 pt-1 border-t border-[#ece2cb]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873] flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              {lang === 'zh' ? '任務鏈' : lang === 'fr' ? 'Chaîne de tâches' : 'Task chain'}
            </p>
            {chainChildren.length > 0 && (
              <div className="flex flex-col gap-1">
                {chainChildren.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-1.5 bg-[#f3ecdd] border border-[#ece2cb]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#a99873] shrink-0" />
                    <span className="truncate flex-1 text-[#3a3326]">{c.title}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              {deadline && (
                <button
                  onClick={() => setRetroplanOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-red-800 border border-red-200 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  <GitBranch className="h-3 w-3" />
                  {t('retroplanSetup', lang)}
                </button>
              )}
              <button
                onClick={() => { setLinkDialogOpen(true); setLinkSearch('') }}
                className="flex items-center gap-1.5 text-xs text-[#5c5347] border border-[#e2d6bc] hover:bg-[#f3ecdd] rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <Link2 className="h-3 w-3" />
                {lang === 'zh' ? '連結任務' : lang === 'fr' ? 'Lier' : 'Link'}
              </button>
              <div className="flex-1 flex items-center gap-1">
                <Input
                  value={newSubTaskTitle}
                  onChange={(e) => setNewSubTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateSubTask() } }}
                  placeholder={lang === 'zh' ? '新增子任務...' : lang === 'fr' ? 'Nouvelle étape...' : 'New step...'}
                  className="h-7 text-xs"
                />
                <button
                  onClick={handleCreateSubTask}
                  disabled={!newSubTaskTitle.trim() || newSubTaskSaving}
                  className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg bg-[#ab3326] text-white hover:bg-[#861f17] disabled:opacity-40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

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
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleSave} disabled={!title.trim() || isSaving || (calendarAccounts.length > 0 && !calendarAccountId)}>
            {isSaving ? t('loading', lang) : t('save', lang)}
          </Button>
        </DialogFooter>

        {/* Link existing task dialog */}
        {linkDialogOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setLinkDialogOpen(false)}>
            <div className="bg-[#fbf7ee] rounded-2xl border border-[#e2d6bc] shadow-xl w-72 max-h-[60vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-3 border-b border-[#ece2cb] flex items-center justify-between">
                <p className="text-sm font-semibold text-[#2a2420]">
                  {lang === 'zh' ? '連結為子任務' : lang === 'fr' ? 'Lier une tâche' : 'Link a task'}
                </p>
                <button onClick={() => setLinkDialogOpen(false)} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="px-3 py-2 border-b border-[#ece2cb]">
                <input
                  autoFocus
                  className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  placeholder={lang === 'zh' ? '搜尋任務...' : lang === 'fr' ? 'Rechercher...' : 'Search tasks...'}
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                {allTasks
                  .filter((t) =>
                    t.id !== task?.id &&
                    t.status !== 'COMPLETED' &&
                    t.status !== 'CANCELLED' &&
                    !t.parentTaskId &&
                    (!linkSearch || t.title.toLowerCase().includes(linkSearch.toLowerCase()))
                  )
                  .slice(0, 30)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleLinkTask(t.id)}
                      disabled={linkSaving}
                      className="flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left hover:bg-[#f3ecdd] border border-transparent hover:border-[#ece2cb] transition-colors"
                    >
                      <Check className="h-3 w-3 text-[#a99873] shrink-0 opacity-0 group-hover:opacity-100" />
                      <span className="truncate text-[#3a3326]">{t.title}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
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
