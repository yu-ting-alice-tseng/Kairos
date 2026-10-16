'use client'

import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type Shortcut = { keys: string[]; zh: string; fr: string; en: string }

/** True when a key press is meant for a text field, not a page shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** True when single-key page shortcuts should stay out of the way. */
export function shortcutsBlocked(e: KeyboardEvent): boolean {
  // An open dialog (this help, a form, settings, …) owns the keyboard.
  return isTypingTarget(e.target) || e.altKey || !!document.querySelector('[role="dialog"]')
}

export function ShortcutsDialog({ open, lang, shortcuts, onClose }: {
  open: boolean
  lang: 'fr' | 'en' | 'zh'
  shortcuts: Shortcut[]
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{lang === 'fr' ? 'Raccourcis clavier' : lang === 'zh' ? '鍵盤快捷鍵' : 'Keyboard shortcuts'}</DialogTitle>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5">
          {shortcuts.map((sc) => (
            <li key={sc.en} className="flex items-center justify-between gap-3 text-sm text-[#3a3326]">
              <span>{sc[lang]}</span>
              <span className="flex items-center gap-1 shrink-0">
                {sc.keys.map((k, i) => (
                  <React.Fragment key={k}>
                    {i > 0 && <span className="text-[10px] text-[#a99873]">{sc.keys[0] === 'Ctrl' ? '+' : '/'}</span>}
                    <kbd className="rounded-md border border-[#e2d6bc] bg-[#f3ecdd] px-1.5 py-0.5 text-[11px] font-mono text-[#5c5347]">{k}</kbd>
                  </React.Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
        {shortcuts.some((sc) => sc.keys[0] === 'Ctrl') && (
          <p className="text-[11px] text-[#a99873]">
            {lang === 'fr' ? 'Sur Mac, Cmd remplace Ctrl.' : lang === 'zh' ? 'Mac 上用 Cmd 取代 Ctrl。' : 'On Mac, use Cmd instead of Ctrl.'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
