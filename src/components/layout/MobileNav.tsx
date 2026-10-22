'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/stores/useAppStore'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Zap, LayoutGrid, Calendar, Repeat2, GitBranch, BarChart3,
  MoreHorizontal, Settings, Info, Globe, HelpCircle, LogOut, X,
} from 'lucide-react'

type Lang = 'fr' | 'en' | 'zh'

// Bottom-bar labels: the full menu names do not fit six to a phone screen.
const SHORT: Record<Lang, Record<string, string>> = {
  fr: { today: 'To-do', matrix: 'Matrice', calendar: 'Calendrier', habits: 'Habitudes', retroplanning: 'Rétro', more: 'Plus' },
  en: { today: 'To-do', matrix: 'Matrix', calendar: 'Calendar', habits: 'Habits', retroplanning: 'Retro', more: 'More' },
  zh: { today: '待辦', matrix: '矩陣', calendar: '日曆', habits: '習慣', retroplanning: '逆向', more: '更多' },
}

const LANG_NAME: Record<Lang, string> = { fr: 'Français', en: 'English', zh: '繁體中文' }

// The tour's nav-* targets live here too, so it can spotlight them on phones.
const barItems = [
  { href: '/today',         icon: Zap,        key: 'today' },
  { href: '/matrix',        icon: LayoutGrid, key: 'matrix' },
  { href: '/calendar',      icon: Calendar,   key: 'calendar' },
  { href: '/habits',        icon: Repeat2,    key: 'habits' },
  { href: '/retroplanning', icon: GitBranch,  key: 'retroplanning' },
] as const

/** Bottom navigation shown below the md breakpoint, where the sidebar is hidden. */
export function MobileNav() {
  const pathname = usePathname()
  const { language, setLanguage, setOnboardingOpen } = useAppStore()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const lang = language as Lang

  const isActive = (href: string) => pathname === href || (href !== '/today' && pathname.startsWith(href))
  const moreActive = ['/review', '/settings', '/about'].some(isActive)

  const sheetLink = 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#d9c79f] hover:bg-[#fbf7ee]/[0.06] text-left w-full'

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-[#2a1d10] border-t border-[rgba(168,127,62,0.25)] p-2 pb-[calc(72px+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#8a6b3e]">{SHORT[lang].more}</span>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 text-[#8a7a5e]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Link href="/review" onClick={() => setMoreOpen(false)} className={sheetLink}>
              <BarChart3 className="h-4 w-4 shrink-0" />{t('review', language)}
            </Link>
            <Link href="/settings" onClick={() => setMoreOpen(false)} className={sheetLink}>
              <Settings className="h-4 w-4 shrink-0" />{t('settings', language)}
            </Link>
            <Link href="/about" onClick={() => setMoreOpen(false)} className={sheetLink}>
              <Info className="h-4 w-4 shrink-0" />
              {language === 'fr' ? 'À propos de Kairos' : language === 'zh' ? '關於 Kairos' : 'About Kairos'}
            </Link>
            <button onClick={() => { setMoreOpen(false); setOnboardingOpen(true) }} className={sheetLink}>
              <HelpCircle className="h-4 w-4 shrink-0" />
              {language === 'fr' ? 'Guide de découverte' : language === 'zh' ? '使用教學' : 'Take the tour'}
            </button>
            <div className="flex items-center gap-3 px-4 py-3 text-sm text-[#d9c79f]">
              <Globe className="h-4 w-4 shrink-0" />
              <div className="flex gap-1.5">
                {(['fr', 'en', 'zh'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs border',
                      l === language ? 'border-[#a87f3e] bg-[#a87f3e]/[0.2] text-[#ffd27a]' : 'border-[rgba(168,127,62,0.25)] text-[#a87f3e]'
                    )}
                  >
                    {LANG_NAME[l]}
                  </button>
                ))}
              </div>
            </div>
            <Link href="/auth/signout" onClick={() => setMoreOpen(false)} className={cn(sheetLink, 'text-[#f47c6a]')}>
              <LogOut className="h-4 w-4 shrink-0" />{t('signOut', language)}
            </Link>
          </div>
        </div>
      )}

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#2a1d10] border-t border-[rgba(168,127,62,0.2)] pb-[env(safe-area-inset-bottom)]"
      >
        {barItems.map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            data-tour={`nav-${key}`}
            onClick={() => setMoreOpen(false)}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 h-16 text-[10px] font-medium',
              isActive(href) ? 'text-[#ffd27a]' : 'text-[#a87f3e]'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate max-w-full px-0.5">{SHORT[lang][key]}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={cn(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 h-16 text-[10px] font-medium',
            moreOpen || moreActive ? 'text-[#ffd27a]' : 'text-[#a87f3e]'
          )}
        >
          <MoreHorizontal className="h-5 w-5 shrink-0" />
          <span>{SHORT[lang].more}</span>
        </button>
      </nav>
    </>
  )
}
