import { useAppStore } from '@/stores/useAppStore'

/**
 * Habit check-ins that tick the habit at once and save after, like the task
 * writes in task-mutations. The server's streak replaces the guessed one when
 * it answers; a failure unticks and reports through `onError`.
 */

export async function completeHabitOptimistic(habitId: string, onError: () => void) {
  const { habits, updateHabit } = useAppStore.getState()
  const before = habits.find((h) => h.id === habitId)
  if (!before) return
  updateHabit(habitId, {
    streak: before.streak + 1,
    longestStreak: Math.max(before.longestStreak, before.streak + 1),
    completions: [{ id: 'tmp', habitId, completedAt: new Date().toISOString() }],
  })
  try {
    const res = await fetch('/api/habits/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const { streak } = await res.json()
    useAppStore.getState().updateHabit(habitId, { streak, longestStreak: Math.max(before.longestStreak, streak) })
  } catch {
    useAppStore.getState().updateHabit(habitId, before)
    onError()
  }
}

export async function uncompleteHabitOptimistic(habitId: string, onError: () => void) {
  const { habits, updateHabit } = useAppStore.getState()
  const before = habits.find((h) => h.id === habitId)
  if (!before) return
  updateHabit(habitId, { streak: Math.max(0, before.streak - 1), completions: [] })
  try {
    const res = await fetch('/api/habits/complete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habitId }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const { streak } = await res.json()
    useAppStore.getState().updateHabit(habitId, { streak })
  } catch {
    useAppStore.getState().updateHabit(habitId, before)
    onError()
  }
}
