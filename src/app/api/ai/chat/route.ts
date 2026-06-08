import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { askForTaskDetails } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, history, lang } = await req.json()

  try {
    const response = await askForTaskDetails(message, history ?? [], lang ?? 'fr')
    return NextResponse.json({ response })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'AI error' }, { status: 500 })
  }
}
