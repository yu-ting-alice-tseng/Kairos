import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider, name, color, accessToken, refreshToken, calendarId } = await req.json()

  const account = await prisma.calendarAccount.create({
    data: {
      userId: session.user.id,
      provider,
      name,
      color: color ?? '#4F46E5',
      accessToken,
      refreshToken,
      calendarId,
    },
  })

  return NextResponse.json(account, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  await prisma.calendarAccount.update({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  })

  return NextResponse.json({ success: true })
}
