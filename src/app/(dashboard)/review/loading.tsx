import ReviewFallback from './review-fallback'

// Lets Next prefetch up to here, so the page answers a click at once: with the
// figures this session already has, or a loader on a first visit.
export default function Loading() {
  return <ReviewFallback />
}
