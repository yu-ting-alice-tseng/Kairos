import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseTemplate(raw: { id: string; userId: string; name: string; calendarAccountId: string | null; keywords: string; stages: string; createdAt: Date; updatedAt: Date }) {
  return {
    ...raw,
    keywords: JSON.parse(raw.keywords || '[]') as string[],
    stages: JSON.parse(raw.stages || '[]') as { name: string; daysBeforeDeadline: number }[],
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const templates = await prisma.retroTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(templates.map(parseTemplate))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, calendarAccountId, keywords, stages } = await req.json()
  const template = await prisma.retroTemplate.create({
    data: {
      userId: session.user.id,
      name,
      calendarAccountId: calendarAccountId || null,
      keywords: JSON.stringify(keywords ?? []),
      stages: JSON.stringify(stages ?? []),
    },
  })
  return NextResponse.json(parseTemplate(template), { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, calendarAccountId, keywords, stages } = await req.json()
  const template = await prisma.retroTemplate.update({
    where: { id, userId: session.user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(calendarAccountId !== undefined ? { calendarAccountId: calendarAccountId || null } : {}),
      ...(keywords !== undefined ? { keywords: JSON.stringify(keywords) } : {}),
      ...(stages !== undefined ? { stages: JSON.stringify(stages) } : {}),
    },
  })
  return NextResponse.json(parseTemplate(template))
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.retroTemplate.delete({ where: { id, userId: session.user.id } })
  return NextResponse.json({ success: true })
}
