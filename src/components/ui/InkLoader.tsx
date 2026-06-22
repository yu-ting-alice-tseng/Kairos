/**
 * InkLoader — 水墨加載動畫
 * Uses loading.png sprite (4 quadrants: enso / clock / dots / blob).
 * size="page"  → full-screen parchment bg with enso spinner + dots
 * size="sm"    → centered spinner for panels
 * size="xs"    → tiny inline spinner replacing Loader2
 */
export function InkLoader({ size = 'page' }: { size?: 'page' | 'sm' | 'xs' }) {
  if (size === 'page') {
    return (
      <div className="flex h-full w-full min-h-[200px] items-center justify-center bg-[#fbeacb]">
        <div className="flex flex-col items-center gap-5">
          <div className="ink-loader-enso" />
          <div className="ink-loader-dots" />
        </div>
      </div>
    )
  }
  if (size === 'sm') {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="ink-loader-enso-sm" />
      </div>
    )
  }
  return <span className="ink-loader-xs" aria-hidden="true" />
}
