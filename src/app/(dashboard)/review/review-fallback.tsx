'use client'

import { useAppStore } from '@/stores/useAppStore'
import { InkLoader } from '@/components/ui/InkLoader'
import ReviewClient from './review-client'

/**
 * Shown while the server reads the month. When this session has already seen
 * the current month, those figures show at once and the server's fresh copy
 * replaces them when it lands; only a first visit waits behind the loader.
 */
export default function ReviewFallback() {
  const { reviewCache, reviewAccounts } = useAppStore()
  const now = new Date()
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}||`
  const cached = reviewCache[key]
  if (!cached || !reviewAccounts) return <InkLoader size="page" />
  return <ReviewClient initialStats={cached} accounts={reviewAccounts} />
}
