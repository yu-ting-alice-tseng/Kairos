import { prisma } from '@/lib/prisma'

/**
 * Deletes tasks together with everything hanging off them.
 *
 * A retro chain is a parent task plus its stages as sub-tasks, so removing only
 * the parent leaves the stages behind as orphans — planning steps for a
 * deadline that no longer exists. Cascades downwards only: deleting one stage
 * never takes its parent, or its siblings, with it.
 *
 * Returns every id that was removed.
 */
export async function deleteTasksWithChains(userId: string, rootIds: string[]): Promise<string[]> {
  if (rootIds.length === 0) return []

  const doomed = new Set(rootIds)
  let frontier = rootIds
  // Chains are shallow in practice, but walk the whole depth rather than assume
  // one level — a stage can itself have been given sub-tasks.
  while (frontier.length > 0) {
    const children = await prisma.task.findMany({
      where: { userId, parentTaskId: { in: frontier } },
      select: { id: true },
    })
    frontier = children.map((c) => c.id).filter((id) => !doomed.has(id))
    for (const id of frontier) doomed.add(id)
  }

  const ids = [...doomed]
  // Clear the parent links before deleting, so no row is removed while another
  // still references it. Anything pointing at a doomed task is itself doomed,
  // so this touches nothing that survives.
  await prisma.task.updateMany({ where: { id: { in: ids }, userId }, data: { parentTaskId: null } })
  await prisma.task.deleteMany({ where: { id: { in: ids }, userId } })
  return ids
}

/**
 * The tasks a calendar event stands for: the one linked to it, plus its chain.
 * Used when the event itself goes away, whether deleted from inside the app or
 * straight from Google.
 */
export async function deleteTasksForEvents(userId: string, eventIds: string[]): Promise<string[]> {
  if (eventIds.length === 0) return []
  const linked = await prisma.task.findMany({
    where: { userId, calendarEventId: { in: eventIds } },
    select: { id: true },
  })
  return deleteTasksWithChains(userId, linked.map((t) => t.id))
}
