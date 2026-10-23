import { useAppStore } from '@/stores/useAppStore'
import { calculatePriority, placeholderTask, isPendingTaskId } from '@/lib/utils'
import { Task } from '@/types'

/**
 * Task writes that update the screen first and the server second: the list
 * changes the moment the person acts, and a refused or failed request puts it
 * back and reports through `onError`. Every page used to wait for the round
 * trip (and sometimes a full re-read of the task list) before anything moved.
 */

type OnError = () => void

/** Fields the form sends, in the shape the store keeps (dates as strings). */
function asStoreFields(data: Partial<Task>): Partial<Task> {
  const out: Partial<Task> = { ...data }
  for (const key of ['deadline', 'scheduledStart', 'scheduledEnd'] as const) {
    const v = data[key]
    if (v instanceof Date) out[key] = v.toISOString()
  }
  return out
}

export async function saveTaskEdit(id: string, data: Partial<Task>, onError: OnError): Promise<Task | null> {
  const { tasks, updateTask } = useAppStore.getState()
  const before = tasks.find((t) => t.id === id)
  if (!before || isPendingTaskId(id)) return null
  const importance = data.importance ?? before.importance
  const urgency = data.urgency ?? before.urgency
  updateTask(id, { ...asStoreFields(data), priority: calculatePriority(importance, urgency) })
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(String(res.status))
    const saved: Task = await res.json()
    useAppStore.getState().updateTask(id, saved)
    return saved
  } catch {
    useAppStore.getState().updateTask(id, before)
    onError()
    return null
  }
}

/**
 * Shows the task at once, then saves it. `prepare` runs before the POST for
 * work the request depends on (creating the linked calendar event) and returns
 * extra fields to send.
 */
export async function createTaskOptimistic(
  data: Partial<Task>,
  onError: OnError,
  prepare?: () => Promise<Partial<Task>>,
): Promise<Task | null> {
  const temp = placeholderTask(asStoreFields(data))
  useAppStore.getState().addTask(temp)
  try {
    const extra = prepare ? await prepare() : {}
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ...extra }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const created: Task = await res.json()
    useAppStore.getState().replaceTask(temp.id, created)
    return created
  } catch {
    useAppStore.getState().removeTask(temp.id)
    onError()
    return null
  }
}

/** Removes the task and detaches its subtasks, as the API does. */
export async function deleteTaskOptimistic(id: string, onError: OnError): Promise<boolean> {
  const { tasks, setTasks } = useAppStore.getState()
  if (isPendingTaskId(id)) return false
  const before = tasks
  setTasks(tasks
    .filter((t) => t.id !== id)
    .map((t) => (t.parentTaskId === id ? { ...t, parentTaskId: null } : t))
    .map((t) => (t.subTasks?.some((s) => s.id === id) ? { ...t, subTasks: t.subTasks.filter((s) => s.id !== id) } : t)))
  useAppStore.setState({ lastMutationAt: Date.now() })
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(String(res.status))
    return true
  } catch {
    useAppStore.getState().setTasks(before)
    onError()
    return false
  }
}
