'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { InkLoader } from '@/components/ui/InkLoader'
import TodayClient from './today-client'

/**
 * Shown while the server reads the list. When this session already holds the
 * tasks and habits (any page visited before), the list renders from them at
 * once and the server's copy replaces it when it lands; only a first visit
 * still waits behind the loader.
 */
export default function TodayFallback() {
  const { tasks, habits, tasksLoaded, habitsLoaded, markNavigationStart } = useAppStore()
  useEffect(() => { markNavigationStart() }, [markNavigationStart])
  if (!tasksLoaded || !habitsLoaded) return <InkLoader size="page" />
  return <TodayClient initialTasks={tasks} initialHabits={habits} />
}
