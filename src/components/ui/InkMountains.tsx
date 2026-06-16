import { cn } from '@/lib/utils'

/**
 * 遠山 — layered ink-wash mountain silhouette.
 * Decorative, non-interactive background motif (low-opacity by default).
 */
export function InkMountains({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 260"
      preserveAspectRatio="none"
      className={cn('w-full h-auto', className)}
      aria-hidden="true"
    >
      <path d="M0 220 Q80 140 160 190 T320 160 Q400 110 480 175 T640 150 Q740 90 820 170 T1000 155 Q1080 120 1200 180 V260 H0 Z"
        fill="#2a2420" opacity="0.05" />
      <path d="M0 240 Q120 170 240 215 T520 190 Q620 145 720 205 T960 195 Q1080 165 1200 215 V260 H0 Z"
        fill="#2a2420" opacity="0.08" />
      <path d="M0 260 Q150 200 300 235 T620 225 Q760 190 900 230 T1200 235 V260 H0 Z"
        fill="#2a2420" opacity="0.12" />
    </svg>
  )
}
