import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { keywordRules: true },
  })

  const rules = JSON.parse(user?.keywordRules ?? '[]')
  return NextResponse.json(rules)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rules = await request.json()
  await prisma.user.update({
    where: { id: session.user.id },
    data: { keywordRules: JSON.stringify(rules) },
  })

  return NextResponse.json(rules)
}
