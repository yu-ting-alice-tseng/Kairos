import { prisma } from '@/lib/prisma'

/**
 * Removes exactly the tasks asked for and keeps their chains alive.
 *
 * Deleting a calendar event should cost you that event and nothing else, so a
 * chain whose head goes away is re-headed rather than dropped: the remaining
 * stage with the latest deadline becomes the new parent, the others hang off
 * it, and the chain's name (if it was given one) moves with the role.
 *
 * Returns every id that was removed.
 */
export async function deleteTasksAndRehead(userId: string, taskIds: string[]): Promise<string[]> {
  if (taskIds.length === 0) return []

  const doomed = await prisma.task.findMany({
    where: { id: { in: taskIds }, userId },
    select: { id: true, chainName: true },
  })
  if (doomed.length === 0) return []
  const doomedIds = doomed.map((t) => t.id)

  const children = await prisma.task.findMany({
    where: { userId, parentTaskId: { in: doomedIds } },
    select: { id: true, parentTaskId: true, deadline: true, createdAt: true },
  })

  for (const parent of doomed) {
    const orphans = children.filter((c) => c.parentTaskId === parent.id && !doomedIds.includes(c.id))
    if (orphans.length === 0) continue

    // The chain reads back from its deadline, so its head is the last thing due.
    // No deadline sorts to the back; a tie falls to the one created first.
    const [heir, ...rest] = [...orphans].sort((a, b) => {
      const da = a.deadline ? new Date(String(a.deadline)).getTime() : -Infinity
      const db = b.deadline ? new Date(String(b.deadline)).getTime() : -Infinity
      if (da !== db) return db - da
      return new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime()
    })

    await prisma.task.update({
      where: { id: heir.id },
      data: { parentTaskId: null, ...(parent.chainName ? { chainName: parent.chainName } : {}) },
    })
    if (rest.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: rest.map((r) => r.id) }, userId },
        data: { parentTaskId: heir.id },
      })
    }
  }

  await prisma.task.deleteMany({ where: { id: { in: doomedIds }, userId } })
  return doomedIds
}

/**
 * The tasks a calendar event stands for. Used when the event goes away, whether
 * it was deleted from inside the app or straight from Google.
 */
export async function deleteTasksForEvents(userId: string, eventIds: string[]): Promise<string[]> {
  if (eventIds.length === 0) return []
  const linked = await prisma.task.findMany({
    where: { userId, calendarEventId: { in: eventIds } },
    select: { id: true },
  })
  return deleteTasksAndRehead(userId, linked.map((t) => t.id))
}
