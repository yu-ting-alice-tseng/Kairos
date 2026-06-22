'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Task, RetroTemplate, RetroStage, CalendarAccount } from '@/types'
import { t } from '@/lib/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, GitBranch, Save, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGlobalToast } from '@/components/providers/ToastProvider'

// ── Built-in templates ────────────────────────────────────────────────────────

interface BuiltinTemplate {
  id: string
  name: string
  nameFr: string
  keywords: string[]
  stages: { name: string; nameFr: string; daysBeforeDeadline: number }[]
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: '__study',
    name: 'Study / Exam',
    nameFr: 'Étude / Examen',
    keywords: ['exam', 'examen', 'test', 'study', 'étude', 'quiz', '考試', '考古', 'final', 'midterm', 'homework', 'devoir', '作業'],
    stages: [
      { name: 'Course review', nameFr: 'Révision du cours', daysBeforeDeadline: 7 },
      { name: 'Practice problems', nameFr: 'Exercices pratiques', daysBeforeDeadline: 3 },
      { name: '考古題 – Past exam papers', nameFr: '考古題 – Annales', daysBeforeDeadline: 1 },
    ],
  },
  {
    id: '__project',
    name: 'Project / Report',
    nameFr: 'Projet / Rapport',
    keywords: ['project', 'projet', 'report', 'rapport', 'essay', 'dissertation', 'presentation', 'présentation'],
    stages: [
      { name: 'Research', nameFr: 'Recherche', daysBeforeDeadline: 14 },
      { name: 'Outline & structure', nameFr: 'Plan & structure', daysBeforeDeadline: 10 },
      { name: 'First draft', nameFr: 'Première ébauche', daysBeforeDeadline: 5 },
      { name: 'Review & polish', nameFr: 'Révision finale', daysBeforeDeadline: 1 },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function stageDate(deadline: Date, daysBeforeDeadline: number): Date {
  return addDays(deadline, -daysBeforeDeadline)
}

function formatDate(date: Date, lang: 'fr' | 'en'): string {
  return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function autoSelectTemplate(
  taskTitle: string,
  calendarAccountId: string | null | undefined,
  userTemplates: RetroTemplate[],
): string {
  const lower = taskTitle.toLowerCase()

  // Check built-ins
  for (const tmpl of BUILTIN_TEMPLATES) {
    if (tmpl.keywords.some((kw) => lower.includes(kw.toLowerCase()))) return tmpl.id
  }

  // Check user templates by calendar or keyword
  for (const tmpl of userTemplates) {
    if (tmpl.calendarAccountId && tmpl.calendarAccountId === calendarAccountId) return tmpl.id
    if (tmpl.keywords.some((kw) => lower.includes(kw.toLowerCase()))) return tmpl.id
  }

  return '__study' // default
}

// ── Stage row ─────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: RetroStage
  deadline: Date
  index: number
  lang: 'fr' | 'en'
  onChange: (index: number, stage: RetroStage) => void
  onRemove: (index: number) => void
}

function StageRow({ stage, deadline, index, lang, onChange, onRemove }: StageRowProps) {
  const date = stageDate(deadline, stage.daysBeforeDeadline)
  const isPast = date < new Date()

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-colors',
      isPast ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'
    )}>
      <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
        {index + 1}
      </span>

      <input
        value={stage.name}
        onChange={(e) => onChange(index, { ...stage, name: e.target.value })}
        className="flex-1 bg-transparent text-sm text-gray-800 outline-none min-w-0"
        placeholder={lang === 'fr' ? 'Nom de l\'étape' : 'Stage name'}
      />

      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type="number"
          min={1}
          max={365}
          value={stage.daysBeforeDeadline}
          onChange={(e) => onChange(index, { ...stage, daysBeforeDeadline: Math.max(1, Number(e.target.value)) })}
          className="w-12 text-center text-sm border border-gray-200 rounded-lg px-1 py-0.5 bg-white"
        />
        <span className="text-xs text-gray-500">{t('retroplanDaysBefore', lang)}</span>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {isPast && (
          <span title={t('retroplanPastWarning', lang)}>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </span>
        )}
        <Badge variant="secondary" className="text-xs font-normal whitespace-nowrap">
          {formatDate(date, lang)}
        </Badge>
        <button
          onClick={() => onRemove(index)}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────

interface RetroplanDialogProps {
  open: boolean
  onClose: () => void
  task: Task | null
  lang: 'fr' | 'en'
  calendarAccounts?: CalendarAccount[]
  onCreated: () => void
}

export function RetroplanDialog({ open, onClose, task, lang, calendarAccounts = [], onCreated }: RetroplanDialogProps) {
  const { toast } = useGlobalToast()
  const [userTemplates, setUserTemplates] = useState<RetroTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__study')
  const [stages, setStages] = useState<RetroStage[]>([])
  const [saving, setSaving] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const deadline = task?.deadline ? new Date(task.deadline) : null

  // Load user templates on open
  useEffect(() => {
    if (!open) return
    fetch('/api/retro-templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RetroTemplate[]) => {
        const templates = Array.isArray(data) ? data : []
        setUserTemplates(templates)
        if (task) {
          const best = autoSelectTemplate(task.title, task.calendarAccountId, templates)
          setSelectedTemplateId(best)
          loadStagesForTemplate(best, templates, lang)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task])

  const loadStagesForTemplate = useCallback(
    (id: string, userTmpls: RetroTemplate[], l: 'fr' | 'en') => {
      if (id.startsWith('__')) {
        const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
        if (builtin) {
          setStages(builtin.stages.map((s) => ({ name: l === 'fr' ? s.nameFr : s.name, daysBeforeDeadline: s.daysBeforeDeadline })))
        }
      } else {
        const userTmpl = userTmpls.find((t) => t.id === id)
        if (userTmpl) setStages([...userTmpl.stages])
      }
    },
    [],
  )

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id)
    loadStagesForTemplate(id, userTemplates, lang)
  }

  const handleStageChange = (index: number, stage: RetroStage) => {
    setStages((prev) => prev.map((s, i) => (i === index ? stage : s)))
  }

  const handleStageRemove = (index: number) => {
    setStages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddStage = () => {
    setStages((prev) => [...prev, { name: '', daysBeforeDeadline: 3 }])
  }

  const handleApply = async () => {
    if (!task?.id || !deadline || stages.length === 0) return
    setSaving(true)
    try {
      await Promise.all(
        stages
          .filter((s) => s.name.trim())
          .map((s) =>
            fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: s.name.trim(),
                parentTaskId: task.id,
                calendarAccountId: task.calendarAccountId,
                importance: task.importance,
                urgency: task.urgency,
                deadline: stageDate(deadline, s.daysBeforeDeadline).toISOString(),
              }),
            }),
          ),
      )
      toast({ title: lang === 'fr' ? `${stages.length} étapes créées !` : `${stages.length} stages created!`, variant: 'success' })
      onCreated()
      onClose()
    } catch {
      toast({ title: lang === 'fr' ? 'Erreur lors de la création' : 'Failed to create stages', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || stages.length === 0) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/retro-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          calendarAccountId: task?.calendarAccountId || null,
          keywords: [],
          stages,
        }),
      })
      if (res.ok) {
        const created: RetroTemplate = await res.json()
        setUserTemplates((prev) => [...prev, created])
        setSelectedTemplateId(created.id)
        setShowSaveTemplate(false)
        setNewTemplateName('')
        toast({ title: lang === 'fr' ? 'Modèle sauvegardé !' : 'Template saved!', variant: 'success' })
      }
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteUserTemplate = async (id: string) => {
    await fetch('/api/retro-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUserTemplates((prev) => prev.filter((t) => t.id !== id))
    if (selectedTemplateId === id) handleSelectTemplate('__study')
  }

  if (!task || !deadline) return null

  const validStages = stages.filter((s) => s.name.trim())

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-indigo-600" />
            {t('retroplanTitle', lang)}
          </DialogTitle>
          <DialogDescription className="text-sm">
            <span className="font-medium text-gray-700">{task.title}</span>
            {' — '}
            {lang === 'fr' ? 'Échéance' : 'Deadline'}:{' '}
            <span className="font-medium text-indigo-600">{formatDate(deadline, lang)}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Template selector */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('retroplanTemplate', lang)}
          </Label>
          <div className="flex gap-2 flex-wrap">
            {BUILTIN_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border transition-all',
                  selectedTemplateId === tmpl.id
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {selectedTemplateId === tmpl.id && <Check className="h-3 w-3" />}
                {lang === 'fr' ? tmpl.nameFr : tmpl.name}
              </button>
            ))}
            {userTemplates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl.id)}
                className={cn(
                  'group flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm border transition-all',
                  selectedTemplateId === tmpl.id
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {selectedTemplateId === tmpl.id && <Check className="h-3 w-3" />}
                {tmpl.name}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteUserTemplate(tmpl.id) }}
                  className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Stages */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t('retroplanStages', lang)}
          </Label>
          <div className="flex flex-col gap-1.5">
            {stages.map((stage, i) => (
              <StageRow
                key={i}
                stage={stage}
                deadline={deadline}
                index={i}
                lang={lang}
                onChange={handleStageChange}
                onRemove={handleStageRemove}
              />
            ))}
          </div>
          <button
            onClick={handleAddStage}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 px-2 py-1.5 rounded-xl hover:bg-indigo-50 transition-colors border border-dashed border-indigo-200 mt-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('retroplanAddStage', lang)}
          </button>
        </div>

        {/* Save as template */}
        {showSaveTemplate ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
            <Input
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder={lang === 'fr' ? 'Nom du modèle…' : 'Template name…'}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAsTemplate() }}
              autoFocus
            />
            <Button size="sm" onClick={handleSaveAsTemplate} disabled={!newTemplateName.trim() || savingTemplate}>
              {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSaveTemplate(false)}>✕</Button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveTemplate(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors self-start"
          >
            <Save className="h-3 w-3" />
            {t('retroplanSaveTemplate', lang)}
          </button>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleApply} disabled={saving || validStages.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
            {t('retroplanApply', lang)}
            {validStages.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {validStages.length}
              </Badge>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
