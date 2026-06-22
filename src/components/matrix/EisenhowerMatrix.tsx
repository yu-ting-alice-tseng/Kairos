'use client'

import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Task, EISENHOWER_QUADRANTS, QUADRANT_LABEL_ZH } from '@/types'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/stores/useAppStore'
import { getQuadrant, formatDuration } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertCircle, Zap } from 'lucide-react'

interface QuadrantDroppableProps {
  id: string
  label: string
  color: string
  bgColor: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

function TaskCard({ task, isDragging = false }: { task: Task; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform) }

  const urgencyColor = task.urgency >= 8 ? 'text-red-600' : task.urgency >= 6 ? 'text-amber-600' : 'text-[#a99873]'
  const importanceColor = task.importance >= 8 ? 'text-red-800' : task.importance >= 6 ? 'text-blue-500' : 'text-[#a99873]'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative bg-[#fbf7ee] rounded-xl border border-[#ece2cb] p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md hover:border-[#e2d6bc] transition-all duration-150 select-none ${isDragging ? 'opacity-50' : ''} ${task.status === 'COMPLETED' ? 'opacity-50' : ''}`}
    >
      <p className={`text-sm font-medium line-clamp-2 mb-2 ${task.status === 'COMPLETED' ? 'line-through text-[#a99873]' : 'text-[#2a2420]'}`}>{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {task.estimatedMinutes && (
          <span className="flex items-center gap-1 text-xs text-[#8a7a5e]">
            <Clock className="h-3 w-3" />
            {formatDuration(task.estimatedMinutes)}
          </span>
        )}
        <span className={`flex items-center gap-1 text-xs font-medium ${importanceColor}`}>
          <Zap className="h-3 w-3" />
          {task.importance}
        </span>
        <span className={`flex items-center gap-1 text-xs font-medium ${urgencyColor}`}>
          <AlertCircle className="h-3 w-3" />
          {task.urgency}
        </span>
        {task.deadline && (
          <Badge variant="warning" className="text-xs py-0">
            {new Date(task.deadline).toLocaleDateString()}
          </Badge>
        )}
      </div>
    </div>
  )
}

function QuadrantDroppable({ id, label, color, bgColor, tasks, onTaskClick }: QuadrantDroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border-2 p-4 min-h-[220px] transition-all duration-200 ${bgColor} ${
        isOver ? 'ring-2 ring-red-400 ring-offset-2 scale-[1.01]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold text-sm ${color}`}>{label}</h3>
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${color} bg-[#fbf7ee]/60`}>
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {tasks.map((task) => (
          <div key={task.id} onClick={() => onTaskClick(task)}>
            <TaskCard task={task} />
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-[#e2d6bc] rounded-xl min-h-[80px] gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_v5/empty matric.png" alt="" className="h-10 w-10 opacity-30 object-contain" />
            <span className="text-xs text-[#c9b88a] italic">Glissez ici</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface EisenhowerMatrixProps {
  tasks: Task[]
  onTaskUpdate: (id: string, importance: number, urgency: number) => Promise<void>
  onTaskClick: (task: Task) => void
  lang?: 'fr' | 'en' | 'zh'
}

export function EisenhowerMatrix({ tasks, onTaskUpdate, onTaskClick, lang = 'fr' }: EisenhowerMatrixProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const getTasksForQuadrant = useCallback(
    (quadrantId: string) =>
      tasks.filter((t) => t.status !== 'CANCELLED' && getQuadrant(t.importance, t.urgency) === quadrantId),
    [tasks]
  )

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const quadrantMap: Record<string, { importance: number; urgency: number }> = {
      'do-first': { importance: 8, urgency: 8 },
      schedule: { importance: 8, urgency: 3 },
      delegate: { importance: 3, urgency: 8 },
      eliminate: { importance: 3, urgency: 3 },
    }

    const target = quadrantMap[over.id as string]
    if (!target) return

    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    if (getQuadrant(task.importance, task.urgency) === over.id) return

    await onTaskUpdate(task.id as string, target.importance, target.urgency)
  }

  const quadrants = EISENHOWER_QUADRANTS

  // Display order: urgency increases LEFT→RIGHT, importance increases BOTTOM→TOP
  // top-left: low urgency + high importance (Schedule / Planifier)
  // top-right: high urgency + high importance (Do First / À faire maintenant)
  // bottom-left: low urgency + low importance (Eliminate / Éliminer)
  // bottom-right: high urgency + low importance (Delegate / Déléguer)
  const displayOrder = ['schedule', 'do-first', 'eliminate', 'delegate']
  const displayQuadrants = displayOrder.map((id) => quadrants.find((q) => q.id === id)!)

  return (
    <div className="w-full">
      {/* X-axis header: urgency increases to the right */}
      <div className="flex items-center mb-3 pl-10">
        <div className="flex-1 flex">
          <div className="flex-1 text-center text-xs font-semibold text-[#a99873] pb-1">
            ← {lang === 'fr' ? 'Urgence basse' : lang === 'zh' ? '低緊急度' : 'Low urgency'}
          </div>
          <div className="flex-1 text-center text-xs font-semibold text-red-600 pb-1">
            {lang === 'fr' ? 'Urgence haute' : lang === 'zh' ? '高緊急度' : 'High urgency'} →
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {/* Y-axis label: two horizontal labels top/bottom */}
        <div className="w-16 flex flex-col justify-between items-center shrink-0 py-2">
          <span className="text-xs font-semibold text-red-800 text-center leading-tight">
            ↑ {lang === 'fr' ? 'Importance haute' : lang === 'zh' ? '高重要度' : 'High importance'}
          </span>
          <span className="text-xs font-semibold text-[#a99873] text-center leading-tight">
            ↓ {lang === 'fr' ? 'Importance basse' : lang === 'zh' ? '低重要度' : 'Low importance'}
          </span>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 grid grid-cols-2 gap-4">
            {displayQuadrants.map((q) => (
              <QuadrantDroppable
                key={q.id}
                id={q.id}
                label={lang === 'fr' ? q.labelFr : lang === 'zh' ? QUADRANT_LABEL_ZH[q.id] : q.label}
                color={q.color}
                bgColor={q.bgColor}
                tasks={getTasksForQuadrant(q.id)}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask && (
              <div className="opacity-90 rotate-2 scale-105">
                <div className="bg-[#fbf7ee] rounded-xl border border-red-300 shadow-xl p-3">
                  <p className="text-sm font-medium text-[#2a2420]">{activeTask.title}</p>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
