/**
 * InkLoader — 水墨加載動畫
 * Uses 主加載圖示.png (transparent enso) with CSS rotation.
 */
export function InkLoader({ size = 'page' }: { size?: 'page' | 'sm' | 'xs' }) {
  if (size === 'page') {
    return (
      <div className="flex h-full w-full min-h-[200px] items-center justify-center bg-[#fbeacb]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_v5/主加載圖示_去背.png"
          alt=""
          className="w-20 h-20 object-contain ink-loader-enso-img"
        />
      </div>
    )
  }

  if (size === 'sm') {
    return (
      <div className="flex items-center justify-center py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_v5/主加載圖示_去背.png"
          alt=""
          className="w-11 h-11 object-contain ink-loader-enso-img"
        />
      </div>
    )
  }

  return (
    <span className="inline-flex items-center justify-center w-5 h-5" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo_v5/主加載圖示_去背.png"
        alt=""
        className="w-5 h-5 object-contain ink-loader-enso-img"
      />
    </span>
  )
}
