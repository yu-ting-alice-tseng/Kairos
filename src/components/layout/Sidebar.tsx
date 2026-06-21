'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/stores/useAppStore'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Zap, LayoutGrid, Calendar, Repeat2, Settings, LogOut,
  ChevronLeft, ChevronRight, Globe, GitBranch, Info,
} from 'lucide-react'

const LANG_LABEL: Record<'fr' | 'en' | 'zh', string> = { fr: 'EN', en: '中', zh: 'FR' }

const navItems = [
  { href: '/today',          icon: Zap,        key: 'today'        as const },
  { href: '/matrix',         icon: LayoutGrid, key: 'matrix'       as const },
  { href: '/calendar',       icon: Calendar,   key: 'calendar'     as const },
  { href: '/habits',         icon: Repeat2,    key: 'habits'       as const },
  { href: '/retroplanning',  icon: GitBranch,  key: 'retroplanning' as const },
  { href: '/settings',       icon: Settings,   key: 'settings'     as const },
]

export function Sidebar() {
  const pathname    = usePathname()
  const { language, setLanguage, setTasks, setHabits, setCalendarAccounts, setKeywordRules } = useAppStore()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = React.useState(false)

  // Load calendarAccounts for all pages, and clear store when user switches
  const prevUserIdRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return

    // User switched — force full reload to guarantee clean state
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      setTasks([])
      setHabits([])
      setCalendarAccounts([])
      prevUserIdRef.current = userId
      window.location.reload()
      return
    }
    prevUserIdRef.current = userId

    // Load calendar accounts so every page has them
    fetch('/api/calendar/accounts')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCalendarAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})

    // Load keyword rules from DB (account-bound)
    fetch('/api/keyword-rules')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setKeywordRules(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [session?.user?.id, setTasks, setHabits, setCalendarAccounts, setKeywordRules])

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full transition-all duration-300 ease-in-out shrink-0',
        'bg-[#2a1d10] border-r border-[rgba(168,127,62,0.15)]',
        collapsed ? 'w-[68px]' : 'w-[224px]'
      )}
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(239,138,50,0.08), transparent), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    >
      {/* ── Logo header ── */}
      <div className={cn(
        'flex items-center border-b border-[rgba(168,127,62,0.15)] px-4 h-[68px]',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-v3-static.png"
            alt="Kairos"
            className="h-9 w-9 shrink-0 rounded-lg object-cover object-top"
          />
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="font-serif text-[20px] font-semibold text-[#fbeacb] tracking-wide leading-none">Kairos</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#a87f3e] mt-0.5">墨時 · TIME, INKED.</span>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg text-[#7a6c54] hover:text-[#d9c79f] hover:bg-[#fbf7ee]/[0.06] transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand handle when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-[13px] top-[76px] z-10 h-6 w-6 rounded-full bg-[#3d2e1a] border border-[rgba(225,200,150,0.14)] shadow-lg flex items-center justify-center text-[#8a7a5e] hover:text-[#d9c79f] transition-all"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* ── Nav items ── */}
      <nav className="flex-1 flex flex-col gap-0.5 p-3 pt-4 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || (href !== '/today' && pathname.startsWith(href))
          const isRetro = href === '/retroplanning'
          return (
            <React.Fragment key={href}>
              {isRetro && (
                <div className={cn('my-1.5', collapsed ? 'px-1' : 'px-0')}>
                  <div className="h-px bg-[rgba(225,200,150,0.10)]" />
                  {!collapsed && (
                    <span className="block text-[10px] font-semibold tracking-widest text-[#8a6b3e] uppercase mt-2 mb-0.5 px-3">
                      Planning
                    </span>
                  )}
                </div>
              )}
              <Link
                href={href}
                title={collapsed ? t(key, language) : undefined}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                  collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2.5',
                  active
                    ? 'bg-[#a87f3e]/[0.18] text-[#ffd27a]'
                    : 'text-[#a87f3e] hover:bg-[#fbeacb]/[0.07] hover:text-[#fbeacb]'
                )}
              >
                {active && <span className="nav-active-bar" />}
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t(key, language)}</span>}
              </Link>
            </React.Fragment>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="p-3 border-t border-[rgba(168,127,62,0.15)] flex flex-col gap-0.5">
        {/* About / product page */}
        <Link
          href="/about"
          title={collapsed ? 'Kairos' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl text-[#8a6b3e] hover:bg-[#fbf7ee]/[0.05] hover:text-[#d9c79f] transition-all text-xs font-medium',
            collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2'
          )}
        >
          <Info className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="font-script text-sm text-[#c47f6a]">Kairos</span>}
        </Link>

        {/* Language toggle — cycles FR → EN → 中 → FR */}
        <button
          onClick={() => setLanguage(language === 'fr' ? 'en' : language === 'en' ? 'zh' : 'fr')}
          title={collapsed ? LANG_LABEL[language] : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl text-[#8a6b3e] hover:bg-[#fbf7ee]/[0.05] hover:text-[#d9c79f] transition-all text-xs font-medium',
            collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2'
          )}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{LANG_LABEL[language]}</span>}
        </button>

        {/* User profile */}
        {session?.user && (
          <div className={cn(
            'flex items-center gap-2.5 rounded-xl transition-all',
            collapsed ? 'flex-col gap-1.5 items-center py-2' : 'px-3 py-2'
          )}>
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? ''}
                className="h-7 w-7 rounded-full object-cover ring-2 ring-[rgba(225,200,150,0.14)] shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#c44a3a] to-[#861f17] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[#f3ecdd]">
                  {session.user.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}

            {!collapsed && (
              <p className="flex-1 min-w-0 text-xs font-medium text-[#a87f3e] truncate">
                {session.user.name}
              </p>
            )}

            <Link
              href="/auth/signout"
              title={t('signOut', language)}
              className="p-1.5 rounded-lg text-[#7a6c54] hover:text-[#c44a3a] hover:bg-[#ab3326]/10 transition-all shrink-0 flex items-center justify-center"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </aside>
  )
}
