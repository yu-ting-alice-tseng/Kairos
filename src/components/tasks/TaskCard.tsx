'use client'

import React, { useState } from 'react'
import { Task, QUADRANT_LABEL_ZH } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import { formatDate, formatDuration, getQuadrant, EISENHOWER_QUADRANTS, isOverdue } from '@/lib/utils'
import { isSameDay } from 'date-fns'
import {
  CheckCircle2, Circle, Clock, Calendar, Sparkles, ChevronDown, ChevronRight,
  MoreHorizontal, RefreshCw, Scissors, Edit2, Trash2, AlertTriangle, Loader2
} from 'lucide-react'

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => Promise<void>
  onEdit: (task: Task) => void
  onDelete: (id: string) => Promise<void>
  onBreakdown: (task: Task) => void
  onReschedule: (task: Task) => void
  lang?: 'fr' | 'en' | 'zh'
  compact?: boolean
  selectedDate?: Date
}

const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true'

export function TaskCard({
  task,
  onComplete,
  onEdit,
  onDelete,
  onBreakdown,
  onReschedule,
  lang = 'fr',
  compact = false,
  selectedDate,
}: TaskCardProps) {
  const [showActions, setShowActions] = useState(false)
  const [showSubtasks, setShowSubtasks] = useState(false)
  const [completing, setCompleting] = useState(false)
  const isCompleted = task.status === 'COMPLETED'
  const isMissed = task.status === 'MISSED'
  const overdue = isOverdue(task.scheduledEnd)
  const quadrantId = getQuadrant(task.importance, task.urgency)
  const quadrant = EISENHOWER_QUADRANTS.find((q) => q.id === quadrantId)

  const statusColors: Record<string, string> = {
    PENDING: 'text-[#6e6147] bg-[#f3ecdd]',
    IN_PROGRESS: 'text-blue-600 bg-blue-50',
    COMPLETED: 'text-emerald-600 bg-emerald-50',
    MISSED: 'text-red-600 bg-red-50',
    RESCHEDULED: 'text-amber-600 bg-amber-50',
  }

  return (
    <div
      className={`group relative rounded-2xl border bg-[#fbf7ee] transition-all duration-200 hover:shadow-md ${
        isCompleted ? 'opacity-60 border-[#ece2cb]' : overdue ? 'border-red-200 bg-red-50/30' : 'border-[#ece2cb] hover:border-[#e2d6bc]'
      }`}
    >
      <div className={`flex items-start gap-3 p-4 ${compact ? 'py-3' : ''}`}>
        <button
          onClick={async () => {
            if (completing) return
            setCompleting(true)
            await onComplete(task.id)
            setCompleting(false)
          }}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110"
          disabled={completing}
          title={isCompleted ? 'Marquer comme non terminé' : undefined}
        >
          {completing ? (
            <Loader2 className="h-5 w-5 text-red-400 animate-spin" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 hover:text-[#a99873] transition-colors" />
          ) : (
            <Circle className="h-5 w-5 text-[#cbb98e] group-hover:text-red-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-medium text-sm ${isCompleted ? 'line-through text-[#a99873]' : 'text-[#2a2420]'} line-clamp-2`}>
              {task.title}
            </p>
            <button
              onClick={() => setShowActions(!showActions)}
              className="shrink-0 p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873] hover:text-[#6e6147] opacity-0 group-hover:opacity-100 transition-all"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {!compact && task.description && (
            <p className="text-xs text-[#8a7a5e] mt-1 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {quadrant && (
              <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${quadrant.bgColor} ${quadrant.color}`}>
                {lang === 'fr' ? quadrant.labelFr : lang === 'zh' ? QUADRANT_LABEL_ZH[quadrant.id] : quadrant.label}
              </span>
            )}
            {task.estimatedMinutes && (
              <span className="flex items-center gap-1 text-xs text-[#8a7a5e]">
                <Clock className="h-3 w-3" />
                {formatDuration(task.estimatedMinutes, lang)}
              </span>
            )}
            {task.scheduledStart && (
              <span className="flex items-center gap-1 text-xs text-[#8a7a5e]">
                <Calendar className="h-3 w-3" />
                {formatDate(task.scheduledStart, lang)}
              </span>
            )}
            {task.deadline && !(selectedDate && isSameDay(new Date(String(task.deadline)), selectedDate)) && (
              <Badge variant={overdue ? 'destructive' : 'warning'} className="text-xs py-0">
                {overdue && <AlertTriangle className="h-3 w-3 mr-1" />}
                {formatDate(task.deadline, lang)}
              </Badge>
            )}
            {task.aiSuggested && (
              <span className="flex items-center gap-1 text-xs text-red-800">
                <Sparkles className="h-3 w-3" />
                IA
              </span>
            )}
            {isMissed && (
              <Badge variant="destructive" className="text-xs py-0">{t('missed', lang)}</Badge>
            )}
          </div>

          {task.subTasks && task.subTasks.length > 0 && (
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="flex items-center gap-1 text-xs text-red-800 mt-2 hover:text-red-900"
            >
              {showSubtasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {task.subTasks.length} {t('subTasks', lang)}
            </button>
          )}

          {showSubtasks && task.subTasks && (
            <div className="mt-2 ml-4 flex flex-col gap-1.5 border-l-2 border-red-100 pl-3">
              {task.subTasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <Circle className="h-3 w-3 text-[#cbb98e] shrink-0" />
                  <p className="text-xs text-[#6e6147]">{sub.title}</p>
                  {sub.estimatedMinutes && (
                    <span className="text-xs text-[#a99873]">({formatDuration(sub.estimatedMinutes, lang)})</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showActions && (
        <div className="border-t border-[#ece2cb] px-4 py-2 flex items-center gap-1 flex-wrap">
          <Button size="sm" variant="ghost" onClick={() => { onEdit(task); setShowActions(false) }}>
            <Edit2 className="h-3.5 w-3.5" />
            {t('edit', lang)}
          </Button>
          {!isCompleted && AI_ENABLED && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { onBreakdown(task); setShowActions(false) }}>
                <Scissors className="h-3.5 w-3.5" />
                {t('breakdownTask', lang)}
              </Button>
              {(isMissed || overdue) && (
                <Button size="sm" variant="ghost" onClick={() => { onReschedule(task); setShowActions(false) }}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('reschedule', lang)}
                </Button>
              )}
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)} className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
            {t('delete', lang)}
          </Button>
        </div>
      )}
    </div>
  )
}
