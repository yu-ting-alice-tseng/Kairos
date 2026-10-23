import TodayFallback from './today-fallback'

// A route-level boundary so Next prefetches the shell up to here: clicking
// Today then paints at once (from this session's data when it has it)
// instead of waiting for the server round trip.
export default function Loading() {
  return <TodayFallback />
}
