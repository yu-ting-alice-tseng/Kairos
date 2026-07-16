import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { askForTaskDetails } from '@/lib/ai'
import { z } from 'zod'

const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  history: z.array(z.object({ role: z.string(), content: z.string().max(10000) })).max(100).optional(),
  lang: z.string().max(10).optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = chatSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { message, history, lang } = parsed.data

  try {
    const response = await askForTaskDetails(message, (history ?? []) as { role: 'user' | 'assistant'; content: string }[], (lang ?? 'fr') as 'fr' | 'en' | 'zh')
    return NextResponse.json({ response })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}
