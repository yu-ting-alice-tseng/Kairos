import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const VALID_TYPES = ['SHORT_TERM', 'LONG_TERM', 'LIFE'] as const
const goalPostSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.enum(VALID_TYPES).optional(),
})
const goalPatchSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
})
const goalDeleteSchema = z.object({ id: z.string().min(1) })

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    orderBy: [{ type: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(goals)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = goalPostSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const goal = await prisma.goal.create({
    data: { userId: session.user.id, text: parsed.data.text, type: parsed.data.type ?? 'LONG_TERM' },
  })
  return NextResponse.json(goal, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = goalPatchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const goal = await prisma.goal.update({
    where: { id: parsed.data.id, userId: session.user.id },
    data: { text: parsed.data.text },
  })
  return NextResponse.json(goal)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = goalDeleteSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  await prisma.goal.delete({ where: { id: parsed.data.id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
