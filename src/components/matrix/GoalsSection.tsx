'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Goal } from '@/types'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Target, Telescope, Trash2, Check, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoalsSectionProps {
  lang: 'fr' | 'en'
}

function GoalItem({
  goal,
  onDelete,
  onEdit,
}: {
  goal: Goal
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(goal.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const save = () => {
    if (text.trim() && text.trim() !== goal.text) onEdit(goal.id, text.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="h-7 text-sm py-0 px-2"
        />
        <button onClick={save} className="p-1 rounded hover:bg-green-100 text-green-600">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2 py-1">
      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
      <span className="text-sm text-gray-700 flex-1 leading-snug">{goal.text}</span>
      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(goal.id)}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function GoalColumn({
  type,
  goals,
  lang,
  onAdd,
  onDelete,
  onEdit,
}: {
  type: 'LONG_TERM' | 'SHORT_TERM'
  goals: Goal[]
  lang: 'fr' | 'en'
  onAdd: (text: string, type: 'LONG_TERM' | 'SHORT_TERM') => void
  onDelete: (id: string) => void
  onEdit: (id: string, text: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isLong = type === 'LONG_TERM'

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const submit = () => {
    if (newText.trim()) { onAdd(newText.trim(), type); setNewText('') }
    setAdding(false)
  }

  return (
    <div className="flex-1 min-w-0">
      <div className={cn(
        'flex items-center gap-2 mb-2 pb-1.5 border-b',
        isLong ? 'border-violet-200' : 'border-emerald-200'
      )}>
        {isLong
          ? <Telescope className="h-3.5 w-3.5 text-violet-500 flex-shrink-0" />
          : <Target className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isLong ? 'text-violet-600' : 'text-emerald-600'
        )}>
          {isLong ? t('longTermGoals', lang) : t('shortTermGoals', lang)}
        </span>
      </div>

      <div className="flex flex-col gap-0.5 mb-2 min-h-[28px]">
        {goals.length === 0 && !adding && (
          <p className="text-xs text-gray-400 italic py-1">{t('noGoals', lang)}</p>
        )}
        {goals.map((g) => (
          <GoalItem key={g.id} goal={g} onDelete={onDelete} onEdit={onEdit} />
        ))}
      </div>

      {adding ? (
        <div className="flex items-center gap-1.5 mt-1">
          <Input
            ref={inputRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={lang === 'fr' ? 'Mon objectif…' : 'My goal…'}
            className="h-7 text-sm py-0 px-2"
          />
          <button onClick={submit} className="p-1 rounded hover:bg-green-100 text-green-600">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setAdding(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-dashed transition-colors',
            isLong
              ? 'border-violet-200 text-violet-500 hover:bg-violet-50'
              : 'border-emerald-200 text-emerald-500 hover:bg-emerald-50'
          )}
        >
          <Plus className="h-3 w-3" />
          {t('addGoal', lang)}
        </button>
      )}
    </div>
  )
}

export function GoalsSection({ lang }: GoalsSectionProps) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/goals')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setGoals(Array.isArray(data) ? data : []))
  }, [])

  const handleAdd = async (text: string, type: 'LONG_TERM' | 'SHORT_TERM') => {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, type }),
    })
    if (res.ok) {
      const created = await res.json()
      setGoals((prev) => [...prev, created])
    }
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/goals', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }

  const handleEdit = async (id: string, text: string) => {
    const res = await fetch('/api/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text }),
    })
    if (res.ok) setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, text } : g)))
  }

  const longTerm = goals.filter((g) => g.type === 'LONG_TERM')
  const shortTerm = goals.filter((g) => g.type === 'SHORT_TERM')

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm mb-5">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-2xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700">{t('goalsTitle', lang)}</span>
          <span className="text-xs text-gray-400">— {t('goalsHint', lang)}</span>
        </div>
        {collapsed
          ? <ChevronDown className="h-4 w-4 text-gray-400" />
          : <ChevronUp className="h-4 w-4 text-gray-400" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 flex gap-6">
          <GoalColumn
            type="LONG_TERM"
            goals={longTerm}
            lang={lang}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
          <div className="w-px bg-gray-100" />
          <GoalColumn
            type="SHORT_TERM"
            goals={shortTerm}
            lang={lang}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        </div>
      )}
    </div>
  )
}
