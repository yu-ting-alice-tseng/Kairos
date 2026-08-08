import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { loadMonthlyStats } from '@/lib/stats'
import { serialize } from '@/lib/queries'
import { isDemoUser } from '@/lib/demo-data'
import { InkLoader } from '@/components/ui/InkLoader'
import type { MonthlyStats } from '@/types'
import ReviewClient, { type FilterAccount } from './review-client'

export const dynamic = 'force-dynamic'

/** The filter's own data: accounts and their sub-calendars, names and colours only. */
async function loadFilterAccounts(userId: string): Promise<FilterAccount[]> {
  if (isDemoUser(userId)) return []
  const accounts = await prisma.calendarAccount.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, name: true, color: true,
      subCalendars: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { externalId: true, name: true, color: true },
      },
    },
  })
  return accounts
}

async function ReviewData() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return <ReviewClient initialStats={null} accounts={[]} />

  const [stats, accounts] = await Promise.all([
    loadMonthlyStats(userId, { months: 12 }),
    loadFilterAccounts(userId),
  ])
  return <ReviewClient initialStats={serialize<MonthlyStats>(stats)} accounts={serialize<FilterAccount[]>(accounts)} />
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<InkLoader size="page" />}>
      <ReviewData />
    </Suspense>
  )
}
