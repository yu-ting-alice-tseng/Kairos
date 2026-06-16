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
  Pencil, KeyRound, LogOut,
} from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn } from '@/lib/utils'

// oauthKey  → OAuth via NextAuth signIn() + session-restore so the current session is preserved
// connectProvider → dedicated /api/calendar/connect flow (Notion only)
const PROVIDER_CONFIG: Record<CalendarProvider, { label: string; icon: string; color: string; oauthKey?: string; connectProvider?: string }> = {
  GOOGLE: { label: 'Google Calendar', icon: '🔵', color: '#4285F4', oauthKey: 'google' },
  OUTLOOK: { label: 'Outlook Calendar', icon: '🟦', color: '#0078D4', oauthKey: 'microsoft-entra-id' },
  APPLE: { label: 'Apple Calendar', icon: '⚫', color: '#1C1C1E' },
  NOTION: { label: 'Notion', icon: '⬜', color: '#000000', connectProvider: 'notion' },
  LOCAL: { label: 'Local', icon: '📅', color: '#6366F1' },
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
    await fetch(`/api/calendar/accounts/${account.id}/calendars`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive, calendars: calendars.map((c) => ({ externalId: c.externalId, name: c.name, color: c.color })) }),
    })
    setCalendars((prev) => prev.map((c) => ({ ...c, isActive })))
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
      {calendars.map((cal) => (
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
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: (config?.color ?? '#6366F1') + '15' }}>
            {config?.icon ?? '📅'}
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
                  <span>{PROVIDER_CONFIG[p].icon}</span>
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

// ── Settings page ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { language, setLanguage, calendarAccounts, setCalendarAccounts } = useAppStore()
  const { data: session } = useSession()
  const isDemo = session?.user?.id === DEMO_USER_ID
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showAddCalendar, setShowAddCalendar] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editAccount, setEditAccount] = useState<CalendarAccount | null>(null)

  // Surface OAuth result toasts — use window.location.search to avoid Suspense requirement
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
    await fetch('/api/calendar/accounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCalendarAccounts(calendarAccounts.filter((a) => a.id !== id))
    setDeleteConfirm(null)
    toast({ title: language === 'fr' ? 'Calendrier supprimé' : language === 'zh' ? '日曆已移除' : 'Calendar removed', variant: 'info' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-5 border-b border-[#ece2cb] bg-[#fbf7ee]">
        <Settings className="h-5 w-5 text-red-800 mr-2" />
        <h1 className="text-xl font-bold text-[#2a2420]">{t('settings', language)}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl flex flex-col gap-8">

        {/* Language */}
        <section>
          <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-red-500" />
            {t('language', language)}
          </h2>
          <div className="flex gap-3">
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

        {/* Connected calendars */}
        <section>
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
        <section>
          <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-red-500" />
            {language === 'fr' ? 'Application' : language === 'zh' ? '應用程式' : 'Application'}
          </h2>
          <div className="rounded-2xl border border-[#ece2cb] bg-[#fbf7ee] p-4">
            <p className="text-sm font-medium text-[#2a2420]">FlowPlan</p>
            <p className="text-xs text-[#8a7a5e] mt-0.5">v0.1.0 — {language === 'fr' ? 'Planification intelligente' : language === 'zh' ? '智能規劃' : 'Smart planning'}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-red-800">
              <Check className="h-3.5 w-3.5" />
              {language === 'fr' ? 'PWA — Installable sur mobile' : language === 'zh' ? 'PWA — 可安裝至手機' : 'PWA — Installable on mobile'}
            </div>
          </div>
        </section>

        {/* Sign out */}
        <section>
          <h2 className="text-sm font-semibold text-[#5c5347] mb-4 flex items-center gap-2">
            <LogOut className="h-4 w-4 text-red-400" />
            {language === 'fr' ? 'Session' : language === 'zh' ? '登入狀態' : 'Session'}
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
