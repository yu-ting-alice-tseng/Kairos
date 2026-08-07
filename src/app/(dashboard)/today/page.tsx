import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { loadUserTasks, loadUserHabits, serialize } from '@/lib/queries'
import { InkLoader } from '@/components/ui/InkLoader'
import { Task, Habit } from '@/types'
import TodayClient from './today-client'

// Per-user data that changes on every write — nothing here is cacheable.
export const dynamic = 'force-dynamic'

/**
 * Reads the list on the server so it arrives with the HTML. The page used to
 * render an empty shell, download and hydrate the bundle, and only then fetch
 * /api/tasks and /api/habits — the whole list waited on a round trip that could
 * not even start until the JavaScript had run.
 */
async function TodayData() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return <TodayClient initialTasks={[]} initialHabits={[]} />

  const [tasks, habits] = await Promise.all([loadUserTasks(userId), loadUserHabits(userId)])
  return (
    <TodayClient
      initialTasks={serialize<Task[]>(tasks)}
      initialHabits={serialize<Habit[]>(habits)}
    />
  )
}

export default function TodayPage() {
  // Streams the shell straight away and swaps in the list when the queries
  // land, so a slow database delays the content and not the whole page.
  return (
    <Suspense fallback={<InkLoader size="page" />}>
      <TodayData />
    </Suspense>
  )
}
