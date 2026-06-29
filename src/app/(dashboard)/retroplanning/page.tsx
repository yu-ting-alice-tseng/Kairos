'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Task, RetroTemplate, RetroStage, CalendarAccount } from '@/types'
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
  ChevronRight, Circle, CheckCircle2, Clock, AlertTriangle, Loader2, Sparkles, History,
} from 'lucide-react'
import { InkLoader } from '@/components/ui/InkLoader'

// ─── Built-in templates (same as RetroplanDialog) ────────────────────────────

interface BuiltinTemplate {
  id: string; name: string; nameFr: string
  keywords: string[]
  stages: { name: string; nameFr: string; daysBeforeDeadline: number }[]
}

// Category helpers — stored as __cat:X in keywords array
const CAT_PREFIX = '__cat:'
const CATEGORIES = {
  fr: ['Études', 'Travail', 'Personnel', 'Projet', 'Autre'],
  en: ['Study', 'Work', 'Personal', 'Project', 'Other'],
  zh: ['學習', '工作', '生活', '專案', '其他'],
}
function getCategory(keywords: string[]): string {
  const tag = keywords.find((k) => k.startsWith(CAT_PREFIX))
  return tag ? tag.slice(CAT_PREFIX.length) : ''
}
function stripCatKeywords(keywords: string[]): string[] {
  return keywords.filter((k) => !k.startsWith(CAT_PREFIX))
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

function formatDateShort(d: Date, lang: 'fr' | 'en' | 'zh' = 'fr'): string {
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const locale = lang === 'zh' ? 'zh-TW' : lang === 'en' ? 'en-GB' : 'fr-FR'
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

function isOverdue(d: Date): boolean {
  return d < new Date()
}
function isToday(d: Date): boolean {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function matchesAnyTemplate(
  title: string,
  userTemplates: RetroTemplate[]
): boolean {
  const lower = title.toLowerCase()
  return userTemplates
    .filter((t) => !t.keywords.includes('__archived'))
    .some((t) => stripCatKeywords(t.keywords).some((kw) => lower.includes(kw.toLowerCase())))
}

// ─── Task chain view ──────────────────────────────────────────────────────────

interface ChainNode {
  task: Task
  isParent: boolean
  daysBeforeParent?: number
}

function ChainCard({
  node, isSelected, onClick, onEdit, onComplete,
  lang,
}: {
  node: ChainNode
  isSelected: boolean
  onClick: () => void
  onEdit: (t: Task) => void
  onComplete: (t: Task) => void
  lang: 'fr' | 'en' | 'zh'
}) {
  const { task, isParent } = node
  const { updateTask } = useAppStore()
  const [completing, setCompleting] = React.useState(false)
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState(task.title)
  const titleInputRef = React.useRef<HTMLInputElement>(null)
  const done = task.status === 'COMPLETED'

  React.useEffect(() => { setTitleDraft(task.title) }, [task.title])

  const commitTitle = async () => {
    const trimmed = titleDraft.trim()
    setEditingTitle(false)
    if (!trimmed || trimmed === task.title) return
    updateTask(task.id, { title: trimmed })
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: trimmed }),
    })
    if (res.ok) { const data = await res.json(); updateTask(task.id, data) }
    else updateTask(task.id, { title: task.title })
  }
  const deadline = task.deadline ? new Date(task.deadline) : null
  const overdue = deadline && !done && isOverdue(deadline)
  const todayTask = deadline && !done && isToday(deadline)

  // Intuitive relative label shown on child cards
  const relativeLabel = (() => {
    if (!deadline || done) return null
    if (isToday(deadline)) return lang === 'fr' ? "Aujourd'hui" : lang === 'zh' ? '今天' : 'Today'
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const dl = new Date(deadline); dl.setHours(0, 0, 0, 0)
    const diff = Math.round((dl.getTime() - now.getTime()) / 86400000)
    if (diff > 0) return lang === 'fr' ? `Dans ${diff}j` : lang === 'zh' ? `${diff}天後` : `In ${diff}d`
    return null // overdue already shown via red styling
  })()

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative rounded-2xl border cursor-pointer transition-all duration-200 group',
        isParent ? 'p-4' : 'p-3',
        isSelected && 'ring-2 ring-red-400 ring-offset-1',
        done
          ? 'bg-emerald-50 border-emerald-200 opacity-75'
          : todayTask
          ? 'bg-amber-50 border-amber-300 hover:shadow-md'
          : overdue
          ? 'bg-red-50/50 border-red-200 hover:shadow-md'
          : 'bg-[#fbf7ee] border-[#ece2cb] hover:border-red-200 hover:shadow-md'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (completing) return
            setCompleting(true)
            await onComplete(task)
            setCompleting(false)
          }}
          className={cn(
            'shrink-0 mt-0.5 rounded-full flex items-center justify-center transition-transform hover:scale-110',
            isParent ? 'h-7 w-7 bg-red-100' : 'h-5 w-5 bg-[#ece2cb]'
          )}
          title={done
            ? (lang === 'fr' ? 'Marquer comme non terminé' : lang === 'zh' ? '標記為未完成' : 'Mark as incomplete')
            : (lang === 'fr' ? 'Marquer comme terminé' : lang === 'zh' ? '標記為已完成' : 'Mark as complete')}
        >
          {completing
            ? <Loader2 className={cn('animate-spin text-red-400', isParent ? 'h-4 w-4' : 'h-3 w-3')} />
            : done
            ? <CheckCircle2 className={cn('text-emerald-500', isParent ? 'h-4 w-4' : 'h-3 w-3')} />
            : isParent
            ? <GitBranch className="h-3.5 w-3.5 text-red-800" />
            : <Circle className={cn('text-[#a99873]', 'h-3 w-3')} />
          }
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); titleInputRef.current?.blur() }
                if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full font-medium text-[#2a2420] bg-white border border-red-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-red-400',
                isParent ? 'text-sm' : 'text-xs'
              )}
              autoFocus
            />
          ) : (
            <p
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); setTitleDraft(task.title) }}
              className={cn(
                'font-medium text-[#2a2420] truncate cursor-text',
                isParent ? 'text-sm' : 'text-xs',
                done && 'line-through text-[#a99873]'
              )}
              title={lang === 'fr' ? 'Double-cliquer pour renommer' : lang === 'zh' ? '雙擊可重新命名' : 'Double-click to rename'}
            >
              {task.title}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {deadline && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                done ? 'text-emerald-600' : overdue ? 'text-red-500' : todayTask ? 'text-amber-700' : 'text-[#8a7a5e]'
              )}>
                {overdue && !done && <AlertTriangle className="h-3 w-3" />}
                <Clock className="h-3 w-3" />
                {formatDateShort(deadline, lang)}
              </span>
            )}
            {done && (
              <span className="text-xs text-emerald-600 font-medium">
                {lang === 'fr' ? 'Terminé' : lang === 'zh' ? '已完成' : 'Done'}
              </span>
            )}
            {relativeLabel && (
              <span className={cn(
                'text-xs font-medium px-1.5 py-0.5 rounded-full',
                todayTask ? 'bg-amber-100 text-amber-700' : 'bg-[#f3ecdd] text-[#8a7a5e]'
              )}>
                {relativeLabel}
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
  initial,
  onSave,
  onDelete,
  onClose,
  lang,
  allTemplates = [],
}: {
  template: RetroTemplate | null
  /** Pre-fill when forking a built-in template into an editable custom one. */
  initial?: { name: string; keywords: string[]; stages: RetroStage[] }
  onSave: (data: { name: string; keywords: string[]; stages: RetroStage[] }) => Promise<void>
  onDelete?: () => void
  onClose: () => void
  lang: 'fr' | 'en' | 'zh'
  allTemplates?: RetroTemplate[]
}) {
  const rawKeywords = template?.keywords ?? initial?.keywords ?? []
  const [name, setName] = useState(template?.name ?? initial?.name ?? '')
  const [category, setCategory] = useState(getCategory(rawKeywords))
  const [customCatInput, setCustomCatInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>(stripCatKeywords(rawKeywords))
  const [newKw, setNewKw] = useState('')
  const [kwConflict, setKwConflict] = useState<string | null>(null)
  const [stages, setStages] = useState<RetroStage[]>(template?.stages ?? initial?.stages ?? [{ name: '', daysBeforeDeadline: 7 }])
  const [saving, setSaving] = useState(false)

  const addKeyword = () => {
    const kw = newKw.trim()
    if (!kw) return
    if (keywords.includes(kw)) { setNewKw(''); return }
    // Check for conflicts with other templates
    const conflict = allTemplates.find((t) =>
      t.id !== template?.id &&
      !t.keywords.includes('__archived') &&
      stripCatKeywords(t.keywords).some((k) => k.toLowerCase() === kw.toLowerCase())
    )
    if (conflict) {
      setKwConflict(conflict.name)
      return
    }
    setKwConflict(null)
    setKeywords((prev) => [...prev, kw])
    setNewKw('')
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const kwWithCat = category ? [`${CAT_PREFIX}${category}`, ...keywords] : keywords
    await onSave({ name: name.trim(), keywords: kwWithCat, stages: stages.filter((s) => s.name.trim()) })
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
              : initial
              ? (lang === 'fr' ? 'Personnaliser le modèle' : lang === 'zh' ? '自訂此模板' : 'Customize template')
              : (lang === 'fr' ? 'Nouveau modèle' : lang === 'zh' ? '新增模板' : 'New template')}
          </DialogTitle>
          {initial && (
            <p className="text-xs text-[#8a7a5e] mt-1">
              {lang === 'fr'
                ? 'Les modèles intégrés ne sont pas modifiables directement — vos changements seront enregistrés comme un nouveau modèle personnalisé.'
                : lang === 'zh'
                ? '內建模板無法直接編輯 — 您的變更將會儲存為新的自訂模板。'
                : "Built-in templates can't be edited directly — your changes will be saved as a new custom template."}
            </p>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'fr' ? 'Nom du modèle' : lang === 'zh' ? '模板名稱' : 'Template name'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex: Préparation examen" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'fr' ? 'Catégorie' : lang === 'zh' ? '分類' : 'Category'}</Label>
            <div className="flex gap-2 flex-wrap">
              {[...CATEGORIES[lang], ...(category && !CATEGORIES[lang].includes(category) ? [category] : [])].map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(cat === category ? '' : cat)}
                  className={cn('rounded-xl px-3 py-1 text-xs border transition-all', category === cat ? 'bg-red-50 border-red-300 text-red-900' : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]')}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <Input
                value={customCatInput}
                onChange={(e) => setCustomCatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && customCatInput.trim()) { e.preventDefault(); setCategory(customCatInput.trim()); setCustomCatInput('') } }}
                placeholder={lang === 'fr' ? 'Catégorie personnalisée...' : lang === 'zh' ? '自訂分類...' : 'Custom category...'}
                className="h-7 text-xs"
              />
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { if (customCatInput.trim()) { setCategory(customCatInput.trim()); setCustomCatInput('') } }} disabled={!customCatInput.trim()}>
                {lang === 'fr' ? 'Appliquer' : lang === 'zh' ? '套用' : 'Apply'}
              </Button>
            </div>
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
                onChange={(e) => { setNewKw(e.target.value); setKwConflict(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder={lang === 'fr' ? 'Ajouter un mot-clé...' : lang === 'zh' ? '新增關鍵字...' : 'Add keyword...'}
                className={`h-8 text-sm ${kwConflict ? 'border-red-400 ring-1 ring-red-300' : ''}`}
              />
              <Button size="sm" variant="outline" onClick={addKeyword} disabled={!newKw.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {kwConflict && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {lang === 'fr'
                  ? `⚠ Ce mot-clé est déjà utilisé dans « ${kwConflict} ». Choisissez un mot-clé différent.`
                  : lang === 'zh'
                  ? `⚠ 此關鍵字已在「${kwConflict}」中使用，請換一個不同的關鍵字。`
                  : `⚠ This keyword is already used in "${kwConflict}". Please choose a different keyword.`}
              </p>
            )}
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
                    <span className="text-xs text-[#8a7a5e]">{lang === 'zh' ? '天' : lang === 'en' ? 'd' : 'j'}</span>
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

        <DialogFooter className="flex items-center justify-between gap-2">
          <div>
            {onDelete && (
              <Button variant="outline" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
                {lang === 'fr' ? 'Supprimer' : lang === 'zh' ? '刪除' : 'Delete'}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save', lang)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RetroplanningPage() {
  const { language, tasks, setTasks, updateTask, removeTask, calendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const lang = language

  const [userTemplates, setUserTemplates] = useState<RetroTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<RetroTemplate | null | 'new'>()
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null)
  const [forkDraft, setForkDraft] = useState<{ name: string; keywords: string[]; stages: RetroStage[] } | null>(null)
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [deleteChainDialog, setDeleteChainDialog] = useState<{ parentId: string; parentTitle: string; childIds: string[] } | null>(null)
  const [deleteChainLoading, setDeleteChainLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [linkDialog, setLinkDialog] = useState<{ parentId: string; parentTitle: string } | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [linkSelectedIds, setLinkSelectedIds] = useState<Set<string>>(new Set())
  const [linkSaving, setLinkSaving] = useState(false)
  const [freshTasks, setFreshTasks] = useState<Task[]>([])
  const [prefixConfirmDialog, setPrefixConfirmDialog] = useState<{ prefix: string; tasks: Task[] } | null>(null)
  const [prefixLinkSaving, setPrefixLinkSaving] = useState(false)
  const [dismissedPrefixes, setDismissedPrefixes] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('retro-dismissed-prefixes') ?? '[]')) }
    catch { return new Set() }
  })

  // Prefer the first Google calendar account for event creation
  const googleCalendarAccount = calendarAccounts.find((a) => (a as { provider?: string }).provider === 'GOOGLE') ?? calendarAccounts[0] ?? null

  const createCalendarEvent = async (title: string, date: Date): Promise<string | null> => {
    if (!googleCalendarAccount) return null
    try {
      const end = new Date(date.getTime() + 60 * 60 * 1000) // +1h
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarAccountId: googleCalendarAccount.id,
          calendarId: 'primary',
          title,
          start: date.toISOString(),
          end: end.toISOString(),
          allDay: false,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        return data.eventId ?? null
      }
      toast({ title: lang === 'fr' ? 'Erreur lors de la création de l\'événement calendrier' : lang === 'zh' ? '建立日曆事件失敗' : 'Failed to create calendar event', variant: 'error' })
    } catch {
      toast({ title: lang === 'fr' ? 'Erreur lors de la création de l\'événement calendrier' : lang === 'zh' ? '建立日曆事件失敗' : 'Failed to create calendar event', variant: 'error' })
    }
    return null
  }

  const handleDeleteChain = async (mode: 'delete' | 'unlink') => {
    if (!deleteChainDialog) return
    setDeleteChainLoading(true)
    const { parentId, childIds } = deleteChainDialog
    try {
      if (mode === 'delete') {
        await Promise.all([...childIds, parentId].map((id) => fetch(`/api/tasks/${id}`, { method: 'DELETE' })))
        const delRes = await fetch('/api/tasks')
        if (delRes.ok) setTasks(await delRes.json())
      } else {
        // Unlink: remove parentTaskId from children, keep all tasks
        await Promise.all(childIds.map((id) =>
          fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentTaskId: null }),
          })
        ))
        const tasksRes = await fetch('/api/tasks')
        if (tasksRes.ok) setTasks(await tasksRes.json())
      }
    } finally {
      setDeleteChainLoading(false)
      setDeleteChainDialog(null)
      setSelectedChainId(null)
    }
  }

  // 1-minute calendar scan: upcoming events matching template keywords
  interface ScanMatch {
    title: string
    start: string       // ISO — used to compute stage dates
    date: string        // display string
    templateId: string
    templateName: string
    stages: { name: string; daysBeforeDeadline: number }[]
  }
  const [scanMatches, setScanMatches] = useState<ScanMatch[]>([])
  const [scanCreating, setScanCreating] = useState<string | null>(null)
  const [previewScan, setPreviewScan] = useState<ScanMatch | null>(null)
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('retro-dismissed-suggestions') ?? '[]')) }
    catch { return new Set() }
  })
  const [dismissedScanKeys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('kairos:dismissed-scans') ?? '[]')) } catch { return new Set() }
  })

  const scanKey = (m: ScanMatch) => m.title.toLowerCase().trim()
  const dismissScan = (key: string) => {
    dismissedScanKeys.add(key)
    try { localStorage.setItem('kairos:dismissed-scans', JSON.stringify([...dismissedScanKeys])) } catch { /* ignore */ }
    setScanMatches((prev) => prev.filter((x) => scanKey(x) !== key))
  }

  const runScan = useCallback(async () => {
    if (calendarAccounts.length === 0) return
    try {
      const start = new Date().toISOString()
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`)
      if (!res.ok) return
      const events: { title: string; start: string }[] = await res.json()

      // Build template list from user templates only (no built-ins)
      type AnyTmpl = { id: string; name: string; keywords: string[]; stages: { name: string; daysBeforeDeadline: number }[] }
      const allTemplates: AnyTmpl[] = userTemplates
        .filter((t) => !t.keywords.includes('__archived'))
        .map((t) => ({
          id: t.id,
          name: t.name,
          keywords: stripCatKeywords(t.keywords),
          stages: t.stages,
        }))

      // Build set of words from tasks already in chains (parent or child)
      const chainParentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!))
      const chainedTasks = tasks.filter((t) => !!t.parentTaskId || chainParentIds.has(t.id))
      const chainedWords = chainedTasks.flatMap((t) =>
        t.title.toLowerCase().split(/[\s|:,\-]+/).filter((w) => w.length > 2)
      )
      const chainedWordSet = new Set(chainedWords)

      const matches: ScanMatch[] = []
      for (const ev of events) {
        const lower = ev.title.toLowerCase()
        // Skip if event title keywords overlap with any chained task (chain already exists)
        const evWords = lower.split(/[\s|:,\-]+/).filter((w) => w.length > 2)
        if (evWords.some((w) => chainedWordSet.has(w))) continue

        for (const tmpl of allTemplates) {
          const matchedKw = tmpl.keywords.find((kw) => lower.includes(kw.toLowerCase()))
          if (matchedKw) {
            const prefix = ev.title.split(/[|\-:]/)[0]?.trim() ?? ev.title
            matches.push({
              title: ev.title,
              start: ev.start,
              date: new Date(ev.start).toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-US', { day: 'numeric', month: 'short' }),
              templateId: tmpl.id,
              templateName: tmpl.name,
              stages: tmpl.stages.map((s) => ({ name: `${prefix} | ${s.name}`, daysBeforeDeadline: s.daysBeforeDeadline })),
            })
            break
          }
        }
      }
      setScanMatches(matches.filter((m) => !dismissedScanKeys.has(scanKey(m))))
    } catch { /* best-effort */ }
  }, [calendarAccounts.length, userTemplates, lang, dismissedScanKeys, tasks])

  const handleCreateFromScan = async (m: ScanMatch) => {
    setScanCreating(m.title)
    try {
      const deadline = new Date(m.start)
      const parentRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: m.title, importance: 8, urgency: 7, deadline: deadline.toISOString() }),
      })
      if (!parentRes.ok) throw new Error()
      const parent = await parentRes.json()
      const today = new Date(); today.setHours(0, 0, 0, 0)
      await Promise.all(m.stages.map(async (s) => {
        const d = new Date(deadline)
        d.setDate(d.getDate() - s.daysBeforeDeadline)
        const finalDate = d < today ? today : d
        // Create Google Calendar event for this stage
        const calEventId = await createCalendarEvent(s.name, finalDate)
        return fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: s.name,
            parentTaskId: parent.id,
            importance: 8,
            urgency: 7,
            deadline: finalDate.toISOString(),
            calendarEventId: calEventId ?? undefined,
            calendarAccountId: googleCalendarAccount?.id ?? undefined,
          }),
        })
      }))
      const tasksRes = await fetch('/api/tasks')
      if (tasksRes.ok) setTasks(await tasksRes.json())
      toast({ title: lang === 'fr' ? 'Rétroplanning créé !' : lang === 'zh' ? '逆向規劃已建立！' : 'Retroplan created!', variant: 'success' })
      // Remove from scan list and persist dismissal
      dismissScan(scanKey(m))
    } catch {
      toast({ title: lang === 'fr' ? 'Erreur' : lang === 'zh' ? '建立失敗' : 'Failed', variant: 'error' })
    } finally {
      setScanCreating(null)
    }
  }

  // Refresh tasks from API on mount so renamed/added/deleted tasks are always up to date
  useEffect(() => {
    fetch('/api/tasks').then((r) => r.ok ? r.json() : null).then((data) => { if (data) setTasks(data) }).catch(() => {})
    // Background calendar sync: update task titles/dates from Google Calendar
    fetch('/api/tasks/sync-calendar', { method: 'POST' })
      .then((r) => r.ok ? r.json() : null)
      .then((result) => {
        if (result?.synced > 0 || result?.dupes > 0) {
          fetch('/api/tasks').then((r) => r.ok ? r.json() : null).then((data) => { if (data) setTasks(data) })
        }
      }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    runScan()
    const id = setInterval(runScan, 60_000)
    return () => clearInterval(id)
  }, [runScan])

  // Build chains: parent task → sub-tasks (includes all manually linked chains)
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

  const now = new Date()
  // History = fully completed chains; Active = everything else (including overdue-but-incomplete)
  const { activeChains, pastChains } = React.useMemo(() => {
    const active: typeof chains = []
    const past: typeof chains = []
    for (const c of chains) {
      const allCompleted = c.parent.status === 'COMPLETED' && c.children.every((ch) => ch.status === 'COMPLETED')
      if (allCompleted) past.push(c)
      else active.push(c)
    }
    // History: most recently completed (latest deadline) first
    past.sort((a, b) => {
      const da = a.parent.deadline ? new Date(a.parent.deadline).getTime() : 0
      const db = b.parent.deadline ? new Date(b.parent.deadline).getTime() : 0
      return db - da
    })
    return { activeChains: active, pastChains: past }
  }, [chains])

  // Suggested tasks: tasks with no children but matching a template keyword
  const suggestedTasks = React.useMemo(() => {
    const now = new Date()
    const parentIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!))
    return tasks.filter(
      (t) => !parentIds.has(t.id) && !t.parentTaskId && t.deadline && t.status !== 'COMPLETED'
        && new Date(String(t.deadline)) >= now
        && !dismissedSuggestions.has(t.id)
        && matchesAnyTemplate(t.title, userTemplates)
    )
  }, [tasks, userTemplates, dismissedSuggestions])

  // Auto-detect tasks sharing the same prefix (first segment before ｜ or |, min 2 chars)
  // Only considers standalone tasks (not already in any chain) with a future deadline
  const autoLinkSuggestions = React.useMemo(() => {
    const chainedIds = new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId!))
    const standalone = tasks.filter(
      (t) => !t.parentTaskId && !chainedIds.has(t.id) && t.status !== 'COMPLETED'
    )
    const getPrefix = (title: string) => {
      const sep = title.includes('｜') ? '｜' : title.includes('|') ? '|' : null
      if (!sep) return null
      const prefix = title.split(sep)[0].trim()
      return prefix.length >= 2 ? prefix : null
    }
    const byPrefix = new Map<string, Task[]>()
    for (const t of standalone) {
      const prefix = getPrefix(t.title)
      if (!prefix) continue
      const arr = byPrefix.get(prefix) ?? []
      arr.push(t)
      byPrefix.set(prefix, arr)
    }
    return [...byPrefix.entries()]
      .filter(([prefix, group]) => group.length >= 2 && !dismissedPrefixes.has(prefix))
      .map(([prefix, group]) => ({ prefix, tasks: group }))
  }, [tasks, dismissedPrefixes])

  const handleConfirmAutoLink = async () => {
    if (!prefixConfirmDialog) return
    setPrefixLinkSaving(true)
    try {
      const sorted = [...prefixConfirmDialog.tasks].sort((a, b) => {
        const da = a.deadline ? new Date(String(a.deadline)).getTime() : Infinity
        const db = b.deadline ? new Date(String(b.deadline)).getTime() : Infinity
        return db - da // latest deadline = head (chainParent)
      })
      const [head, ...rest] = sorted
      // Patch siblings to point to head
      await Promise.all(rest.map((t) =>
        fetch(`/api/tasks/${t.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentTaskId: head.id }),
        })
      ))
      const res = await fetch('/api/tasks')
      if (res.ok) { const latest = await res.json(); setTasks(latest); setFreshTasks(latest) }
      setPrefixConfirmDialog(null)
    } catch {
      toast({ title: lang === 'zh' ? '連結失敗' : lang === 'fr' ? 'Erreur de liaison' : 'Link failed', variant: 'error' })
    } finally {
      setPrefixLinkSaving(false)
    }
  }

  const dismissPrefix = (prefix: string) => {
    setDismissedPrefixes((prev) => {
      const next = new Set(prev)
      next.add(prefix)
      try { localStorage.setItem('retro-dismissed-prefixes', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const dismissSuggestion = useCallback((taskId: string) => {
    setDismissedSuggestions((prev) => {
      const next = new Set(prev)
      next.add(taskId)
      try { localStorage.setItem('retro-dismissed-suggestions', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

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
    setForkDraft(null)
  }

  // Soft delete: add __archived tag, move to bottom
  const handleDeleteTemplate = async (id: string) => {
    const tmpl = userTemplates.find((t) => t.id === id)
    if (!tmpl) return
    const newKeywords = [...tmpl.keywords.filter((k) => k !== '__archived'), '__archived']
    const res = await fetch('/api/retro-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, keywords: newKeywords }),
    })
    if (res.ok) {
      const updated: RetroTemplate = await res.json()
      setUserTemplates((prev) => prev.map((t) => t.id === id ? updated : t))
      toast({ title: lang === 'fr' ? 'Modèle archivé' : lang === 'zh' ? '模板已封存（移至底部）' : 'Template archived', variant: 'success' })
    }
  }

  const handleRestoreTemplate = async (id: string) => {
    const tmpl = userTemplates.find((t) => t.id === id)
    if (!tmpl) return
    const newKeywords = tmpl.keywords.filter((k) => k !== '__archived')
    const res = await fetch('/api/retro-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, keywords: newKeywords }),
    })
    if (res.ok) {
      const updated: RetroTemplate = await res.json()
      setUserTemplates((prev) => prev.map((t) => t.id === id ? updated : t))
    }
  }

  const handlePermanentDeleteTemplate = async (id: string) => {
    await fetch('/api/retro-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUserTemplates((prev) => prev.filter((t) => t.id !== id))
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

    const today = new Date(); today.setHours(0, 0, 0, 0)
    await Promise.all(stages.map(async (s) => {
      const d = new Date(deadline)
      d.setDate(d.getDate() - s.daysBeforeDeadline)
      const finalDate = d < today ? today : d
      const calEventId = await createCalendarEvent(s.name, finalDate)
      return fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: s.name,
          parentTaskId: task.id,
          calendarAccountId: task.calendarAccountId ?? googleCalendarAccount?.id,
          importance: task.importance,
          urgency: task.urgency,
          deadline: finalDate.toISOString(),
          calendarEventId: calEventId ?? undefined,
        }),
      })
    }))

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
      updateTask(editingTask.id, updated)
    }
    setEditingTask(null)
  }

  const handleDeleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    const fresh = await fetch('/api/tasks')
    if (fresh.ok) setTasks(await fresh.json())
    setEditingTask(null)
  }

  const openLinkDialog = async (parentId: string, parentTitle: string) => {
    setLinkSearch('')
    setLinkSelectedIds(new Set())
    setLinkDialog({ parentId, parentTitle })
    // Always fetch fresh tasks so renamed tasks show with current names
    const res = await fetch('/api/tasks')
    if (res.ok) {
      const latest: Task[] = await res.json()
      setFreshTasks(latest)
      setTasks(latest) // also update global store
    }
  }

  const handleLinkToChain = async () => {
    if (!linkDialog || linkSelectedIds.size === 0) return
    setLinkSaving(true)
    try {
      await Promise.all([...linkSelectedIds].map((id) =>
        fetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentTaskId: linkDialog.parentId }),
        })
      ))
      const res = await fetch('/api/tasks')
      if (res.ok) { const latest = await res.json(); setTasks(latest); setFreshTasks(latest) }
      setLinkDialog(null)
    } catch { /* ignore */ } finally { setLinkSaving(false) }
  }

  const handleCompleteTask = async (task: Task) => {
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED'
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated = await res.json()
      updateTask(task.id, updated)
    }
  }

  // Which chain is selected (highlight all tasks in it)
  const selectedChain = selectedChainId ? chains.find((c) => c.parent.id === selectedChainId) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-red-500 to-amber-700 flex items-center justify-center shadow-md shadow-red-500/20">
            <GitBranch className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-[#2a2420]">{t('retroplanning', lang)}</h1>
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
            {/* Active user templates grouped by category */}
            {(() => {
              const active = userTemplates.filter((t) => !t.keywords.includes('__archived'))
              const archived = userTemplates.filter((t) => t.keywords.includes('__archived'))

              const grouped: Record<string, RetroTemplate[]> = {}
              for (const tmpl of active) {
                const cat = getCategory(tmpl.keywords) || (lang === 'zh' ? '其他' : lang === 'fr' ? 'Autre' : 'Other')
                if (!grouped[cat]) grouped[cat] = []
                grouped[cat].push(tmpl)
              }

              const TemplateRow = ({ tmpl, isArchived }: { tmpl: RetroTemplate; isArchived: boolean }) => {
                const visibleKws = stripCatKeywords(tmpl.keywords).filter((k) => k !== '__archived').slice(0, 4)
                const totalKws = stripCatKeywords(tmpl.keywords).filter((k) => k !== '__archived').length
                return (
                  <div className={`group rounded-xl px-3 py-2.5 hover:bg-[#f3ecdd] transition-colors ${isArchived ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium flex-1 truncate ${isArchived ? 'text-[#a99873] line-through' : 'text-[#3a3326]'}`}>{tmpl.name}</p>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isArchived ? (
                          <>
                            <button
                              onClick={() => handleRestoreTemplate(tmpl.id)}
                              title={lang === 'zh' ? '還原' : lang === 'fr' ? 'Restaurer' : 'Restore'}
                              className="p-1 rounded-lg hover:bg-green-50 text-[#a99873] hover:text-green-700 text-[10px]"
                            >↩</button>
                            {confirmDeleteTemplateId === tmpl.id ? (
                              <span className="flex items-center gap-1 text-[10px]">
                                <button onClick={() => setConfirmDeleteTemplateId(null)} className="text-[#8a7a5e] hover:text-[#3a3326]">{lang === 'fr' ? 'Annuler' : lang === 'zh' ? '取消' : 'Cancel'}</button>
                                <button onClick={() => { setConfirmDeleteTemplateId(null); handlePermanentDeleteTemplate(tmpl.id) }} className="font-medium text-red-600 hover:text-red-800">{lang === 'fr' ? 'Suppr.' : lang === 'zh' ? '確認刪除' : 'Delete'}</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteTemplateId(tmpl.id)}
                                title={lang === 'zh' ? '永久刪除' : lang === 'fr' ? 'Supprimer définitivement' : 'Delete permanently'}
                                className="p-1 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-500"
                              ><Trash2 className="h-3 w-3" /></button>
                            )}
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingTemplate(tmpl)} className="p-1 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-800"><Edit2 className="h-3 w-3" /></button>
                            <button onClick={() => handleDeleteTemplate(tmpl.id)} className="p-1 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {visibleKws.map((kw) => (
                        <span key={kw} className="text-[10px] bg-[#ece2cb] text-[#8a7a5e] rounded-full px-2 py-0.5">{kw}</span>
                      ))}
                      {totalKws > 4 && <span className="text-[10px] text-[#a99873]">+{totalKws - 4}</span>}
                    </div>
                    <div className="mt-2 flex flex-col gap-0.5">
                      {tmpl.stages.slice(0, 3).map((s, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-[#8a7a5e]">
                          <span className="h-3.5 w-3.5 rounded-full bg-red-50 text-red-800 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span className="truncate flex-1">{s.name}</span>
                          <span className="text-[10px] text-[#a99873] shrink-0">−{s.daysBeforeDeadline}j</span>
                        </div>
                      ))}
                      {tmpl.stages.length > 3 && <p className="text-[10px] text-[#a99873] pl-5">+{tmpl.stages.length - 3}</p>}
                    </div>
                  </div>
                )
              }

              return (
                <>
                  {Object.entries(grouped).map(([cat, tmpls]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a99873] px-3 pt-3 pb-1">{cat}</p>
                      {tmpls.map((tmpl) => <TemplateRow key={tmpl.id} tmpl={tmpl} isArchived={false} />)}
                    </div>
                  ))}
                  {active.length === 0 && !loadingTemplates && (
                    <p className="text-xs text-[#a99873] text-center py-6 px-3">
                      {lang === 'zh' ? '還沒有模板，點「新增」來建立第一個' : lang === 'fr' ? 'Aucun modèle. Cliquez « Nouveau ».' : 'No templates yet. Click "New".'}
                    </p>
                  )}
                  {archived.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#c4b48a] px-3 pt-4 pb-1">
                        {lang === 'zh' ? '已封存' : lang === 'fr' ? 'Archivés' : 'Archived'}
                      </p>
                      {archived.map((tmpl) => <TemplateRow key={tmpl.id} tmpl={tmpl} isArchived={true} />)}
                    </div>
                  )}
                </>
              )
            })()}
            {loadingTemplates && <InkLoader size="sm" />}
          </div>
        </div>

        {/* ── Right: Chains ── */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* Calendar scan — actionable list, always visible while matches exist */}
          {scanMatches.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-800">
                  {lang === 'fr'
                    ? `${scanMatches.length} événement(s) détecté(s) ce mois-ci`
                    : lang === 'zh'
                    ? `未來一個月偵測到 ${scanMatches.length} 個符合的行程`
                    : `${scanMatches.length} upcoming event(s) detected`}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {scanMatches.map((m) => (
                  <div
                    key={m.title}
                    onClick={() => setPreviewScan(m)}
                    className="flex items-center gap-2 bg-white/60 rounded-xl border border-amber-200 px-3 py-2 cursor-pointer hover:bg-amber-50 transition-colors"
                  >
                    <GitBranch className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-medium text-amber-900 truncate flex-1">{m.title}</span>
                    <span className="text-[11px] text-amber-500 shrink-0">{m.date}</span>
                    <span className="text-[11px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 shrink-0">{m.templateName}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissScan(scanKey(m)) }}
                      className="p-1 rounded-lg text-amber-400 hover:text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
                      title={lang === 'zh' ? '移除' : lang === 'fr' ? 'Ignorer' : 'Dismiss'}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCreateFromScan(m) }}
                      disabled={scanCreating === m.title}
                      className="flex items-center gap-1 text-[11px] bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-2.5 py-1 disabled:opacity-60 transition-colors shrink-0"
                    >
                      {scanCreating === m.title
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Check className="h-3 w-3" />}
                      {lang === 'fr' ? 'Créer' : lang === 'zh' ? '建立' : 'Create'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-link prefix suggestions */}
          {autoLinkSuggestions.length > 0 && (
            <div className="flex flex-col gap-2 mb-4">
              {autoLinkSuggestions.map(({ prefix, tasks: group }) => (
                <div key={prefix} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                  <GitBranch className="h-4 w-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2a2420]">
                      {lang === 'zh'
                        ? `偵測到 ${group.length} 個「${prefix}」前綴任務`
                        : lang === 'fr'
                        ? `${group.length} tâches avec le préfixe « ${prefix} » détectées`
                        : `${group.length} tasks share prefix "${prefix}"`}
                    </p>
                    <p className="text-xs text-[#8a7a5e] mt-0.5 truncate">
                      {group.map((t) => t.title).join('  ·  ')}
                    </p>
                  </div>
                  <button
                    onClick={() => setPrefixConfirmDialog({ prefix, tasks: group })}
                    className="shrink-0 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    {lang === 'zh' ? '串成任務鏈' : lang === 'fr' ? 'Lier en chaîne' : 'Link as chain'}
                  </button>
                  <button
                    onClick={() => dismissPrefix(prefix)}
                    className="shrink-0 p-1 rounded-full text-[#c4b48a] hover:text-[#5c5347] hover:bg-[#ece2cb] transition-colors"
                    title={lang === 'zh' ? '忽略' : lang === 'fr' ? 'Ignorer' : 'Dismiss'}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {(suggestedTasks.length > 0 || dismissedSuggestions.size > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-red-500" />
                <h2 className="text-sm font-semibold text-[#5c5347]">
                  {lang === 'fr' ? 'Tâches suggérées pour rétroplanification' : lang === 'zh' ? '建議進行回溯排程的任務' : 'Tasks suggested for retroplanning'}
                </h2>
                {suggestedTasks.length > 0 && <Badge variant="default" className="text-xs">{suggestedTasks.length}</Badge>}
                {dismissedSuggestions.size > 0 && (
                  <button
                    onClick={() => { setDismissedSuggestions(new Set()); try { localStorage.removeItem('retro-dismissed-suggestions') } catch { /* ignore */ } }}
                    className="ml-auto text-[11px] text-[#a99873] hover:text-[#5c5347] transition-colors"
                  >
                    {lang === 'fr' ? `Afficher les masqués (${dismissedSuggestions.size})` : lang === 'zh' ? `顯示已隱藏 (${dismissedSuggestions.size})` : `Show dismissed (${dismissedSuggestions.size})`}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {suggestedTasks.map((task) => {
                  const bestTemplate = (() => {
                    const lower = task.title.toLowerCase()
                    return userTemplates
                      .filter((t) => !t.keywords.includes('__archived'))
                      .find((t) => stripCatKeywords(t.keywords).some((kw) => lower.includes(kw.toLowerCase()))) ?? null
                  })()

                  return (
                    <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/50 px-4 py-3 hover:bg-red-50 transition-colors">
                      <GitBranch className="h-4 w-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#2a2420] truncate">{task.title}</p>
                        {task.deadline && (
                          <p className="text-xs text-[#8a7a5e] mt-0.5">
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatDateShort(new Date(task.deadline), lang)}
                          </p>
                        )}
                      </div>
                      {bestTemplate && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-red-800 font-medium">
                            {bestTemplate.name}
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
                      <button
                        onClick={() => dismissSuggestion(task.id)}
                        className="shrink-0 p-1 rounded-full text-[#c4b48a] hover:text-[#5c5347] hover:bg-[#ece2cb] transition-colors"
                        title={lang === 'fr' ? 'Ne plus afficher' : lang === 'zh' ? '不再顯示' : 'Dismiss'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Chains */}
          {chains.length === 0 && suggestedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#e2d6bc] py-20 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_v5/empty state retroplanning.png" alt="" className="h-28 w-auto mb-5 object-contain" style={{ mixBlendMode: 'multiply' }} />
              <p className="text-sm font-medium text-[#8a7a5e] max-w-xs">
                {lang === 'fr'
                  ? 'Aucune chaîne de tâches. Ouvrez une tâche avec deadline et cliquez sur "Rétroplanifier".'
                  : lang === 'zh'
                  ? '目前還沒有任務鏈。開啟一個有截止日期的任務，並點選「設定回溯排程」。'
                  : 'No task chains yet. Open a task with a deadline and click "Set up retroplan".'}
              </p>
            </div>
          ) : chains.length > 0 && (
            <div className="flex flex-col gap-6">
              {activeChains.length > 0 && (
              <div>
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="h-4 w-4 text-[#8a7a5e]" />
                <h2 className="text-sm font-semibold text-[#5c5347]">
                  {lang === 'fr' ? 'Chaînes de tâches' : lang === 'zh' ? '任務鏈' : 'Task chains'}
                </h2>
                <Badge variant="secondary" className="text-xs">{activeChains.length}</Badge>
              </div>

              <div className="flex flex-col gap-4">
                {activeChains.map(({ parent, children }) => {
                  const isActive = selectedChainId === parent.id
                  const allDone = parent.status === 'COMPLETED' && children.every((c) => c.status === 'COMPLETED')
                  const parentDeadlinePast = parent.deadline && new Date(parent.deadline) < now
                  const isOverdueChain = !allDone && parentDeadlinePast
                  const donePct = Math.round(
                    ([parent, ...children].filter((t) => t.status === 'COMPLETED').length / (1 + children.length)) * 100
                  )

                  return (
                    <div
                      key={parent.id}
                      className={cn(
                        'rounded-2xl border bg-[#fbf7ee] overflow-hidden transition-all',
                        isActive ? 'border-red-300 shadow-md shadow-red-100' : isOverdueChain ? 'border-red-200' : 'border-[#ece2cb]',
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
                            onComplete={handleCompleteTask}
                            lang={lang}
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isOverdueChain && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {lang === 'zh' ? '逾期' : lang === 'fr' ? 'En retard' : 'Overdue'}
                            </span>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="w-20 h-1.5 rounded-full bg-[#ece2cb] overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', allDone ? 'bg-emerald-500' : isOverdueChain ? 'bg-red-400' : 'bg-red-500')}
                                style={{ width: `${donePct}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#a99873] font-mono">{donePct}%</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteChainDialog({ parentId: parent.id, parentTitle: parent.title, childIds: children.map((c) => c.id) }) }}
                            className="p-1 rounded-lg hover:bg-red-50 text-[#c4b48a] hover:text-red-500 transition-colors"
                            title={lang === 'zh' ? '刪除鏈' : lang === 'fr' ? 'Supprimer la chaîne' : 'Delete chain'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
                            <div className="absolute left-2 top-2 bottom-2 w-px bg-red-100" />
                            <div className="flex flex-col gap-2">
                              {children.map((child, i) => {
                                const parentDeadline = parent.deadline ? new Date(parent.deadline) : null
                                const childDeadline = child.deadline ? new Date(child.deadline) : null
                                const daysBeforeParent = parentDeadline && childDeadline
                                  ? Math.round((parentDeadline.getTime() - childDeadline.getTime()) / 86400000)
                                  : undefined
                                return (
                                  <div key={child.id} className="relative group/child">
                                    <div className={cn(
                                      'absolute -left-4 top-3 h-3 w-3 rounded-full border-2 border-white',
                                      child.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-300'
                                    )} />
                                    <ChainCard
                                      node={{ task: child, isParent: false, daysBeforeParent }}
                                      isSelected={false}
                                      onClick={() => setSelectedChainId(parent.id)}
                                      onEdit={setEditingTask}
                                      onComplete={handleCompleteTask}
                                      lang={lang}
                                    />
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation()
                                        const res = await fetch(`/api/tasks/${child.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ parentTaskId: null }),
                                        })
                                        if (res.ok) {
                                          const fresh = await fetch('/api/tasks')
                                          if (fresh.ok) setTasks(await fresh.json())
                                        }
                                      }}
                                      className="absolute top-1 right-1 opacity-0 group-hover/child:opacity-100 p-0.5 rounded hover:bg-red-100 hover:text-red-500 text-[#c4b48a] transition-all"
                                      title={lang === 'zh' ? '從任務練移除' : lang === 'fr' ? 'Retirer de la chaîne' : 'Remove from chain'}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          {/* Link existing task button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); openLinkDialog(parent.id, parent.title) }}
                            className="mt-2 flex items-center gap-1.5 text-xs text-[#a99873] hover:text-[#ab3326] border border-dashed border-[#e2d6bc] hover:border-red-300 rounded-xl px-3 py-1.5 transition-colors w-full"
                          >
                            <Plus className="h-3 w-3" />
                            {lang === 'zh' ? '連結現有任務...' : lang === 'fr' ? 'Lier une tâche existante...' : 'Link existing task...'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
              )}

              {/* History: fully completed chains */}
              {pastChains.length > 0 && (
                <div>
                  <button
                    onClick={() => setHistoryOpen((v) => !v)}
                    className="w-full flex items-center gap-2 rounded-xl border border-[#ece2cb] bg-[#f3ecdd] px-4 py-2.5 hover:bg-[#ece2cb] transition-colors"
                  >
                    <History className="h-4 w-4 text-[#a99873]" />
                    <span className="text-sm font-medium text-[#8a7a5e] flex-1 text-left">
                      {lang === 'zh' ? '歷史紀錄' : lang === 'fr' ? 'Historique' : 'History'}
                    </span>
                    <Badge variant="secondary" className="text-xs">{pastChains.length}</Badge>
                    {historyOpen ? <ChevronDown className="h-4 w-4 text-[#a99873]" /> : <ChevronRight className="h-4 w-4 text-[#a99873]" />}
                  </button>

                  {historyOpen && (
                    <div className="flex flex-col gap-3 mt-3">
                      {/* Search */}
                      <input
                        className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-200 bg-white placeholder-[#c4b48a]"
                        placeholder={lang === 'zh' ? '搜尋歷史記錄...' : lang === 'fr' ? 'Rechercher dans l\'historique...' : 'Search history...'}
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                      />
                      {pastChains
                        .filter((c) => !historySearch || c.parent.title.toLowerCase().includes(historySearch.toLowerCase()) || c.children.some((ch) => ch.title.toLowerCase().includes(historySearch.toLowerCase())))
                        .map(({ parent, children }) => {
                          const isActive = selectedChainId === parent.id
                          const donePct = Math.round(
                            ([parent, ...children].filter((t) => t.status === 'COMPLETED').length / (1 + children.length)) * 100
                          )
                          return (
                            <div
                              key={parent.id}
                              className={cn(
                                'rounded-2xl border bg-[#f9f5ec] overflow-hidden transition-all opacity-70',
                                isActive ? 'border-[#c4b48a] shadow-sm' : 'border-[#e2d6bc]'
                              )}
                            >
                              <div
                                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f0e8d4] transition-colors"
                                onClick={() => setSelectedChainId(isActive ? null : parent.id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#8a7a5e] truncate line-through">{parent.title}</p>
                                  <p className="text-[11px] text-[#a99873] mt-0.5">
                                    {children.length} {lang === 'zh' ? '個階段' : lang === 'fr' ? 'étapes' : 'stages'}
                                    {parent.deadline && ` · ${formatDateShort(new Date(parent.deadline), lang)}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-16 h-1.5 rounded-full bg-[#ece2cb] overflow-hidden">
                                    <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${donePct}%` }} />
                                  </div>
                                  <span className="text-xs text-[#a99873] font-mono">{donePct}%</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteChainDialog({ parentId: parent.id, parentTitle: parent.title, childIds: children.map((c) => c.id) }) }}
                                    className="p-1 rounded-lg hover:bg-red-50 text-[#c4b48a] hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  {isActive ? <ChevronDown className="h-4 w-4 text-[#a99873]" /> : <ChevronRight className="h-4 w-4 text-[#a99873]" />}
                                </div>
                              </div>
                              {isActive && (
                                <div className="px-4 pb-3 flex flex-col gap-1.5 border-t border-[#f0e8d4]">
                                  <p className="text-[11px] text-[#a99873] mt-2 mb-1 uppercase tracking-wider font-semibold">
                                    {lang === 'zh' ? '回顧' : lang === 'fr' ? 'Révision' : 'Review'}
                                  </p>
                                  {children.map((child) => (
                                    <div key={child.id} className="flex items-center gap-2 rounded-lg bg-[#f3ecdd] px-3 py-1.5">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                      <span className="text-xs flex-1 truncate line-through text-[#a99873]">{child.title}</span>
                                      {child.deadline && (
                                        <span className="text-[10px] text-[#a99873] shrink-0">{formatDateShort(new Date(child.deadline), lang)}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      {pastChains.filter((c) => !historySearch || c.parent.title.toLowerCase().includes(historySearch.toLowerCase())).length === 0 && (
                        <p className="text-xs text-[#c4b48a] text-center py-2">
                          {lang === 'zh' ? '找不到符合的記錄' : lang === 'fr' ? 'Aucun résultat' : 'No results'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Template editor dialog */}
      {editingTemplate !== undefined && (
        <TemplateEditor
          template={editingTemplate === 'new' ? null : editingTemplate}
          initial={editingTemplate === 'new' ? forkDraft ?? undefined : undefined}
          onSave={handleSaveTemplate}
          onDelete={editingTemplate && editingTemplate !== 'new' ? () => { handleDeleteTemplate(editingTemplate.id); setEditingTemplate(undefined) } : undefined}
          onClose={() => { setEditingTemplate(undefined); setForkDraft(null) }}
          lang={lang}
          allTemplates={userTemplates}
        />
      )}

      {/* Scan preview dialog */}
      {previewScan && (
        <Dialog open onOpenChange={() => setPreviewScan(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4 text-amber-600" />
                {lang === 'fr' ? 'Aperçu du rétroplanning' : lang === 'zh' ? '逆向規劃預覽' : 'Retroplan preview'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-1">
                <p className="text-sm font-semibold text-amber-900">{previewScan.title}</p>
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {lang === 'fr' ? 'Échéance :' : lang === 'zh' ? '截止：' : 'Deadline:'} {previewScan.date}
                </p>
                <p className="text-[11px] text-amber-500">{lang === 'fr' ? 'Modèle :' : lang === 'zh' ? '模板：' : 'Template:'} {previewScan.templateName}</p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#a99873]">
                  {lang === 'fr' ? 'Étapes générées' : lang === 'zh' ? '將建立的階段' : 'Stages to create'}
                </p>
                {previewScan.stages.map((s, i) => {
                  const d = new Date(previewScan.start)
                  d.setDate(d.getDate() - s.daysBeforeDeadline)
                  const dateStr = d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-[#e2d6bc] bg-[#f3ecdd] px-3 py-2">
                      <span className="h-5 w-5 rounded-full bg-red-100 text-red-900 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-xs text-[#3a3326] flex-1 leading-snug">{s.name}</span>
                      <span className="text-[11px] text-[#a99873] shrink-0">{dateStr}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewScan(null)}>
                {lang === 'fr' ? 'Annuler' : lang === 'zh' ? '取消' : 'Cancel'}
              </Button>
              <Button
                onClick={() => { handleCreateFromScan(previewScan); setPreviewScan(null) }}
                disabled={scanCreating === previewScan.title}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {scanCreating === previewScan.title ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {lang === 'fr' ? 'Créer' : lang === 'zh' ? '建立' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Link existing task dialog */}
      {linkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setLinkDialog(null)}>
          <div className="bg-[#fbf7ee] rounded-2xl border border-[#e2d6bc] shadow-xl w-80 max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-[#ece2cb] flex items-center justify-between">
              <p className="text-sm font-semibold text-[#2a2420]">
                {lang === 'zh' ? '連結任務' : lang === 'fr' ? 'Lier une tâche' : 'Link a task'}
              </p>
              <button onClick={() => setLinkDialog(null)} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="px-4 pt-2 text-[11px] text-[#8a7a5e]">
              {lang === 'zh' ? `將加入任務鏈「${linkDialog.parentTitle}」` : lang === 'fr' ? `Sera ajouté à la chaîne « ${linkDialog.parentTitle} »` : `Will be added to chain "${linkDialog.parentTitle}"`}
            </p>
            <div className="px-4 py-2 border-b border-[#ece2cb]">
              <input
                autoFocus
                className="w-full border border-[#e2d6bc] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                placeholder={lang === 'zh' ? '搜尋任務...' : lang === 'fr' ? 'Rechercher une tâche...' : 'Search tasks...'}
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {(freshTasks.length > 0 ? freshTasks : tasks)
                .filter((t) => t.id !== linkDialog.parentId && t.parentTaskId !== linkDialog.parentId)
                .filter((t) => !linkSearch || t.title.toLowerCase().includes(linkSearch.toLowerCase()))
                .sort((a, b) => {
                  const aKw = a.title.toLowerCase().includes(linkDialog.parentTitle.split(/[\s|]+/)[0]?.toLowerCase() ?? '') ? -1 : 0
                  const bKw = b.title.toLowerCase().includes(linkDialog.parentTitle.split(/[\s|]+/)[0]?.toLowerCase() ?? '') ? -1 : 0
                  return aKw - bKw || a.title.localeCompare(b.title)
                })
                .map((t) => {
                  const selected = linkSelectedIds.has(t.id)
                  // Already a child of a DIFFERENT chain — disable
                  const inOtherChain = !!t.parentTaskId && t.parentTaskId !== linkDialog.parentId
                  return (
                    <button
                      key={t.id}
                      disabled={inOtherChain}
                      onClick={() => !inOtherChain && setLinkSelectedIds((prev) => { const next = new Set(prev); selected ? next.delete(t.id) : next.add(t.id); return next })}
                      className={cn(
                        'flex items-center gap-2 text-xs rounded-lg px-2.5 py-2 text-left transition-colors border',
                        inOtherChain ? 'opacity-40 cursor-not-allowed border-transparent' : selected ? 'bg-red-50 border-red-200' : 'hover:bg-[#f3ecdd] border-transparent'
                      )}
                    >
                      <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-red-600 border-red-600' : 'border-[#c4b48a]'}`}>
                        {selected && <Check className="h-2.5 w-2.5 text-white" />}
                      </span>
                      <span className="truncate flex-1 text-[#3a3326]">{t.title}</span>
                      {inOtherChain && <span className="shrink-0 text-[9px] text-[#c4b48a] bg-[#f3ecdd] rounded px-1">{lang === 'zh' ? '已在其他任務練' : lang === 'fr' ? 'autre chaîne' : 'other chain'}</span>}
                      {t.deadline && <span className="text-[#a99873] shrink-0 text-[10px]">{formatDateShort(new Date(t.deadline), lang)}</span>}
                    </button>
                  )
                })}
            </div>
            <div className="px-4 py-3 border-t border-[#ece2cb] flex gap-2">
              <button onClick={() => setLinkDialog(null)} className="flex-1 rounded-xl border border-[#e2d6bc] text-[#5c5347] text-xs py-2 hover:bg-[#ece2cb] transition-colors">
                {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleLinkToChain}
                disabled={linkSelectedIds.size === 0 || linkSaving}
                className="flex-1 rounded-xl bg-[#ab3326] text-white text-xs py-2 hover:bg-[#861f17] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {linkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                {lang === 'zh' ? `連結${linkSelectedIds.size > 0 ? ` (${linkSelectedIds.size})` : ''}` : lang === 'fr' ? `Lier${linkSelectedIds.size > 0 ? ` (${linkSelectedIds.size})` : ''}` : `Link${linkSelectedIds.size > 0 ? ` (${linkSelectedIds.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
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

      {/* Delete chain dialog */}
      {deleteChainDialog && (
        <Dialog open onOpenChange={() => setDeleteChainDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Trash2 className="h-4 w-4 text-red-600" />
                {lang === 'zh' ? '刪除任務鏈' : lang === 'fr' ? 'Supprimer la chaîne' : 'Delete chain'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-1">
              <p className="text-sm text-[#5c5347]">
                <span className="font-medium text-[#2a2420]">「{deleteChainDialog.parentTitle}」</span>
                {lang === 'zh'
                  ? ` 共有 ${deleteChainDialog.childIds.length} 個階段任務。`
                  : lang === 'fr'
                  ? ` comporte ${deleteChainDialog.childIds.length} étape(s).`
                  : ` has ${deleteChainDialog.childIds.length} stage(s).`}
              </p>
              <p className="text-xs text-[#8a7a5e]">
                {lang === 'zh'
                  ? '要刪除所有任務，還是只解除它們的連結關係（保留任務本身）？'
                  : lang === 'fr'
                  ? 'Voulez-vous supprimer toutes les tâches ou seulement dissocier la chaîne (conserver les tâches) ?'
                  : 'Delete all tasks, or just unlink them (keep tasks but remove chain connection)?'}
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setDeleteChainDialog(null)} disabled={deleteChainLoading}>
                {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDeleteChain('unlink')}
                disabled={deleteChainLoading}
                className="border-amber-300 text-amber-800 hover:bg-amber-50"
              >
                {deleteChainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {lang === 'zh' ? '只解除連結' : lang === 'fr' ? 'Dissocier seulement' : 'Unlink only'}
              </Button>
              <Button
                onClick={() => handleDeleteChain('delete')}
                disabled={deleteChainLoading}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteChainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {lang === 'zh' ? '刪除全部任務' : lang === 'fr' ? 'Tout supprimer' : 'Delete all'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Prefix auto-link confirmation dialog */}
      {prefixConfirmDialog && (
        <Dialog open onOpenChange={() => setPrefixConfirmDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <GitBranch className="h-4 w-4 text-amber-600" />
                {lang === 'zh' ? '確認串成任務鏈' : lang === 'fr' ? 'Confirmer la liaison' : 'Confirm chain link'}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-1">
              <p className="text-sm text-[#5c5347]">
                {lang === 'zh'
                  ? `以下 ${prefixConfirmDialog.tasks.length} 個任務前綴相同（「${prefixConfirmDialog.prefix}」），將依截止日期由晚到早串成一條任務鏈，最晚的任務為主任務。`
                  : lang === 'fr'
                  ? `Ces ${prefixConfirmDialog.tasks.length} tâches partagent le préfixe « ${prefixConfirmDialog.prefix} ». Elles seront liées en chaîne, la tâche avec l'échéance la plus lointaine sera la tâche principale.`
                  : `These ${prefixConfirmDialog.tasks.length} tasks share the prefix "${prefixConfirmDialog.prefix}" and will be linked into a chain. The task with the latest deadline becomes the head.`}
              </p>
              <div className="flex flex-col gap-1.5 rounded-xl border border-[#ece2cb] bg-[#fbf7ee] p-3">
                {[...prefixConfirmDialog.tasks]
                  .sort((a, b) => {
                    const da = a.deadline ? new Date(String(a.deadline)).getTime() : Infinity
                    const db = b.deadline ? new Date(String(b.deadline)).getTime() : Infinity
                    return db - da
                  })
                  .map((t, i) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-[#3a3326]">
                      {i === 0
                        ? <span className="shrink-0 text-[9px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">{lang === 'zh' ? '主任務' : lang === 'fr' ? 'principal' : 'head'}</span>
                        : <span className="shrink-0 text-[9px] text-[#a99873] bg-[#f3ecdd] rounded px-1.5 py-0.5">{lang === 'zh' ? '子任務' : lang === 'fr' ? 'étape' : 'step'}</span>
                      }
                      <span className="truncate flex-1">{t.title}</span>
                      {t.deadline && <span className="shrink-0 text-[#a99873]">{formatDateShort(new Date(String(t.deadline)), lang)}</span>}
                    </div>
                  ))}
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setPrefixConfirmDialog(null)} disabled={prefixLinkSaving}>
                {lang === 'zh' ? '取消' : lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button
                onClick={handleConfirmAutoLink}
                disabled={prefixLinkSaving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {prefixLinkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                {lang === 'zh' ? '確認串鏈' : lang === 'fr' ? 'Lier' : 'Link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
