import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { parseRoutinePatterns } from '@/lib/routine'
import { isDemoUser } from '@/lib/demo-data'

const patternsSchema = z.array(z.string().trim().min(1).max(200)).max(200)

/**
 * Reminder keywords (birthdays…). `{ patterns: null }` means the account never
 * saved a list: the page then uploads the one it kept in the browser, so
 * nobody loses what they set up before the list moved to the database.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The demo account has no row in the database: null tells the page to keep
  // the list it already holds.
  if (isDemoUser(session.user.id)) return NextResponse.json(null)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { reminderPatterns: true },
  })

  const raw = user?.reminderPatterns
  return NextResponse.json({ patterns: raw == null ? null : parseRoutinePatterns(raw) })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = patternsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const patterns = [...new Set(parsed.data)]
  if (isDemoUser(session.user.id)) return NextResponse.json({ patterns })

  await prisma.user.update({
    where: { id: session.user.id },
    data: { reminderPatterns: JSON.stringify(patterns) },
  })

  return NextResponse.json({ patterns })
}
