'use client'

import { useId } from 'react'

/**
 * InkLoader — 水墨加載動畫
 * 一滴墨落在圓相最濃處，暈開後沿著筆勢往兩端滲過整個圓，停留片刻後淡去。
 * The enso image (主加載圖示_去背.png) is revealed through an SVG mask whose
 * edge is roughened by turbulence, so the leading edge bleeds like ink into
 * damp paper instead of wiping in a clean line. A blurred, paler copy leads
 * slightly ahead as the wet halo.
 */

const ENSO_SRC = '/logo_v5/主加載圖示_去背.png'

// Enso geometry in a 0–100 box, fitted to the image: centre (49.85, 48.08),
// radius 30.6. The stroke runs from the dry tail at the top (≈292°) round to
// the thin tail on the right (≈316°). The ink lands at its midpoint (≈124°),
// which is also the heaviest part, and spreads both ways to the two tails.
const ORIGIN = { x: 32.74, y: 73.45 }
const ARCS = [
  'M 32.74 73.45 A 30.6 30.6 0 0 1 61.31 19.71',
  'M 32.74 73.45 A 30.6 30.6 0 0 0 71.86 26.82',
]

const SIZES = {
  page: { box: 'w-20 h-20', duration: '2.8s' },
  sm: { box: 'w-11 h-11', duration: '2.4s' },
  xs: { box: 'w-5 h-5', duration: '1.8s' },
} as const

function InkEnso({ size }: { size: keyof typeof SIZES }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const { box, duration } = SIZES[size]
  const bleed = `ink-bleed-${id}`
  const soft = `ink-soft-${id}`
  const core = `ink-core-${id}`
  const halo = `ink-halo-${id}`

  return (
    <svg
      viewBox="0 0 100 100"
      className={`${box} ink-loader`}
      style={{ ['--ink-dur' as string]: duration }}
      aria-hidden="true"
    >
      <defs>
        {/* Ragged, feathered edge: noise displaces the mask, then a slight blur */}
        <filter id={bleed} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="2" />
        </filter>
        <filter id={soft} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>

        <mask id={core} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <g filter={`url(#${bleed})`}>
            <circle className="ink-loader-drop" cx={ORIGIN.x} cy={ORIGIN.y} r="13" fill="#fff" />
            {ARCS.map((d) => (
              <path key={d} className="ink-loader-trail" d={d} pathLength={100} fill="none" stroke="#fff" strokeWidth="34" />
            ))}
          </g>
        </mask>
        <mask id={halo} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <g filter={`url(#${bleed})`}>
            <circle className="ink-loader-drop-halo" cx={ORIGIN.x} cy={ORIGIN.y} r="15" fill="#fff" />
            {ARCS.map((d) => (
              <path key={d} className="ink-loader-trail-halo" d={d} pathLength={100} fill="none" stroke="#fff" strokeWidth="36" />
            ))}
          </g>
        </mask>
      </defs>

      <g className="ink-loader-body">
        <g mask={`url(#${halo})`} opacity="0.28">
          <image href={ENSO_SRC} width="100" height="100" filter={`url(#${soft})`} />
        </g>
        <g mask={`url(#${core})`}>
          <image href={ENSO_SRC} width="100" height="100" />
        </g>
      </g>
    </svg>
  )
}

export function InkLoader({ size = 'page' }: { size?: 'page' | 'sm' | 'xs' }) {
  if (size === 'page') {
    return (
      <div className="flex h-full w-full min-h-[200px] items-center justify-center bg-[#fbeacb]">
        <InkEnso size="page" />
      </div>
    )
  }

  if (size === 'sm') {
    return (
      <div className="flex items-center justify-center py-8">
        <InkEnso size="sm" />
      </div>
    )
  }

  return (
    <span className="inline-flex items-center justify-center w-5 h-5" aria-hidden="true">
      <InkEnso size="xs" />
    </span>
  )
}
