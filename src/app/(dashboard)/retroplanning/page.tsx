'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, RetroTemplate, RetroStage } from '@/types'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TaskForm } from '@/components/tasks/TaskForm'
import { cn } from '@/lib/utils'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import {
  GitBranch, Plus, Trash2, Edit2, Save, X, Check, ChevronDown,
  ChevronRight, Circle, CheckCircle2, Clock, AlertTriangle, Loader2, Sparkles,
} from 'lucide-react'

// ─── Built-in templates (same as RetroplanDialog) ────────────────────────────

interface BuiltinTemplate {
  id: string; name: string; nameFr: string
  keywords: string[]
  stages: { name: string; nameFr: string; daysBeforeDeadline: number }[]
}

const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: '__study',
    name: 'Study / Exam', nameFr: 'Étude / Examen',
    keywords: ['exam', 'examen', 'test', 'study', 'étude', 'quiz', '考試', '考古', 'final', 'midterm', 'homework', 'devoir', '作業'],
    stages: [
      { name: 'Course review', nameFr: 'Révision du cours', daysBeforeDeadline: 7 },
      { name: 'Practice problems', nameFr: 'Exercices pratiques', daysBeforeDeadline: 3 },
      { name: '考古題 – Past exam papers', nameFr: '考古題 – Annales', daysBeforeDeadline: 1 },
    ],
  },
  {
    id: '__project',
    name: 'Project / Report', nameFr: 'Projet / Rapport',
    keywords: ['project', 'projet', 'report', 'rapport', 'essay', 'dissertation', 'presentation', 'présentation'],
    stages: [
      { name: 'Research', nameFr: 'Recherche', daysBeforeDeadline: 14 },
      { name: 'Outline & structure', nameFr: 'Plan & structure', daysBeforeDeadline: 10 },
      { name: 'First draft', nameFr: 'Première ébauche', daysBeforeDeadline: 5 },
      { name: 'Review & polish', nameFr: 'Révision finale', daysBeforeDeadline: 1 },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function stageDate(deadline: Date, daysBeforeDeadline: number): Date {
  return addDays(deadline, -daysBeforeDeadline)
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function isOverdue(d: Date): boolean {
  return d < new Date()
}

function matchesAnyTemplate(
  title: string,
  userTemplates: RetroTemplate[]
): boolean {
  const lower = title.toLowerCase()
  return (
    BUILTIN_TEMPLATES.some((t) => t.keywords.some((kw) => lower.includes(kw.toLowerCase()))) ||
    userTemplates.some((t) => t.keywords.some((kw) => lower.includes(kw.toLowerCase())))
  )
}

// ─── Task chain view ──────────────────────────────────────────────────────────

interface ChainNode {
  task: Task
  isParent: boolean
  daysBeforeParent?: number
}

function ChainCard({
  node, isSelected, onClick, onEdit,
  lang,
}: {
  node: ChainNode
  isSelected: boolean
  onClick: () => void
  onEdit: (t: Task) => void
  lang: 'fr' | 'en' | 'zh'
}) {
  const { task, isParent } = node
  const done = task.status === 'COMPLETED'
  const deadline = task.deadline ? new Date(task.deadline) : null
  const overdue = deadline && !done && isOverdue(deadline)

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border cursor-pointer transition-all duration-200 group',
        isParent ? 'p-4' : 'p-3',
        isSelected && 'ring-2 ring-red-400 ring-offset-1',
        done
          ? 'bg-emerald-50 border-emerald-200 opacity-75'
          : overdue
          ? 'bg-red-50/50 border-red-200 hover:shadow-md'
          : 'bg-[#fbf7ee] border-[#ece2cb] hover:border-red-200 hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'shrink-0 mt-0.5 rounded-full flex items-center justify-center',
          isParent ? 'h-7 w-7 bg-red-100' : 'h-5 w-5 bg-[#ece2cb]'
        )}>
          {done
            ? <CheckCircle2 className={cn('text-emerald-500', isParent ? 'h-4 w-4' : 'h-3 w-3')} />
            : isParent
            ? <GitBranch className="h-3.5 w-3.5 text-red-800" />
            : <Circle className={cn('text-[#a99873]', 'h-3 w-3')} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-medium text-[#2a2420] truncate',
            isParent ? 'text-sm' : 'text-xs',
            done && 'line-through text-[#a99873]'
          )}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {deadline && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                done ? 'text-emerald-600' : overdue ? 'text-red-500' : 'text-[#8a7a5e]'
              )}>
                {overdue && !done && <AlertTriangle className="h-3 w-3" />}
                <Clock className="h-3 w-3" />
                {formatDateShort(deadline)}
              </span>
            )}
            {done && (
              <span className="text-xs text-emerald-600 font-medium">
                {lang === 'fr' ? 'Terminé' : lang === 'zh' ? '已完成' : 'Done'}
              </span>
            )}
            {node.daysBeforeParent !== undefined && (
              <span className="text-xs text-red-500">
                −{node.daysBeforeParent}j
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(task) }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873] shrink-0 transition-all"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Template editor ─────────────────────────────────────────────────────────

