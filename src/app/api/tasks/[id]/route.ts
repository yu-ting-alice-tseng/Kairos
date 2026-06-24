import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePriority } from '@/lib/utils'
import { updateGoogleEvent } from '@/lib/calendar/google'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const existing = await prisma.task.findUnique({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const importance = body.importance ?? existing.importance
  const urgency = body.urgency ?? existing.urgency
  const priority = calculatePriority(importance, urgency)

  // Build update explicitly — avoid spreading unknown body fields into Prisma
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { importance, urgency, priority }
  const strFields = ['title', 'description', 'notes', 'tags', 'status', 'calendarAccountId', 'calendarEventId', 'parentTaskId']
  const numFields = ['estimatedMinutes', 'actualMinutes']
  const boolFields = ['isRecurring', 'aiSuggested']
  for (const f of strFields) if (f in body) updateData[f] = body[f] ?? null
  for (const f of numFields) if (f in body) updateData[f] = body[f] ?? null
  for (const f of boolFields) if (f in body) updateData[f] = body[f]
  if ('deadline' in body) updateData.deadline = body.deadline ? new Date(body.deadline) : null
  if ('scheduledStart' in body) updateData.scheduledStart = body.scheduledStart ? new Date(body.scheduledStart) : null
  if ('scheduledEnd' in body) updateData.scheduledEnd = body.scheduledEnd ? new Date(body.scheduledEnd) : null
  if (body.status === 'COMPLETED') updateData.completedAt = new Date()
  else if (body.status === 'PENDING') updateData.completedAt = null

  const task = await prisma.task.update({
    where: { id },
    data: updateData,
    include: { subTasks: true, calendarAccount: true },
  })

  // If scheduledStart/End changed and task is linked to a Google Calendar event, sync back
  const scheduleChanged = 'scheduledStart' in body || 'scheduledEnd' in body
  if (scheduleChanged && existing.calendarEventId && existing.calendarAccountId) {
    try {
      const account = await prisma.calendarAccount.findUnique({ where: { id: existing.calendarAccountId } })
      if (account?.accessToken && account.provider === 'GOOGLE') {
        const newStart = task.scheduledStart ?? existing.scheduledStart
        const newEnd = task.scheduledEnd ?? existing.scheduledEnd
        if (newStart && newEnd) {
          await updateGoogleEvent(
            account.id, account.accessToken,
            'primary', existing.calendarEventId,
            { start: new Date(String(newStart)), end: new Date(String(newEnd)) },
            account.refreshToken, account.expiresAt
          )
        }
      }
    } catch (err) {
      console.error('[task PATCH] Google Calendar sync failed:', err)
      // Non-fatal — task was already updated locally
    }
  }

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.task.findUnique({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Unlink any children that point to this task as parent (detach from chain)
  await prisma.task.updateMany({
    where: { parentTaskId: id, userId: session.user.id },
    data: { parentTaskId: null },
  })

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
