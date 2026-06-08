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
  { href: '/today', icon: Zap, key: 'today' as const },
  { href: '/matrix', icon: LayoutGrid, key: 'matrix' as const },
  { href: '/calendar', icon: Calendar, key: 'calendar' as const },
  { href: '/habits', icon: Repeat2, key: 'habits' as const },
  { href: '/settings', icon: Settings, key: 'settings' as const },
]

export function Sidebar() {
  const pathname = usePathname()
  const { language, setLanguage } = useAppStore()
  const { data: session } = useSession()
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <aside
      className={cn(
        'relative flex flex-col h-full bg-white border-r border-gray-100 transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">FlowPlan</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto h-7 w-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-14 z-10 h-6 w-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      )}

      <nav className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, key }) => {
          const active = pathname === href || (href !== '/today' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(key, language)}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-100 flex flex-col gap-2">
        <button
          onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{language === 'fr' ? 'EN' : 'FR'}</span>}
        </button>

        {session?.user && (
          <div className={cn('flex items-center gap-3', collapsed && 'flex-col gap-1')}>
            {session.user.image && !collapsed && (
              <img
                src={session.user.image}
                alt={session.user.name ?? ''}
                className="h-7 w-7 rounded-full object-cover"
              />
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{session.user.name}</p>
              </div>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors shrink-0"
              title={t('signOut', language)}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