function TemplateEditor({
  template,
  onSave,
  onClose,
  lang,
}: {
  template: RetroTemplate | null
  onSave: (data: { name: string; keywords: string[]; stages: RetroStage[] }) => Promise<void>
  onClose: () => void
  lang: 'fr' | 'en' | 'zh'
}) {
  const [name, setName] = useState(template?.name ?? '')
  const [keywords, setKeywords] = useState<string[]>(template?.keywords ?? [])
  const [newKw, setNewKw] = useState('')
  const [stages, setStages] = useState<RetroStage[]>(template?.stages ?? [{ name: '', daysBeforeDeadline: 7 }])
  const [saving, setSaving] = useState(false)

  const addKeyword = () => {
    const kw = newKw.trim()
    if (kw && !keywords.includes(kw)) setKeywords((prev) => [...prev, kw])
    setNewKw('')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), keywords, stages: stages.filter((s) => s.name.trim()) })
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-red-800" />
            {template
              ? (lang === 'fr' ? 'Modifier le modèle' : lang === 'zh' ? '編輯模板' : 'Edit template')
              : (lang === 'fr' ? 'Nouveau modèle' : lang === 'zh' ? '新增模板' : 'New template')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'fr' ? 'Nom du modèle' : lang === 'zh' ? '模板名稱' : 'Template name'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex: Préparation examen" />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Mots-clés de détection automatique' : lang === 'zh' ? '自動偵測關鍵字' : 'Auto-detection keywords'}</Label>
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
              {keywords.map((kw) => (
                <span key={kw} className="flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs text-red-900 font-medium">
                  {kw}
                  <button onClick={() => setKeywords((prev) => prev.filter((k) => k !== kw))} className="hover:text-red-500 transition-colors">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder={lang === 'fr' ? 'Ajouter un mot-clé...' : lang === 'zh' ? '新增關鍵字...' : 'Add keyword...'}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addKeyword} disabled={!newKw.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Étapes' : lang === 'zh' ? '階段' : 'Stages'}</Label>
            <div className="flex flex-col gap-2">
              {stages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-[#e2d6bc] bg-[#f3ecdd] px-3 py-2">
                  <span className="h-5 w-5 rounded-full bg-red-100 text-red-900 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <Input
                    value={stage.name}
                    onChange={(e) => setStages((prev) => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                    className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
                    placeholder={lang === 'fr' ? 'Nom de l\'étape' : lang === 'zh' ? '階段名稱' : 'Stage name'}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number" min={1} max={365}
                      value={stage.daysBeforeDeadline}
                      onChange={(e) => setStages((prev) => prev.map((s, j) => j === i ? { ...s, daysBeforeDeadline: Math.max(1, Number(e.target.value)) } : s))}
                      className="w-12 text-center text-xs border border-[#e2d6bc] rounded-lg px-1 py-0.5 bg-[#fbf7ee]"
                    />
                    <span className="text-xs text-[#8a7a5e]">j</span>
                  </div>
                  <button onClick={() => setStages((prev) => prev.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-red-50 text-[#a99873] hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStages((prev) => [...prev, { name: '', daysBeforeDeadline: 3 }])}
              className="flex items-center gap-1.5 text-sm text-red-800 hover:text-red-950 px-2 py-1.5 rounded-xl hover:bg-red-50 border border-dashed border-red-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === 'fr' ? 'Ajouter une étape' : lang === 'zh' ? '新增階段' : 'Add stage'}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RetroplanningPage() {
  const { language, tasks, setTasks, calendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const lang = language

  const [userTemplates, setUserTemplates] = useState<RetroTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<RetroTemplate | null | 'new'>()
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)

  // Task form state for editing a task from the chain
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // Build chains: parent task → sub-tasks
  const chains = React.useMemo(() => {
    const parentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!))
    const parents = tasks.filter((t) => parentIds.has(t.id))

    return parents.map((parent) => {
      const children = tasks
        .filter((t) => t.parentTaskId === parent.id)
        .sort((a, b) => {
          const da = a.deadline ? new Date(a.deadline).getTime() : Infinity
          const db = b.deadline ? new Date(b.deadline).getTime() : Infinity
          return da - db
        })
      return { parent, children }
    }).sort((a, b) => {
      const da = a.parent.deadline ? new Date(a.parent.deadline).getTime() : Infinity
      const db = b.parent.deadline ? new Date(b.parent.deadline).getTime() : Infinity
      return da - db
    })
  }, [tasks])

  // Suggested tasks: tasks with no children but matching a template keyword
  const suggestedTasks = React.useMemo(() => {
    const parentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!))
    return tasks.filter(
      (t) => !parentIds.has(t.id) && !t.parentTaskId && t.deadline && t.status !== 'COMPLETED' && matchesAnyTemplate(t.title, userTemplates)
    )
  }, [tasks, userTemplates])

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    const res = await fetch('/api/retro-templates')
    if (res.ok) setUserTemplates(await res.json())
    setLoadingTemplates(false)
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const handleSaveTemplate = async (data: { name: string; keywords: string[]; stages: RetroStage[] }) => {
    if (editingTemplate === 'new') {
      const res = await fetch('/api/retro-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data }),
      })
      if (res.ok) {
        const created: RetroTemplate = await res.json()
        setUserTemplates((prev) => [...prev, created])
        toast({ title: lang === 'fr' ? 'Modèle créé !' : lang === 'zh' ? '模板已建立！' : 'Template created!', variant: 'success' })
      }
    } else if (editingTemplate) {
      const res = await fetch('/api/retro-templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTemplate.id, ...data }),
      })
      if (res.ok) {
        const updated: RetroTemplate = await res.json()
        setUserTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t))
        toast({ title: lang === 'fr' ? 'Modèle mis à jour !' : lang === 'zh' ? '模板已更新！' : 'Template updated!', variant: 'success' })
      }
    }
    setEditingTemplate(undefined)
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm(lang === 'fr' ? 'Supprimer ce modèle ?' : lang === 'zh' ? '確定刪除此模板？' : 'Delete this template?')) return
    await fetch('/api/retro-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUserTemplates((prev) => prev.filter((t) => t.id !== id))
    toast({ title: lang === 'fr' ? 'Modèle supprimé' : lang === 'zh' ? '模板已刪除' : 'Template deleted', variant: 'success' })
  }

  const handleApplyTemplate = async (task: Task, templateId: string) => {
    if (!task.deadline) return
    const deadline = new Date(task.deadline)
    let stages: { name: string; daysBeforeDeadline: number }[] = []

    if (templateId.startsWith('__')) {
      const b = BUILTIN_TEMPLATES.find((t) => t.id === templateId)
      if (b) stages = b.stages.map((s) => ({ name: `${task.title.split('|')[0]?.trim() ?? task.title} | ${lang === 'fr' ? s.nameFr : lang === 'zh' ? s.name : s.name}`, daysBeforeDeadline: s.daysBeforeDeadline }))
    } else {
      const u = userTemplates.find((t) => t.id === templateId)
      if (u) stages = u.stages
    }

    if (!stages.length) return

    await Promise.all(stages.map((s) =>
      fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: s.name,
          parentTaskId: task.id,
          calendarAccountId: task.calendarAccountId,
          importance: task.importance,
          urgency: task.urgency,
          deadline: stageDate(deadline, s.daysBeforeDeadline).toISOString(),
        }),
      })
    ))

    const tasksRes = await fetch('/api/tasks')
    if (tasksRes.ok) setTasks(await tasksRes.json())
    toast({ title: lang === 'fr' ? `${stages.length} étapes créées !` : lang === 'zh' ? `已建立 ${stages.length} 個階段！` : `${stages.length} stages created!`, variant: 'success' })
  }

  const handleSaveTask = async (data: Partial<Task>) => {
    if (!editingTask) return
    const res = await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(tasks.map((t) => t.id === editingTask.id ? updated : t))
    }
    setEditingTask(null)
  }

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(tasks.filter((t) => t.id !== id))
    setEditingTask(null)
  }

  // Which chain is selected (highlight all tasks in it)
  const selectedChain = selectedChainId ? chains.find((c) => c.parent.id === selectedChainId) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#ece2cb] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-red-500 to-amber-700 flex items-center justify-center shadow-md shadow-red-500/20">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#2a2420]">{t('retroplanning', lang)}</h1>
            <p className="text-xs text-[#8a7a5e] mt-0.5">
              {lang === 'fr' ? 'Modèles + chaînes de tâches liées' : lang === 'zh' ? '模板＋關聯任務鏈' : 'Templates + linked task chains'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-0 min-h-0">
        {/* ── Left: Templates ── */}
        <div className="w-[280px] shrink-0 flex flex-col border-r border-[#ece2cb] bg-[#fbf7ee] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ece2cb]">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#8a7a5e]">
              {lang === 'fr' ? 'Modèles' : lang === 'zh' ? '模板' : 'Templates'}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setEditingTemplate('new')} className="h-7 text-xs text-red-800 hover:bg-red-50">
              <Plus className="h-3.5 w-3.5" />
              {lang === 'fr' ? 'Nouveau' : lang === 'zh' ? '新增' : 'New'}
            </Button>
          </div>

          <div className="flex flex-col gap-0 p-2">
            {/* Built-in templates */}
            <p className="text-[10px] uppercase tracking-wide text-[#a99873] px-2 py-1.5">
              {lang === 'fr' ? 'Intégrés' : lang === 'zh' ? '內建' : 'Built-in'}
            </p>
            {BUILTIN_TEMPLATES.map((tmpl) => (
              <div key={tmpl.id} className="rounded-xl px-3 py-2.5 hover:bg-[#f3ecdd] transition-colors">
                <p className="text-sm font-medium text-[#3a3326]">{lang === 'fr' ? tmpl.nameFr : tmpl.name}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {tmpl.keywords.slice(0, 4).map((kw) => (
                    <span key={kw} className="text-[10px] bg-[#ece2cb] text-[#8a7a5e] rounded-full px-2 py-0.5">{kw}</span>
                  ))}
                  {tmpl.keywords.length > 4 && (
                    <span className="text-[10px] text-[#a99873]">+{tmpl.keywords.length - 4}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-0.5">
                  {tmpl.stages.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-[#8a7a5e]">
                      <span className="h-3.5 w-3.5 rounded-full bg-red-50 text-red-800 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="truncate flex-1">{lang === 'fr' ? s.nameFr : s.name}</span>
                      <span className="text-[10px] text-[#a99873] shrink-0">−{s.daysBeforeDeadline}j</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* User templates */}
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-red-400" /></div>
            ) : userTemplates.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-wide text-[#a99873] px-2 py-1.5 mt-1">
                  {lang === 'fr' ? 'Personnalisés' : lang === 'zh' ? '自訂' : 'Custom'}
                </p>
                {userTemplates.map((tmpl) => (
                  <div key={tmpl.id} className="group rounded-xl px-3 py-2.5 hover:bg-[#f3ecdd] transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#3a3326] flex-1 truncate">{tmpl.name}</p>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingTemplate(tmpl)} className="p-1 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-800">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tmpl.keywords.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[10px] bg-red-50 text-red-800 rounded-full px-2 py-0.5">{kw}</span>
                      ))}
                    </div>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {tmpl.stages.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-[#8a7a5e]">
                          <span className="h-3.5 w-3.5 rounded-full bg-red-50 text-red-800 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="truncate flex-1">{s.name}</span>
                          <span className="text-[10px] text-[#a99873] shrink-0">−{s.daysBeforeDeadline}j</span>
                        </div>
                      ))}
                      {tmpl.stages.length > 3 && (
                        <p className="text-[10px] text-[#a99873] pl-5">+{tmpl.stages.length - 3} étapes</p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* ── Right: Chains ── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Suggestions */}
          {suggestedTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-red-500" />
                <h2 className="text-sm font-semibold text-[#5c5347]">
                  {lang === 'fr' ? 'Tâches suggérées pour rétroplanification' : lang === 'zh' ? '建議進行回溯排程的任務' : 'Tasks suggested for retroplanning'}
                </h2>
                <Badge variant="default" className="text-xs">{suggestedTasks.length}</Badge>
              </div>
              <div className="flex flex-col gap-2">
                {suggestedTasks.map((task) => {
                  const bestTemplate = (() => {
                    const lower = task.title.toLowerCase()
                    for (const tmpl of BUILTIN_TEMPLATES) {
                      if (tmpl.keywords.some((kw) => lower.includes(kw.toLowerCase()))) return tmpl
                    }
                    for (const tmpl of userTemplates) {
                      if (tmpl.keywords.some((kw) => lower.includes(kw.toLowerCase()))) return { ...tmpl, nameFr: tmpl.name }
                    }
                    return null
                  })()

                  return (
                    <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3 hover:bg-red-50 transition-colors">
                      <GitBranch className="h-4 w-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2a2420] truncate">{task.title}</p>
                        {task.deadline && (
                          <p className="text-xs text-[#8a7a5e] mt-0.5">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDateShort(new Date(task.deadline))}
                          </p>
                        )}
                      </div>
                      {bestTemplate && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-red-800 font-medium">
                            {lang === 'fr' ? (bestTemplate as BuiltinTemplate).nameFr ?? bestTemplate.name : lang === 'zh' ? bestTemplate.name : bestTemplate.name}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleApplyTemplate(task, bestTemplate.id)}
                            className="h-7 text-xs"
                          >
                            <Check className="h-3 w-3" />
                            {lang === 'fr' ? 'Appliquer' : lang === 'zh' ? '套用' : 'Apply'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Chains */}
          {chains.length === 0 && suggestedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e2d6bc] py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <GitBranch className="h-7 w-7 text-red-300" />
              </div>
              <p className="text-sm font-medium text-[#8a7a5e] max-w-xs">
                {lang === 'fr'
                  ? 'Aucune chaîne de tâches. Ouvrez une tâche avec deadline et cliquez sur "Rétroplanifier".'
                  : lang === 'zh'
                  ? '目前還沒有任務鏈。開啟一個有截止日期的任務，並點選「設定回溯排程」。'
                  : 'No task chains yet. Open a task with a deadline and click "Set up retroplan".'}
              </p>
            </div>
          ) : chains.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4 text-[#8a7a5e]" />
                <h2 className="text-sm font-semibold text-[#5c5347]">
                  {lang === 'fr' ? 'Chaînes de tâches' : lang === 'zh' ? '任務鏈' : 'Task chains'}
                </h2>
                <Badge variant="secondary" className="text-xs">{chains.length}</Badge>
              </div>

              <div className="flex flex-col gap-4">
                {chains.map(({ parent, children }) => {
                  const isActive = selectedChainId === parent.id
                  const allDone = parent.status === 'COMPLETED' && children.every((c) => c.status === 'COMPLETED')
                  const donePct = Math.round(
                    ([parent, ...children].filter((t) => t.status === 'COMPLETED').length / (1 + children.length)) * 100
                  )

                  return (
                    <div
                      key={parent.id}
                      className={cn(
                        'rounded-2xl border bg-[#fbf7ee] overflow-hidden transition-all',
                        isActive ? 'border-red-300 shadow-md shadow-red-100' : 'border-[#ece2cb]',
                        allDone && 'opacity-70'
                      )}
                    >
                      {/* Chain header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f3ecdd] transition-colors"
                        onClick={() => setSelectedChainId(isActive ? null : parent.id)}
                      >
                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          <ChainCard
                            node={{ task: parent, isParent: true }}
                            isSelected={false}
                            onClick={() => {}}
                            onEdit={setEditingTask}
                            lang={lang}
                          />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <div className="w-24 h-1.5 rounded-full bg-[#ece2cb] overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', allDone ? 'bg-emerald-500' : 'bg-red-500')}
                                style={{ width: `${donePct}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#a99873] font-mono">{donePct}%</span>
                          </div>
                          {isActive ? <ChevronDown className="h-4 w-4 text-[#a99873]" /> : <ChevronRight className="h-4 w-4 text-[#a99873]" />}
                        </div>
                      </div>

                      {/* Expanded: stage tasks */}
                      {isActive && (
                        <div className="px-4 pb-4 flex flex-col gap-2 border-t border-[#f3ecdd]">
                          <div className="flex items-center gap-1 text-xs text-[#a99873] my-2">
                            <div className="flex-1 h-px bg-[#ece2cb]" />
                            <span className="px-2">{children.length} {lang === 'fr' ? 'étapes' : lang === 'zh' ? '個階段' : 'stages'}</span>
                            <div className="flex-1 h-px bg-[#ece2cb]" />
                          </div>

                          {/* Timeline */}
                          <div className="relative pl-6">
                            {/* Vertical line */}
                            <div className="absolute left-2 top-2 bottom-2 w-px bg-red-100" />

                            <div className="flex flex-col gap-2">
                              {children.map((child, i) => {
                                const parentDeadline = parent.deadline ? new Date(parent.deadline) : null
                                const childDeadline = child.deadline ? new Date(child.deadline) : null
                                const daysBeforeParent = parentDeadline && childDeadline
                                  ? Math.round((parentDeadline.getTime() - childDeadline.getTime()) / 86400000)
                                  : undefined
                                return (
                                  <div key={child.id} className="relative">
                                    {/* Dot on timeline */}
                                    <div className={cn(
                                      'absolute -left-4 top-3 h-3 w-3 rounded-full border-2 border-white',
                                      child.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-300'
                                    )} />
                                    <ChainCard
                                      node={{ task: child, isParent: false, daysBeforeParent }}
                                      isSelected={false}
                                      onClick={() => setSelectedChainId(parent.id)}
                                      onEdit={setEditingTask}
                                      lang={lang}
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template editor dialog */}
      {editingTemplate !== undefined && (
        <TemplateEditor
          template={editingTemplate === 'new' ? null : editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => setEditingTemplate(undefined)}
          lang={lang}
        />
      )}

      {/* Task edit form */}
      <TaskForm
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={editingTask}
        calendarAccounts={calendarAccounts}
        lang={lang}
      />
    </div>
  )
}
