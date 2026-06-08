'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Task, AIBreakdownResult } from '@/types'
import { t } from '@/lib/i18n'
import { formatDuration, getQuadrant, EISENHOWER_QUADRANTS } from '@/lib/utils'
import { Sparkles, Clock, Target, CheckCircle, Loader2 } from 'lucide-react'

interface BreakdownDialogProps {
  open: boolean
  onClose: () => void
  task: Task | null
  onAccept: (task: Task, subTasks: AIBreakdownResult['subTasks']) => Promise<void>
  lang?: 'fr' | 'en'
}

export function BreakdownDialog({ open, onClose, task, onAccept, lang = 'fr' }: BreakdownDialogProps) {
  const [deadline, setDeadline] = useState(
    task?.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
  )
  const [totalHours, setTotalHours] = useState(Math.ceil((task?.estimatedMinutes ?? 120) / 60))
  const [result, setResult] = useState<AIBreakdownResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!task) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description,
          deadline,
          totalHours,
          lang,
        }),
      })
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setResult(data)
    } catch {
      setError(lang === 'fr' ? 'Erreur lors de la génération. Réessayez.' : 'Generation error. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!task || !result) return
    setAccepting(true)
    try {
      await onAccept(task, result.subTasks)
      onClose()
    } finally {
      setAccepting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => { setResult(null); onClose() }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            {t('breakdownTitle', lang)}
          </DialogTitle>
        </DialogHeader>

        {task && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">{task.title}</p>
              {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
            </div>

            {!result && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-600">{t('breakdownDesc', lang)}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('deadline', lang)}</Label>
                    <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('totalHours', lang)}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={totalHours}
                      onChange={(e) => setTotalHours(Number(e.target.value))}
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button onClick={handleGenerate} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {lang === 'fr' ? 'Analyse en cours...' : 'Analyzing...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t('generate', lang)}
                    </>
                  )}
                </Button>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 text-sm">
                    {result.subTasks.length} {lang === 'fr' ? 'sous-tâches' : 'subtasks'}
                  </h4>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(result.totalEstimatedMinutes, lang)}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {result.subTasks.map((sub, i) => {
                    const qId = getQuadrant(sub.importance, sub.urgency)
                    const q = EISENHOWER_QUADRANTS.find((q) => q.id === qId)
                    return (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50/50">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{sub.title}</p>
                          {sub.description && <p className="text-xs text-gray-500 mt-0.5">{sub.description}</p>}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              {formatDuration(sub.estimatedMinutes, lang)}
                            </span>
                            {q && (
                              <span className={`text-xs rounded-full px-2 py-0.5 ${q.bgColor} ${q.color}`}>
                                {lang === 'fr' ? q.labelFr : q.label}
                              </span>
                            )}
                            {sub.scheduledDate && (
                              <Badge variant="outline" className="text-xs py-0">
                                {sub.scheduledDate}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {result.suggestions && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                    <p className="text-xs font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      {lang === 'fr' ? 'Conseils IA' : 'AI Tips'}
                    </p>
                    <p className="text-xs text-indigo-600 whitespace-pre-line">{result.suggestions}</p>
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                  {lang === 'fr' ? 'Régénérer' : 'Regenerate'}
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { setResult(null); onClose() }}>{t('cancel', lang)}</Button>
          {result && (
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {lang === 'fr' ? 'Créer les sous-tâches' : 'Create subtasks'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
