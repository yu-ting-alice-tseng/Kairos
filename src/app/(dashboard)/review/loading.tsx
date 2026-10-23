import { InkLoader } from '@/components/ui/InkLoader'

// Lets Next prefetch up to here, so the page answers a click at once while the
// month's figures are read.
export default function Loading() {
  return <InkLoader size="page" />
}
