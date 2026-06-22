'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/stores/useAppStore'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Zap, LayoutGrid, Calendar, Repeat2,
  ChevronLeft, ChevronRight, Globe, GitBranch,
  Info, Settings, LogOut, Shield, MessageSquare, Star,
} from 'lucide-react'

const LANG_LABEL: Record<'fr' | 'en' | 'zh', string> = { fr: 'EN', en: '中', zh: 'FR' }

const navItems = [
  { href: '/today',         icon: Zap,        key: 'today'         as const },
  { href: '/matrix',        icon: LayoutGrid,  key: 'matrix'        as const },
  { href: '/calendar',      icon: Calendar,    key: 'calendar'      as const },
  { href: '/habits',        icon: Repeat2,     key: 'habits'        as const },
  { href: '/retroplanning', icon: GitBranch,   key: 'retroplanning' as const },
]

export function Sidebar() {
  const pathname    = usePathname()
  const { language, setLanguage, setTasks, setHabits, setCalendarAccounts, setKeywordRules } = useAppStore()
  const { data: session } = useSession()
  const [collapsed, setCollapsed]       = React.useState(false)
  const [avatarOpen, setAvatarOpen]     = React.useState(false)
  const [feedbackRating, setFeedbackRating] = React.useState(0)
  const avatarRef = React.useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    if (!avatarOpen) return
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [avatarOpen])

  const prevUserIdRef = React.useRef<string | undefined>(undefined)
  React.useEffect(() => {
    const userId = session?.user?.id
    if (!userId) return
    if (prevUserIdRef.current && prevUserIdRef.current !== userId) {
      setTasks([])
      setHabits([])
      setCalendarAccounts([])
      prevUserIdRef.current = userId
      window.location.reload()
      return
    }
    prevUserIdRef.current = userId
    fetch('/api/calendar/accounts')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCalendarAccounts(Array.isArray(data) ? data : []))
      .catch(() => {})
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
            src="/logo_v5/Logo_transparent.png"
            alt="Kairos"
            className="h-9 w-9 shrink-0 object-contain"
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
        {/* Language toggle */}
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

        {/* Avatar / profile dropdown trigger */}
        {session?.user && (
          <div ref={avatarRef} className="relative">
            <button
              onClick={() => setAvatarOpen((o) => !o)}
              className={cn(
                'w-full flex items-center gap-2.5 rounded-xl transition-all hover:bg-[#fbf7ee]/[0.07]',
                collapsed ? 'flex-col gap-1.5 items-center py-2 justify-center' : 'px-3 py-2'
              )}
            >
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                <p className="flex-1 min-w-0 text-xs font-medium text-[#a87f3e] truncate text-left">
                  {session.user.name}
                </p>
              )}
            </button>

            {/* Dropdown panel — anchors above the button */}
            {avatarOpen && (
              <div
                className={cn(
                  'absolute bottom-full mb-2 z-50 rounded-2xl border border-[rgba(225,200,150,0.18)] bg-[#1e1509] shadow-2xl shadow-black/50 overflow-hidden',
                  collapsed ? 'left-0 w-64' : 'left-0 right-0 min-w-[220px]'
                )}
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-[rgba(225,200,150,0.10)]">
                  <p className="text-xs font-semibold text-[#fbeacb] truncate">{session.user.name}</p>
                  {session.user.email && (
                    <p className="text-[11px] text-[#8a7a5e] truncate mt-0.5">{session.user.email}</p>
                  )}
                </div>

                {/* Navigation links */}
                <div className="p-1.5 flex flex-col gap-0.5">
                  <Link
                    href="/about"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#a87f3e] hover:bg-[#fbf7ee]/[0.08] hover:text-[#fbeacb] transition-all text-xs font-medium"
                  >
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    {language === 'fr' ? 'À propos de Kairos' : language === 'zh' ? '關於 Kairos' : 'About Kairos'}
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#a87f3e] hover:bg-[#fbf7ee]/[0.08] hover:text-[#fbeacb] transition-all text-xs font-medium"
                  >
                    <Settings className="h-3.5 w-3.5 shrink-0" />
                    {language === 'fr' ? 'Paramètres' : language === 'zh' ? '設定' : 'Settings'}
                  </Link>
                </div>

                {/* Privacy & Feedback quick section */}
                <div className="border-t border-[rgba(225,200,150,0.08)] p-1.5 flex flex-col gap-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5a4e3a] px-3 pt-1 pb-0.5">
                    {language === 'fr' ? 'Confidentialité' : language === 'zh' ? '隱私與回饋' : 'Privacy'}
                  </p>
                  <div className="px-3 py-2">
                    <p className="text-[11px] text-[#6b5840] leading-relaxed">
                      {language === 'fr'
                        ? 'Vos données sont stockées de façon sécurisée. Aucun suivi publicitaire.'
                        : language === 'zh'
                        ? '你的資料安全儲存，無廣告追蹤。'
                        : 'Your data is stored securely. No ad tracking.'}
                    </p>
                    <a
                      href="mailto:yexiu07060810@gmail.com?subject=Data deletion request — Kairos"
                      className="inline-flex items-center gap-1 text-[11px] text-[#ab3326] hover:text-[#d44] mt-1"
                    >
                      <Shield className="h-3 w-3" />
                      {language === 'fr' ? 'Supprimer mes données' : language === 'zh' ? '申請刪除資料' : 'Delete my data'}
                    </a>
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5a4e3a] px-3 pt-2 pb-0.5">
                    {language === 'fr' ? 'Avis' : language === 'zh' ? '意見回饋' : 'Feedback'}
                  </p>
                  <div className="px-3 pb-2">
                    <div className="flex gap-0.5 mb-1.5">
                      {[1,2,3,4,5].map((n) => (
                        <button key={n} onClick={() => setFeedbackRating(n)} className="transition-transform hover:scale-110">
                          <Star
                            className="h-4 w-4"
                            fill={n <= feedbackRating ? '#a87f3e' : 'none'}
                            stroke={n <= feedbackRating ? '#a87f3e' : '#5a4e3a'}
                          />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="mailto:yexiu07060810@gmail.com?subject=Kairos Feedback"
                        className="flex items-center gap-1 text-[11px] text-[#8a7a5e] hover:text-[#d9c79f] transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {language === 'fr' ? 'Email' : language === 'zh' ? '寄信' : 'Email'}
                      </a>
                      <a
                        href="https://github.com/AliceTseng0810"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-[#8a7a5e] hover:text-[#d9c79f] transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                        GitHub
                      </a>
                    </div>
                  </div>
                </div>

                {/* Sign out */}
                <div className="border-t border-[rgba(225,200,150,0.08)] p-1.5">
                  <Link
                    href="/auth/signout"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#8a7a5e] hover:bg-red-900/20 hover:text-[#f47c6a] transition-all text-xs font-medium"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    {t('signOut', language)}
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
