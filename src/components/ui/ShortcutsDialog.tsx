'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/stores/useAppStore'

export type Shortcut = { keys: string[]; zh: string; fr: string; en: string }

/** "G then a letter" jumps between pages from anywhere in the app. */
const NAV_SHORTCUTS: (Shortcut & { href: string })[] = [
  { keys: ['G', 'T'], href: '/today', zh: '前往今天', fr: "Aller à Aujourd'hui", en: 'Go to Today' },
  { keys: ['G', 'M'], href: '/matrix', zh: '前往矩陣', fr: 'Aller à la matrice', en: 'Go to Matrix' },
  { keys: ['G', 'C'], href: '/calendar', zh: '前往日曆', fr: 'Aller au calendrier', en: 'Go to Calendar' },
  { keys: ['G', 'H'], href: '/habits', zh: '前往習慣', fr: 'Aller aux habitudes', en: 'Go to Habits' },
  { keys: ['G', 'R'], href: '/retroplanning', zh: '前往逆向規劃', fr: 'Aller au rétroplanning', en: 'Go to Retroplanning' },
  { keys: ['G', 'V'], href: '/review', zh: '前往回顧', fr: 'Aller au bilan', en: 'Go to Review' },
  { keys: ['G', 'S'], href: '/settings', zh: '前往設定', fr: 'Aller aux paramètres', en: 'Go to Settings' },
]
const HELP_SHORTCUT: Shortcut = { keys: ['?'], zh: '顯示快捷鍵清單', fr: 'Afficher les raccourcis', en: 'Show shortcuts' }
const G_PREFIX_MS = 1500

// Shared between the page hook and the global listener; module state is fine
// because there is one keyboard and one page at a time.
let gPressedAt = 0
let pageShortcuts: Shortcut[] = []
const OPEN_HELP_EVENT = 'kairos:shortcuts-help'

/** Open the shortcuts list (for header buttons). */
export function openShortcutsHelp() {
  window.dispatchEvent(new Event(OPEN_HELP_EVENT))
}

/** True when a key press is meant for a text field, not a page shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** True when single-key page shortcuts should stay out of the way. */
export function shortcutsBlocked(e: KeyboardEvent): boolean {
  return (
    e.defaultPrevented ||
    isTypingTarget(e.target) ||
    e.altKey ||
    // The key after G belongs to page navigation.
    Date.now() - gPressedAt < G_PREFIX_MS ||
    // An open dialog (this help, a form, settings, …) owns the keyboard.
    !!document.querySelector('[role="dialog"]')
  )
}

/**
 * Page-level single-key shortcuts. `shortcuts` is what the `?` list shows for
 * this page; `onKey` gets the lower-cased key and returns true when it acted.
 * Ctrl/Cmd combinations are left to the page (and the browser).
 */
export function usePageShortcuts(shortcuts: Shortcut[], onKey: (key: string, e: KeyboardEvent) => boolean | void) {
  const onKeyRef = React.useRef(onKey)
  React.useEffect(() => { onKeyRef.current = onKey })
  React.useEffect(() => {
    pageShortcuts = shortcuts
    return () => { if (pageShortcuts === shortcuts) pageShortcuts = [] }
  }, [shortcuts])
  React.useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || shortcutsBlocked(e)) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (onKeyRef.current(key, e)) e.preventDefault()
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}

/** Mounted once in the dashboard layout: G-navigation and the `?` list. */
export function GlobalShortcuts() {
  const router = useRouter()
  const { language } = useAppStore()
  const [open, setOpen] = React.useState(false)
  const [listed, setListed] = React.useState<Shortcut[]>([])

  React.useEffect(() => {
    const show = () => { setListed(pageShortcuts); setOpen(true) }
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      if (document.querySelector('[role="dialog"]')) return
      const key = e.key.toLowerCase()
      if (Date.now() - gPressedAt < G_PREFIX_MS) {
        gPressedAt = 0
        const nav = NAV_SHORTCUTS.find((s) => s.keys[1].toLowerCase() === key)
        if (nav) { e.preventDefault(); router.push(nav.href) }
        return
      }
      if (key === 'g') { gPressedAt = Date.now(); return }
      if (e.key === '?') { e.preventDefault(); show() }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_HELP_EVENT, show)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_HELP_EVENT, show)
    }
  }, [router])

  const lang = language
  const section = (title: string, items: Shortcut[]) => (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a99873]">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((sc) => (
          <li key={sc.en} className="flex items-center justify-between gap-3 text-sm text-[#3a3326]">
            <span>{sc[lang]}</span>
            <span className="flex items-center gap-1 shrink-0">
              {sc.keys.map((k, i) => (
                <React.Fragment key={k}>
                  {i > 0 && (
                    <span className="text-[10px] text-[#a99873]">
                      {sc.keys[0] === 'Ctrl' ? '+' : sc.keys[0] === 'G' ? (lang === 'zh' ? '再按' : lang === 'fr' ? 'puis' : 'then') : '/'}
                    </span>
                  )}
                  <kbd className="rounded-md border border-[#e2d6bc] bg-[#f3ecdd] px-1.5 py-0.5 text-[11px] font-mono text-[#5c5347]">{k}</kbd>
                </React.Fragment>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lang === 'fr' ? 'Raccourcis clavier' : lang === 'zh' ? '鍵盤快捷鍵' : 'Keyboard shortcuts'}</DialogTitle>
        </DialogHeader>
        {listed.length > 0 && section(lang === 'fr' ? 'Cette page' : lang === 'zh' ? '這個頁面' : 'This page', listed)}
        {section(lang === 'fr' ? 'Navigation' : lang === 'zh' ? '切換頁面' : 'Navigation', [...NAV_SHORTCUTS, HELP_SHORTCUT])}
        <p className="text-[11px] text-[#a99873]">
          {lang === 'fr'
            ? 'Inactifs pendant la saisie. Sur Mac, Cmd remplace Ctrl.'
            : lang === 'zh'
            ? '打字時不會觸發。Mac 上用 Cmd 取代 Ctrl。'
            : 'Off while typing. On Mac, use Cmd instead of Ctrl.'}
        </p>
      </DialogContent>
    </Dialog>
  )
}
