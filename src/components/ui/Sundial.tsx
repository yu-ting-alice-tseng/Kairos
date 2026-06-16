import { cn } from '@/lib/utils'

/** 日晷 — decorative sundial motif used in page headers. */
export function Sundial({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden="true">
      <circle cx="32" cy="40" r="20" fill="none" stroke="#b08948" strokeWidth="1.5" opacity="0.55" />
      <circle cx="32" cy="40" r="20" fill="none" stroke="#b08948" strokeWidth="0.75" strokeDasharray="1.5 5" opacity="0.4" />
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
        const x1 = 32 + Math.cos(angle) * 17
        const y1 = 40 + Math.sin(angle) * 17
        const x2 = 32 + Math.cos(angle) * 20
        const y2 = 40 + Math.sin(angle) * 20
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b08948" strokeWidth="1" opacity="0.5" />
      })}
      <g className="animate-sundial">
        <path d="M32 40 L32 14 L36 24 L32 14 L28 24 Z" fill="#ab3326" opacity="0.85" />
      </g>
      <circle cx="32" cy="40" r="2.5" fill="#861f17" />
    </svg>
  )
}
