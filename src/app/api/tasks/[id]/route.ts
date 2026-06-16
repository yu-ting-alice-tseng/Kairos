import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePriority } from '@/lib/utils'

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

  return NextResponse.json(task)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const existing = await prisma.task.findUnique({ where: { id, userId: session.user.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
