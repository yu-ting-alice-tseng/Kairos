import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const keywordRuleSchema = z.object({
  keyword: z.string().min(1).max(200),
  importance: z.number().int().min(1).max(10).optional(),
  urgency: z.number().int().min(1).max(10).optional(),
  tag: z.string().max(100).optional(),
})
const rulesSchema = z.array(keywordRuleSchema).max(200)

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

  const parsed = rulesSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { keywordRules: JSON.stringify(parsed.data) },
  })

  return NextResponse.json(parsed.data)
}
