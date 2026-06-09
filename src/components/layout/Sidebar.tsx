'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useAppStore } from '@/stores/useAppStore'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  Zap, LayoutGrid, Calendar, Repeat2, Settings, LogOut,
  ChevronLeft, ChevronRight, Globe,
} from 'lucide-react'

const navItems = [
  { href: '/today',    icon: Zap,        key: 'today'    as const },
  { href: '/matrix',   icon: LayoutGrid, key: 'matrix'   as const },
  { href: '/calendar', icon: Calendar,   key: 'calendar' as const },
  { href: '/habits',   icon: Repeat2,    key: 'habits'   as const },
  { href: '/settings', icon: Settings,   key: 'settings' as const },
]

export function Sidebar() {
  const pathname    = usePathname()
  const { language, setLanguage } = useAppStore()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full transition-all duration-300 ease-in-out shrink-0',
        'bg-[#0c0a17] border-r border-white/[0.06]',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      {/* ── Logo header ── */}
      <div className={cn(
        'flex items-center border-b border-white/[0.06] px-4 h-[64px]',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-400 via-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
            <Zap className="h-4 w-4 text-white" />
            {/* inner shine */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          </div>
          {!collapsed && (
            <span className="font-bold text-white tracking-tight text-[15px]">FlowPlan</span>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expand handle when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-[13px] top-[72px] z-10 h-6 w-6 rounded-full bg-[#1a1730] border border-white/10 shadow-lg flex items-center justify-center text-white/35 hover:text-white/70 transition-all"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      {/* ── Nav items ── */}
      <nav className="flex-1 flex flex-col gap-0.5 p-3 pt-4 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || (href !== '/today' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? t(key, language) : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
                collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2.5',
                active
                  ? 'bg-indigo-500/[0.18] text-indigo-300'
                  : 'text-white/35 hover:bg-white/[0.06] hover:text-white/75'
              )}
            >
              {active && <span className="nav-active-bar" />}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(key, language)}</span>}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="p-3 border-t border-white/[0.06] flex flex-col gap-0.5">
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          title={collapsed ? (language === 'fr' ? 'EN' : 'FR') : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl text-white/30 hover:bg-white/[0.06] hover:text-white/65 transition-all text-xs font-medium',
            collapsed ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2'
          )}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{language === 'fr' ? 'EN' : 'FR'}</span>}
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
                className="h-7 w-7 rounded-full object-cover ring-2 ring-white/10 shrink-0"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white">
                  {session.user.name?.[0]?.toUpperCase() ?? '?'}
                </span>
              </div>
            )}

            {!collapsed && (
              <p className="flex-1 min-w-0 text-xs font-medium text-white/55 truncate">
                {session.user.name}
              </p>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              title={t('signOut', language)}
              className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
