'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { CalendarAccount, CalendarProvider } from '@/types'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { signIn, useSession } from 'next-auth/react'
import { prepareCalendarConnect } from '@/lib/actions'
import { DEMO_USER_ID } from '@/lib/demo-data'
import {
  Settings, Plus, Trash2, Globe, Calendar, Check,
  MonitorSmartphone, Loader2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw,
  Pencil, KeyRound, LogOut, User, SlidersHorizontal, Shield, MessageSquare,
  ExternalLink, Mail, Star,
} from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn } from '@/lib/utils'

// oauthKey  → OAuth via NextAuth signIn() + session-restore so the current session is preserved
// connectProvider → dedicated /api/calendar/connect flow (Notion only)
const PROVIDER_CONFIG: Record<CalendarProvider, { label: string; icon: React.ReactNode; color: string; oauthKey?: string; connectProvider?: string }> = {
  GOOGLE: {
    label: 'Google Calendar',
    color: '#4285F4',
    connectProvider: 'google',
    icon: (
      <svg viewBox="0 0 48 48" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
        <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"/>
        <path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.7 37 27 38 24 38c-6.1 0-10.7-3.1-11.8-8.5l-7 5.4C8.8 42.2 15.9 46 24 46z"/>
        <path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.6 2.9-2.4 5.4-4.9 7l6.7 5.5C41.8 37.5 44.5 31.5 44.5 26c0-1.3-.2-2.7-.5-4h.5z"/>
      </svg>
    ),
  },
  OUTLOOK: {
    label: 'Outlook Calendar',
    color: '#0078D4',
    oauthKey: 'microsoft-entra-id',
    icon: (
      <svg viewBox="0 0 48 48" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
        <path fill="#0078D4" d="M28 8h16v8H28z"/>
        <path fill="#28A8E8" d="M28 18h16v8H28z"/>
        <path fill="#0078D4" d="M28 28h16v8H28z"/>
        <path fill="#0058AD" d="M28 38h16v8H28z"/>
        <path fill="#14447D" d="M4 8h22v32H4z"/>
        <ellipse fill="#fff" cx="15" cy="24" rx="7" ry="9"/>
        <ellipse fill="#14447D" cx="15" cy="24" rx="5" ry="7"/>
      </svg>
    ),
  },
  APPLE: {
    label: 'Apple Calendar',
    color: '#1C1C1E',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
    ),
  },
  NOTION: {
    label: 'Notion',
    color: '#000000',
    connectProvider: 'notion',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z"/>
      </svg>
    ),
  },
  LOCAL: {
    label: 'Local',
    color: '#6366F1',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
}

const COLORS = ['#4285F4', '#4F46E5', '#7C3AED', '#DC2626', '#16A34A', '#D97706', '#0891B2', '#DB2777']

interface ProviderSubCalendar {
  externalId: string
  name: string
  color: string
  isActive: boolean
  subCalendarId: string | null
}

// ── Sub-calendar panel ────────────────────────────────────────────────────────

