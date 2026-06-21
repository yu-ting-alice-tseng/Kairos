import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const title = url.searchParams.get('title') ?? 'Booked'

  const result = await prisma.task.deleteMany({
    where: { userId: session.user.id, title },
  })

  return NextResponse.json({ deleted: result.count })
}
