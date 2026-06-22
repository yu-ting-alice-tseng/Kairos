/**
 * InkLoader — 水墨加載動畫
 * Layers: 水墨暈染 (pulse bg) + 主加載圖示 (spinning enso) + 時鐘指針 (static clock)
 */
export function InkLoader({ size = 'page' }: { size?: 'page' | 'sm' | 'xs' }) {
  if (size === 'page') {
    return (
      <div className="flex h-full w-full min-h-[200px] items-center justify-center bg-[#fbeacb]">
        <div className="relative flex items-center justify-center w-28 h-28">
          {/* ink wash bloom — ambient pulse */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/水墨暈染加載.png"
            alt=""
            className="absolute w-28 h-28 object-contain opacity-25 animate-pulse"
          />
          {/* spinning enso circle */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/主加載圖示.png"
            alt=""
            className="w-24 h-24 object-contain ink-loader-enso-img"
          />
          {/* static clock face centered inside enso */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/時鐘指針加載.png"
            alt=""
            className="absolute w-[4.5rem] h-[4.5rem] object-contain opacity-90"
          />
        </div>
      </div>
    )
  }

  if (size === 'sm') {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="relative flex items-center justify-center w-12 h-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/主加載圖示.png"
            alt=""
            className="w-12 h-12 object-contain ink-loader-enso-img"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/時鐘指針加載.png"
            alt=""
            className="absolute w-9 h-9 object-contain opacity-90"
          />
        </div>
      </div>
    )
  }

  // xs — inline spinner only
  return (
    <span className="relative inline-flex items-center justify-center w-5 h-5" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo_v5/主加載圖示.png"
        alt=""
        className="w-5 h-5 object-contain ink-loader-enso-img"
      />
    </span>
  )
}