function SubCalendarPanel({ account, lang }: { account: CalendarAccount; lang: 'fr' | 'en' | 'zh'; }) {
  const isNotion = account.provider === 'NOTION'
  const [calendars, setCalendars] = useState<ProviderSubCalendar[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [togglingAll, setTogglingAll] = useState(false)
  const [errorState, setErrorState] = useState<'reauth' | 'access' | 'generic' | null>(null)
  const [search, setSearch] = useState('')
  const { toast } = useGlobalToast()

  const load = useCallback(async () => {
    setLoading(true)
    setErrorState(null)
    const res = await fetch(`/api/calendar/accounts/${account.id}/calendars`)
    if (res.ok) {
      setCalendars(await res.json())
    } else {
      const err = await res.json().catch(() => ({}))
      if (err.code === 'NO_TOKEN') {
        setErrorState('reauth')
      } else if (err.code === 'NO_ACCESS') {
        setErrorState('access')
      } else {
        setErrorState('generic')
        console.error('Failed to load calendars:', err)
      }
    }
    setLoading(false)
  }, [account.id, lang, toast])

  useEffect(() => { load() }, [load])

  const toggleAll = async (isActive: boolean) => {
    setTogglingAll(true)
    const res = await fetch(`/api/calendar/accounts/${account.id}/calendars`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive, calendars: calendars.map((c) => ({ externalId: c.externalId, name: c.name, color: c.color })) }),
    })
    if (res.ok) {
      setCalendars((prev) => prev.map((c) => ({ ...c, isActive })))
    } else {
      toast({ title: lang === 'fr' ? 'Erreur lors de la mise à jour' : lang === 'zh' ? '更新失敗，請稍後再試' : 'Update failed', variant: 'error' })
    }
    setTogglingAll(false)
  }

  const toggle = async (cal: ProviderSubCalendar) => {
    setToggling(cal.externalId)
    const res = await fetch(`/api/calendar/accounts/${account.id}/calendars`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: cal.externalId, name: cal.name, color: cal.color, isActive: !cal.isActive }),
    })
    if (res.ok) {
      setCalendars((prev) => prev.map((c) => c.externalId === cal.externalId ? { ...c, isActive: !c.isActive } : c))
    }
    setToggling(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4 text-sm text-[#a99873]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {lang === 'fr' ? 'Chargement…' : lang === 'zh' ? '載入中…' : 'Loading…'}
      </div>
    )
  }

  if (errorState === 'reauth') {
    return (
      <div className="py-3 px-4 flex items-center gap-3">
        <p className="text-xs text-amber-600 flex-1">
          {lang === 'fr' ? 'Token expiré. Ré-autorisez pour voir les calendriers.' : lang === 'zh' ? '授權已過期，請重新授權以查看日曆。' : 'Token expired. Re-authorize to see calendars.'}
        </p>
        <a
          href={`/api/calendar/connect?provider=${account.provider.toLowerCase()}&accountId=${account.id}`}
          className="text-xs text-red-500 hover:text-red-900 font-medium underline underline-offset-2 whitespace-nowrap"
        >
          {lang === 'fr' ? 'Ré-autoriser' : lang === 'zh' ? '重新授權' : 'Re-authorize'}
        </a>
      </div>
    )
  }

  if (errorState === 'access') {
    return (
      <div className="py-3 px-4">
        <p className="text-xs text-amber-600">
          {lang === 'fr'
            ? 'Aucune base partagée avec l\'intégration. Ouvrez Notion, ouvrez une base de données, puis partagez-la avec l\'intégration FlowPlan (••• → Connexions).'
            : lang === 'zh'
            ? '尚未與此整合分享任何資料庫。請開啟 Notion，打開一個資料庫，然後將它分享給 FlowPlan 整合（••• → 連結）。'
            : 'No databases shared with the integration. Open Notion, open a database, then share it with the FlowPlan integration (••• → Connections).'}
        </p>
      </div>
    )
  }

  if (errorState === 'generic') {
    return (
      <div className="py-3 px-4 flex items-center gap-3">
        <p className="text-xs text-red-500 flex-1">
          {lang === 'fr' ? 'Erreur lors du chargement des calendriers.' : lang === 'zh' ? '載入日曆時發生錯誤。' : 'Failed to load calendars.'}
        </p>
        <button onClick={load} className="text-xs text-[#8a7a5e] hover:text-[#3a3326] font-medium underline underline-offset-2 whitespace-nowrap">
          {lang === 'fr' ? 'Réessayer' : lang === 'zh' ? '重試' : 'Retry'}
        </button>
      </div>
    )
  }

  if (calendars.length === 0) {
    return (
      <p className="py-3 px-4 text-xs text-[#a99873]">
        {lang === 'fr' ? 'Aucun calendrier trouvé.' : lang === 'zh' ? '找不到任何日曆。' : 'No calendars found.'}
      </p>
    )
  }

  const filteredCalendars = search.trim()
    ? calendars.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : calendars

  return (
    <div className="flex flex-col gap-1 py-2 px-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-[#8a7a5e] uppercase tracking-wide">
          {isNotion
            ? (lang === 'fr' ? 'Bases de données' : lang === 'zh' ? '資料庫' : 'Databases')
            : (lang === 'fr' ? 'Sous-calendriers' : lang === 'zh' ? '子日曆' : 'Sub-calendars')}
        </p>
        <div className="flex items-center gap-1">
          {togglingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#a99873]" />
          ) : (
            <>
              <button
                onClick={() => toggleAll(true)}
                disabled={calendars.every((c) => c.isActive)}
                className="text-xs text-red-500 hover:text-red-900 disabled:opacity-30 disabled:cursor-not-allowed px-1"
              >
                {lang === 'fr' ? 'Tout' : lang === 'zh' ? '全部' : 'All'}
              </button>
              <span className="text-[#cbb98e] text-xs">|</span>
              <button
                onClick={() => toggleAll(false)}
                disabled={calendars.every((c) => !c.isActive)}
                className="text-xs text-[#a99873] hover:text-[#6e6147] disabled:opacity-30 disabled:cursor-not-allowed px-1"
              >
                {lang === 'fr' ? 'Aucun' : lang === 'zh' ? '全不選' : 'None'}
              </button>
              <span className="text-[#e2d6bc] text-xs">·</span>
            </>
          )}
          <button onClick={load} className="p-1 rounded-lg hover:bg-[#ece2cb] text-[#a99873] hover:text-[#6e6147] transition-colors">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>
      {isNotion && calendars.length > 5 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={lang === 'fr' ? 'Rechercher...' : lang === 'zh' ? '搜尋...' : 'Search...'}
          className="mb-1 w-full rounded-lg border border-[#e2d6bc] bg-[#fbf7ee] px-3 py-1.5 text-xs text-[#5c5347] placeholder:text-[#c4b49a] focus:outline-none focus:ring-1 focus:ring-[#c4b49a]"
        />
      )}
      {filteredCalendars.length === 0 && search.trim() && (
        <p className="py-2 text-xs text-[#a99873]">
          {lang === 'fr' ? 'Aucun résultat.' : lang === 'zh' ? '找不到結果。' : 'No results.'}
        </p>
      )}
      {filteredCalendars.map((cal) => (
        <div key={cal.externalId} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-[#f3ecdd] transition-colors">
          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
          <span className="text-sm text-[#5c5347] flex-1 truncate">{cal.name}</span>
          {toggling === cal.externalId ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#a99873] flex-shrink-0" />
          ) : (
            <button
              onClick={() => toggle(cal)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                cal.isActive ? 'bg-red-500' : 'bg-[#e2d6bc]'
              )}
              aria-label={cal.isActive ? 'Disable' : 'Enable'}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[#fbf7ee] shadow transition-transform',
                cal.isActive && 'translate-x-4'
              )} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Edit account dialog ───────────────────────────────────────────────────────

function EditAccountDialog({
  account, open, onClose, onSave, lang,
}: {
  account: CalendarAccount
  open: boolean
  onClose: () => void
  onSave: (id: string, name: string, color: string) => Promise<void>
  lang: 'fr' | 'en' | 'zh'
}) {
  const [name, setName] = useState(account.name)
  const [color, setColor] = useState(account.color)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setName(account.name); setColor(account.color) }, [account])

  const handleSave = async () => {
    setSaving(true)
    await onSave(account.id, name, color)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{lang === 'fr' ? 'Modifier le calendrier' : lang === 'zh' ? '編輯日曆' : 'Edit calendar'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'fr' ? 'Nom affiché' : lang === 'zh' ? '顯示名稱' : 'Display name'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Couleur' : lang === 'zh' ? '顏色' : 'Color'}</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? 'border-[#2a2420] scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t('save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── CalendarAccount row ───────────────────────────────────────────────────────

function CalendarAccountRow({
  account, lang, onDelete, onEdit,
}: {
  account: CalendarAccount
  lang: 'fr' | 'en' | 'zh'
  onDelete: () => void
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = PROVIDER_CONFIG[account.provider as CalendarProvider]
  const supportsSubCalendars = account.provider === 'GOOGLE' || account.provider === 'OUTLOOK' || account.provider === 'NOTION'
  const canReauthorize = !!(config?.oauthKey || config?.connectProvider)

  const handleReauthorize = async () => {
    if (config?.oauthKey) {
      await prepareCalendarConnect()
      await signIn(
        config.oauthKey,
        { callbackUrl: `/api/calendar/finalize-connect?provider=${config.oauthKey}` },
        { prompt: 'consent' },
      )
    } else if (config?.connectProvider) {
      window.location.href = `/api/calendar/connect?provider=${config.connectProvider}&accountId=${account.id}`
    }
  }

  return (
    <div className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: (config?.color ?? '#6366F1') + '15', color: config?.color ?? '#6366F1' }}>
            {config?.icon ?? <span className="text-lg">📅</span>}
          </div>
          <div>
            <p className="text-sm font-medium text-[#2a2420]">{account.name}</p>
            <p className="text-xs text-[#8a7a5e]">{config?.label ?? account.provider}</p>
          </div>
          <div className="h-3 w-3 rounded-full border border-white shadow" style={{ backgroundColor: account.color }} />
        </div>

        <div className="flex items-center gap-1">
          <Badge variant="success" className="text-xs mr-1">
            {lang === 'fr' ? 'Connecté' : lang === 'zh' ? '已連接' : 'Connected'}
          </Badge>

          {supportsSubCalendars && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-red-800 hover:text-red-950 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
            >
              {account.provider === 'NOTION'
                ? (lang === 'fr' ? 'Bases' : lang === 'zh' ? '資料庫' : 'Databases')
                : (lang === 'fr' ? 'Calendriers' : lang === 'zh' ? '日曆' : 'Calendars')}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-[#ece2cb] text-[#a99873] hover:text-[#5c5347] transition-colors"
            title={lang === 'fr' ? 'Modifier' : lang === 'zh' ? '編輯' : 'Edit'}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {canReauthorize && (
            <button
              onClick={handleReauthorize}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-[#a99873] hover:text-amber-600 transition-colors"
              title={lang === 'fr' ? 'Ré-autoriser' : lang === 'zh' ? '重新授權' : 'Re-authorize'}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-[#a99873] hover:text-red-500 transition-colors"
            title={lang === 'fr' ? 'Supprimer' : lang === 'zh' ? '移除' : 'Remove'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && supportsSubCalendars && (
        <div className="border-t border-[#f3ecdd]">
          <SubCalendarPanel account={account} lang={lang} />
        </div>
      )}
    </div>
  )
}

// ── Add calendar dialog ───────────────────────────────────────────────────────

function AddCalendarDialog({ open, onClose, onAdd, lang, isDemo }: {
  open: boolean
  onClose: () => void
  onAdd: (data: { provider: CalendarProvider; name: string; color: string }) => Promise<void>
  lang: 'fr' | 'en' | 'zh'
  isDemo?: boolean
}) {
  const [provider, setProvider] = useState<CalendarProvider>('GOOGLE')
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4F46E5')
  const [saving, setSaving] = useState(false)

  const config = PROVIDER_CONFIG[provider]

  const handleAdd = async () => {
    if (isDemo) { onClose(); return }
    if (config.oauthKey) {
      // Save the current session token so finalize-connect can restore it after OAuth
      await prepareCalendarConnect()
      // 'select_account' forces the account picker so the user can choose a different account
      await signIn(
        config.oauthKey,
        { callbackUrl: `/api/calendar/finalize-connect?provider=${config.oauthKey}` },
        { prompt: 'select_account' },
      )
      return
    }
    if (config.connectProvider) {
      window.location.href = `/api/calendar/connect?provider=${config.connectProvider}`
      return
    }
    if (!name.trim()) return
    setSaving(true)
    await onAdd({ provider, name, color })
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('connectCalendar', lang)}</DialogTitle>
          <DialogDescription>
            {lang === 'fr' ? 'Connectez un calendrier pour synchroniser vos tâches.' : lang === 'zh' ? '連結一個日曆來同步你的任務。' : 'Connect a calendar to sync your tasks.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Service' : lang === 'zh' ? '服務' : 'Service'}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROVIDER_CONFIG) as CalendarProvider[]).filter(p => p !== 'LOCAL').map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border transition-all text-left ${
                    provider === p ? 'border-red-300 bg-red-50 text-red-900' : 'border-[#e2d6bc] hover:bg-[#f3ecdd]'
                  }`}
                >
                  <span className="flex items-center justify-center" style={{ color: PROVIDER_CONFIG[p].color }}>{PROVIDER_CONFIG[p].icon}</span>
                  <span className="font-medium">{PROVIDER_CONFIG[p].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name/color only needed for manual providers (APPLE, LOCAL) */}
          {!config.connectProvider && !config.oauthKey && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{lang === 'fr' ? 'Nom affiché' : lang === 'zh' ? '顯示名稱' : 'Display name'}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={config.label} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{lang === 'fr' ? 'Couleur' : lang === 'zh' ? '顏色' : 'Color'}</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? 'border-[#2a2420] scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {isDemo && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              {lang === 'fr'
                ? 'La synchronisation calendrier n\'est pas disponible en mode démo.'
                : lang === 'zh'
                ? '示範模式下無法使用日曆同步功能。'
                : 'Calendar sync is not available in demo mode.'}
            </div>
          )}

          {!isDemo && (config.oauthKey || config.connectProvider) && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              {lang === 'fr'
                ? `Vous serez redirigé vers ${config.label} pour autoriser l'accès. Votre session restera active.`
                : lang === 'zh'
                ? `你將被導向至 ${config.label} 以授權存取，目前的登入狀態會保持有效。`
                : `You'll be redirected to ${config.label} to authorize access. Your current session will stay active.`}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleAdd} disabled={saving || (!config.connectProvider && !config.oauthKey && !name.trim())}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {(config.connectProvider || config.oauthKey) ? (lang === 'fr' ? 'Connecter' : lang === 'zh' ? '連結' : 'Connect') : t('save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Tag chip helper ───────────────────────────────────────────────────────────

function TagChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 rounded-lg bg-[#f3ecdd] border border-[#e2d6bc] px-2.5 py-1 text-xs text-[#5c5347]">
      {label}
      <button onClick={onRemove} className="text-[#a99873] hover:text-red-500 ml-0.5 leading-none">×</button>
    </span>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const {
    language, setLanguage,
    calendarAccounts, setCalendarAccounts,
  } = useAppStore()
  const { data: session } = useSession()
  const isDemo = session?.user?.id === DEMO_USER_ID
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showAddCalendar, setShowAddCalendar] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editAccount, setEditAccount] = useState<CalendarAccount | null>(null)
  const [feedbackRating, setFeedbackRating] = useState(0)

  // Surface OAuth result toasts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('cal_success')
    const error = params.get('cal_error')
    if (success === 'connected') {
      toast({ title: language === 'fr' ? 'Calendrier connecté !' : language === 'zh' ? '日曆已連結！' : 'Calendar connected!', variant: 'success' })
      loadAccounts()
    }
    if (success === 'reauthorized') toast({ title: language === 'fr' ? 'Calendrier ré-autorisé !' : language === 'zh' ? '日曆已重新授權！' : 'Calendar re-authorized!', variant: 'success' })
    if (error === 'access_denied') toast({ title: language === 'fr' ? 'Accès refusé.' : language === 'zh' ? '存取被拒絕。' : 'Access denied.', variant: 'error' })
    else if (error) toast({ title: `OAuth error: ${error}`, variant: 'error' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/calendar/accounts')
      const data = await res.json()
      setCalendarAccounts(Array.isArray(data) ? data : [])
    } catch {
      setCalendarAccounts([])
    }
    setLoading(false)
  }, [setCalendarAccounts])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  const handleAddCalendar = async (data: { provider: CalendarProvider; name: string; color: string }) => {
    const res = await fetch('/api/calendar/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const created = await res.json()
      setCalendarAccounts([...calendarAccounts, created])
      toast({ title: language === 'fr' ? 'Calendrier ajouté !' : language === 'zh' ? '日曆已新增！' : 'Calendar added!', variant: 'success' })
    }
  }

  const handleEditAccount = async (id: string, name: string, color: string) => {
    const res = await fetch('/api/calendar/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, color }),
    })
    if (res.ok) {
      const updated = await res.json()
      setCalendarAccounts(calendarAccounts.map((a) => a.id === id ? { ...a, ...updated } : a))
      toast({ title: language === 'fr' ? 'Calendrier modifié !' : language === 'zh' ? '日曆已更新！' : 'Calendar updated!', variant: 'success' })
    }
  }

  const handleDeleteCalendar = async (id: string) => {
    const res = await fetch('/api/calendar/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      toast({ title: language === 'fr' ? 'Erreur lors de la suppression' : language === 'zh' ? '移除失敗，請稍後再試' : 'Failed to remove calendar', variant: 'error' })
      return
    }
    setCalendarAccounts(calendarAccounts.filter((a) => a.id !== id))
    setDeleteConfirm(null)
    toast({ title: language === 'fr' ? 'Calendrier supprimé' : language === 'zh' ? '日曆已移除' : 'Calendar removed', variant: 'info' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <Settings className="h-5 w-5 text-red-800" />
          <h1 className="text-2xl font-serif text-[#2a2420]">{t('settings', language)}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-6">

            {/* Profile */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-red-500" />
                {language === 'fr' ? 'Profil' : language === 'zh' ? '個人資料' : 'Profile'}
              </h2>
              <div className="flex items-center gap-4">
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="avatar" className="h-14 w-14 rounded-2xl object-cover border border-[#ece2cb]" />
                ) : (
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-red-100 to-amber-100 border border-[#ece2cb] flex items-center justify-center">
                    <User className="h-6 w-6 text-red-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-[#2a2420]">{session?.user?.name ?? '—'}</p>
                  <p className="text-xs text-[#8a7a5e] mt-0.5">{session?.user?.email ?? '—'}</p>
                  {isDemo && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
                      {language === 'fr' ? 'Mode démo' : language === 'zh' ? '示範模式' : 'Demo mode'}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Language */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
                <Globe className="h-4 w-4 text-red-500" />
                {t('language', language)}
              </h2>
              <div className="flex gap-3 flex-wrap">
                {(['fr', 'en', 'zh'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-all ${
                      language === lang ? 'bg-red-50 border-red-300 text-red-900' : 'border-[#e2d6bc] text-[#6e6147] hover:bg-[#f3ecdd]'
                    }`}
                  >
                    {language === lang && <Check className="h-3.5 w-3.5" />}
                    {lang === 'fr' ? '🇫🇷 Français' : lang === 'zh' ? '🇹🇼 繁體中文' : '🇬🇧 English'}
                  </button>
                ))}
              </div>
            </section>

            {/* Privacy & Data */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <h2 className="text-sm font-semibold text-[#5c5347] mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                {language === 'fr' ? 'Confidentialité & Données' : language === 'zh' ? '隱私權與資料' : 'Privacy & Data'}
              </h2>
              <div className="flex flex-col gap-3">
                <p className="text-xs text-[#6b5840] leading-relaxed">
                  {language === 'fr'
                    ? 'Vos données (tâches, habitudes, calendriers) sont stockées de façon sécurisée et ne sont jamais partagées avec des tiers. Seules les informations de base du profil (nom, email, avatar) sont conservées depuis votre compte OAuth.'
                    : language === 'zh'
                    ? '你的資料（任務、習慣、日曆）安全儲存，絕不與第三方分享。僅保留 OAuth 帳號的基本個人資料（姓名、電子郵件、頭像）。'
                    : 'Your data (tasks, habits, calendars) is stored securely and never shared with third parties. Only basic profile info (name, email, avatar) is retained from your OAuth account.'}
                </p>
                <div className="border-t border-[#ece2cb] pt-3 flex flex-col gap-2">
                  {[
                    language === 'fr' ? 'Données chiffrées en transit (HTTPS)' : language === 'zh' ? '傳輸加密（HTTPS）' : 'Data encrypted in transit (HTTPS)',
                    language === 'fr' ? 'Aucun suivi publicitaire' : language === 'zh' ? '無廣告追蹤' : 'No ad tracking',
                    language === 'fr' ? 'Suppression sur demande' : language === 'zh' ? '可申請刪除帳號資料' : 'Deletion available on request',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-[#5c5347]">
                      <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <a
                    href="mailto:yexiu07060810@gmail.com?subject=Data deletion request — Kairos"
                    className="inline-flex items-center gap-1.5 text-xs text-[#ab3326] hover:text-[#861f17] font-medium transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {language === 'fr' ? 'Demander la suppression' : language === 'zh' ? '申請刪除資料' : 'Request deletion'}
                  </a>
                </div>
              </div>
            </section>

            {/* Feedback */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <h2 className="text-sm font-semibold text-[#5c5347] mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#a87f3e]" />
                {language === 'fr' ? 'Avis & Retours' : language === 'zh' ? '意見回饋' : 'Feedback'}
              </h2>
              <div className="flex flex-col gap-4">
                {/* Star rating */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[#8a7a5e]">
                    {language === 'fr' ? 'Comment évaluez-vous Kairos ?' : language === 'zh' ? '你對 Kairos 的評價如何？' : 'How would you rate Kairos?'}
                  </p>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setFeedbackRating(n)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className="h-6 w-6 transition-colors"
                          fill={n <= feedbackRating ? '#a87f3e' : 'none'}
                          stroke={n <= feedbackRating ? '#a87f3e' : '#c9b88a'}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Contact links */}
                <div className="border-t border-[#ece2cb] pt-3 flex flex-col gap-2.5">
                  <a
                    href="mailto:yexiu07060810@gmail.com?subject=Kairos Feedback"
                    className="flex items-center gap-2.5 text-sm text-[#5c5347] hover:text-[#ab3326] transition-colors group"
                  >
                    <span className="h-8 w-8 rounded-xl bg-[#f3ecdd] border border-[#e7c894] flex items-center justify-center group-hover:bg-red-50 transition-colors shrink-0">
                      <Mail className="h-3.5 w-3.5 text-[#ab3326]" />
                    </span>
                    <div>
                      <p className="text-xs font-medium">{language === 'fr' ? 'Envoyer un email' : language === 'zh' ? '傳送電子郵件' : 'Send an email'}</p>
                      <p className="text-[11px] text-[#a99873]">yexiu07060810@gmail.com</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 ml-auto text-[#c9b88a] group-hover:text-[#ab3326]" />
                  </a>
                  <a
                    href="https://github.com/AliceTseng0810"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-[#5c5347] hover:text-[#2a1f12] transition-colors group"
                  >
                    <span className="h-8 w-8 rounded-xl bg-[#f3ecdd] border border-[#e7c894] flex items-center justify-center group-hover:bg-[#2a1f12]/10 transition-colors shrink-0">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
                    </span>
                    <div>
                      <p className="text-xs font-medium">{language === 'fr' ? 'Signaler un bug' : language === 'zh' ? '回報問題 / GitHub' : 'Report a bug / GitHub'}</p>
                      <p className="text-[11px] text-[#a99873]">github.com/AliceTseng0810</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 ml-auto text-[#c9b88a]" />
                  </a>
                </div>
              </div>
            </section>

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-6">

            {/* Connected calendars */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#5c5347] flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-red-500" />
                  {t('connectedAccounts', language)}
                  <Badge variant="secondary">{calendarAccounts.length}</Badge>
                </h2>
                <Button size="sm" onClick={() => setShowAddCalendar(true)}>
                  <Plus className="h-4 w-4" />
                  {t('connectCalendar', language)}
                </Button>
              </div>

              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#a99873]" />
              ) : calendarAccounts.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[#e2d6bc] p-8 text-center">
                  <Calendar className="h-8 w-8 text-[#cbb98e] mx-auto mb-3" />
                  <p className="text-sm text-[#8a7a5e]">{language === 'fr' ? 'Aucun calendrier connecté' : language === 'zh' ? '尚未連結任何日曆' : 'No calendar connected'}</p>
                  <p className="text-xs text-[#a99873] mt-1">
                    {language === 'fr' ? 'Connectez Google, Outlook, Apple ou Notion' : language === 'zh' ? '連結 Google、Outlook、Apple 或 Notion' : 'Connect Google, Outlook, Apple, or Notion'}
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddCalendar(true)}>
                    <Plus className="h-4 w-4" />
                    {t('connectCalendar', language)}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {calendarAccounts.map((account) => (
                    <CalendarAccountRow
                      key={account.id}
                      account={account}
                      lang={language}
                      onDelete={() => setDeleteConfirm(account.id)}
                      onEdit={() => setEditAccount(account)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* App info */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-red-500" />
                {language === 'fr' ? 'Application' : language === 'zh' ? '應用程式' : 'Application'}
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#2a2420]">Kairos 墨時</p>
                    <p className="text-xs text-[#8a7a5e] mt-0.5">v0.1.0 — {language === 'fr' ? 'Planification intelligente' : language === 'zh' ? '智能規劃' : 'Smart planning'}</p>
                  </div>
                  <span className="text-xs text-[#8a7a5e] bg-[#f3ecdd] border border-[#e2d6bc] rounded-lg px-2.5 py-1">Beta</span>
                </div>
                <div className="border-t border-[#ece2cb] pt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-[#5c5347]">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {language === 'fr' ? 'PWA — Installable sur mobile' : language === 'zh' ? 'PWA — 可安裝至手機' : 'PWA — Installable on mobile'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5c5347]">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {language === 'fr' ? 'Synchronisation Google Calendar bidirectionnelle' : language === 'zh' ? 'Google Calendar 雙向同步' : 'Google Calendar two-way sync'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#5c5347]">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    {language === 'fr' ? 'Matrice d\'Eisenhower avec glisser-déposer' : language === 'zh' ? '拖曳式艾森豪矩陣' : 'Drag-and-drop Eisenhower Matrix'}
                  </div>
                </div>
              </div>
            </section>

            {/* Session / Sign out */}
            <section className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-5">
              <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-red-400" />
                {language === 'fr' ? 'Session' : language === 'zh' ? '帳號管理' : 'Account'}
              </h2>
              <a
                href="/auth/signout"
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {language === 'fr' ? 'Se déconnecter' : language === 'zh' ? '登出' : 'Sign out'}
              </a>
            </section>

          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'fr' ? 'Supprimer ce calendrier ?' : language === 'zh' ? '確定移除此日曆？' : 'Remove this calendar?'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Les tâches associées ne seront pas supprimées.' : language === 'zh' ? '相關的任務不會被刪除。' : 'Associated tasks will not be deleted.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('cancel', language)}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteCalendar(deleteConfirm)}>{t('delete', language)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit account dialog */}
      {editAccount && (
        <EditAccountDialog
          account={editAccount}
          open={!!editAccount}
          onClose={() => setEditAccount(null)}
          onSave={handleEditAccount}
          lang={language}
        />
      )}

      <AddCalendarDialog
        open={showAddCalendar}
        onClose={() => setShowAddCalendar(false)}
        onAdd={handleAddCalendar}
        lang={language}
        isDemo={isDemo}
      />
    </div>
  )
}
