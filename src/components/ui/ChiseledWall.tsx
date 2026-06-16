import { cn } from '@/lib/utils'

/**
 * 鑿壁偷光 — "chiseling the wall to borrow light." A crack in an ink-wash
 * wall lets a beam of warm light through, illuminating an open scroll.
 * Used as the sign-in page's hero motif: quiet, diligent pursuit of one's work.
 */
export function ChiseledWall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={cn('shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id="wall-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#322a22" />
          <stop offset="100%" stopColor="#1b1612" />
        </linearGradient>
        <radialGradient id="light-beam" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#cba968" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#b08948" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#b08948" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Wall */}
      <rect x="0" y="0" width="200" height="160" fill="url(#wall-grad)" />
      {/* Brick seams */}
      <g stroke="rgba(225,200,150,0.07)" strokeWidth="1">
        <line x1="0" y1="32" x2="200" y2="32" />
        <line x1="0" y1="64" x2="200" y2="64" />
        <line x1="0" y1="96" x2="200" y2="96" />
        <line x1="0" y1="128" x2="200" y2="128" />
        <line x1="50" y1="0" x2="50" y2="32" />
        <line x1="130" y1="32" x2="130" y2="64" />
        <line x1="70" y1="64" x2="70" y2="96" />
        <line x1="150" y1="96" x2="150" y2="128" />
        <line x1="40" y1="128" x2="40" y2="160" />
      </g>

      {/* Light bloom through the crack */}
      <circle cx="100" cy="78" r="46" fill="url(#light-beam)" className="animate-flame" style={{ animationDuration: '5s' }} />

      {/* The crack itself */}
      <path d="M100 60 L96 70 L103 76 L97 84 L101 96" fill="none" stroke="#f3ecdd" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />

      {/* Open scroll catching the light, bottom edge */}
      <rect x="78" y="132" width="44" height="8" rx="2" fill="#e8d9b8" opacity="0.85" />
      <line x1="84" y1="136" x2="116" y2="136" stroke="#8a6a32" strokeWidth="0.75" opacity="0.6" />
    </svg>
  )
}
