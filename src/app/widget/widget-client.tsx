'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

// The board is opened in dumb webviews (Android web widgets, Edge app windows)
// where meta-refresh and SW updates are unreliable — reload from JS instead.
export function AutoReload({ seconds }: { seconds: number }) {
  useEffect(() => {
    const id = setInterval(() => window.location.reload(), seconds * 1000)
    return () => clearInterval(id)
  }, [seconds])
  return null
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (http / old webview) — user can still select the text
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-[var(--ink-light)]">{label}</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white/50 px-3 py-2 font-mono text-xs text-[var(--ink)]"
        />
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--brand)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--brand-light)]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已複製' : '複製'}
        </button>
      </div>
    </div>
  )
}
