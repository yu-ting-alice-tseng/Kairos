import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// The page names the field `urgence` and gives every rule an `id`. The schema
// used to list only `urgency`, so zod stripped both on save and rules came
// back from the database with no urgency and no id. Both spellings are read
// now, and rows saved before the fix are filled in on the way out.
const DEFAULT_LEVEL = 5

const level = z.number().int().min(1).max(10)
const keywordRuleSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  keyword: z.string().trim().min(1).max(200),
  importance: level.optional(),
  urgence: level.optional(),
  urgency: level.optional(),
  tag: z.string().max(100).optional(),
})
const rulesSchema = z.array(keywordRuleSchema).max(200)

interface StoredRule {
  id: string
  keyword: string
  importance: number
  urgence: number
  tag?: string
}

function normalize(rules: z.infer<typeof rulesSchema>): StoredRule[] {
  const seen = new Set<string>()
  return rules.map((r, i) => {
    // Rules saved before the fix have no id: derive a stable one so the page
    // can still remove them.
    let id = r.id ?? `rule-${i}-${r.keyword}`
    while (seen.has(id)) id = `${id}-${i}`
    seen.add(id)
    return {
      id,
      keyword: r.keyword,
      importance: r.importance ?? DEFAULT_LEVEL,
      urgence: r.urgence ?? r.urgency ?? DEFAULT_LEVEL,
      ...(r.tag ? { tag: r.tag } : {}),
    }
  })
}

function parseStored(raw: string | null | undefined): StoredRule[] {
  try {
    const value = JSON.parse(raw ?? '[]')
    if (!Array.isArray(value)) return []
    // Drop single malformed rows instead of losing the whole list.
    const valid = value.flatMap((row) => {
      const parsed = keywordRuleSchema.safeParse(row)
      return parsed.success ? [parsed.data] : []
    })
    return normalize(valid)
  } catch {
    return []
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { keywordRules: true },
  })

  return NextResponse.json(parseStored(user?.keywordRules))
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = rulesSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const rules = normalize(parsed.data)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { keywordRules: JSON.stringify(rules) },
  })

  return NextResponse.json(rules)
}
