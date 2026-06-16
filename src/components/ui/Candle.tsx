import { cn } from '@/lib/utils'

/** 蠟燭 — decorative candle motif used for habit streaks. */
export function Candle({ className, lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg viewBox="0 0 24 32" className={cn('shrink-0', className)} aria-hidden="true">
      {lit && (
        <g className="animate-flame">
          <path d="M12 2 C9.5 6 8.5 8.5 10 11 C10.7 12.2 11.4 12.6 12 13 C12.6 12.6 13.3 12.2 14 11 C15.5 8.5 14.5 6 12 2 Z" fill="#cba968" />
          <path d="M12 5 C10.8 7 10.3 8.5 11.2 10.2 C11.5 10.8 11.8 11.1 12 11.3 C12.2 11.1 12.5 10.8 12.8 10.2 C13.7 8.5 13.2 7 12 5 Z" fill="#ab3326" opacity="0.85" />
        </g>
      )}
      <rect x="9" y="13" width="6" height="16" rx="1.5" fill="#e8d9b8" />
      <rect x="9" y="13" width="6" height="16" rx="1.5" fill="url(#candle-wax)" opacity="0.5" />
      <rect x="10" y="17" width="1" height="11" fill="#cba968" opacity="0.5" />
      <rect x="8" y="28" width="8" height="2" rx="0.5" fill="#b08948" />
      <defs>
        <linearGradient id="candle-wax" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbf7ee" />
          <stop offset="100%" stopColor="#e2d6bc" />
        </linearGradient>
      </defs>
    </svg>
  )
}
