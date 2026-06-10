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
import { useSession } from 'next-auth/react'
import { DEMO_USER_ID } from '@/lib/demo-data'
import {
  Settings, Plus, Trash2, Globe, Calendar, Check,
  MonitorSmartphone, Loader2, AlertTriangle, ChevronDown, ChevronUp, RefreshCw,
  Pencil, KeyRound,
} from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

const PROVIDER_CONFIG: Record<CalendarProvider, { label: string; icon: string; color: string; connectProvider?: string }> = {
  GOOGLE: { label: 'Google Calendar', icon: '🔵', color: '#4285F4', connectProvider: 'google' },
  OUTLOOK: { label: 'Outlook Calendar', icon: '🟦', color: '#0078D4' },
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

function SubCalendarPanel({ account, lang }: { account: CalendarAccount; lang: 'fr' | 'en'; }) {
  const isNotion = account.provider === 'NOTION'
  const [calendars, setCalendars] = useState<ProviderSubCalendar[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const { toast } = useGlobalToast()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/calendar/accounts/${account.id}/calendars`)
    if (res.ok) {
      setCalendars(await res.json())
    } else {
      const err = await res.json()
      if (err.code === 'NO_TOKEN') {
        toast({ title: lang === 'fr' ? 'Ré-autorisez ce calendrier pour voir les sous-calendriers.' : 'Re-authorize this calendar to view sub-calendars.', variant: 'error' })
      } else {
        toast({ title: err.error ?? 'Failed to load calendars', variant: 'error' })
      }
    }
    setLoading(false)
  }, [account.id, lang, toast])

  useEffect(() => { load() }, [load])

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
      <div className="flex items-center gap-2 py-3 px-4 text-sm text-gray-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {lang === 'fr' ? 'Chargement…' : 'Loading…'}
      </div>
    )
  }

  if (calendars.length === 0) {
    return (
      <p className="py-3 px-4 text-xs text-gray-400">
        {lang === 'fr' ? 'Aucun calendrier trouvé.' : 'No calendars found.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1 py-2 px-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {isNotion
            ? (lang === 'fr' ? 'Bases de données' : 'Databases')
            : (lang === 'fr' ? 'Sous-calendriers' : 'Sub-calendars')}
        </p>
        <button onClick={load} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      {calendars.map((cal) => (
        <div key={cal.externalId} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 transition-colors">
          <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cal.color }} />
          <span className="text-sm text-gray-700 flex-1 truncate">{cal.name}</span>
          {toggling === cal.externalId ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400 flex-shrink-0" />
          ) : (
            <button
              onClick={() => toggle(cal)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                cal.isActive ? 'bg-indigo-500' : 'bg-gray-200'
              )}
              aria-label={cal.isActive ? 'Disable' : 'Enable'}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
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
  lang: 'fr' | 'en'
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
          <DialogTitle>{lang === 'fr' ? 'Modifier le calendrier' : 'Edit calendar'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{lang === 'fr' ? 'Nom affiché' : 'Display name'}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Couleur' : 'Color'}</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
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
  lang: 'fr' | 'en'
  onDelete: () => void
  onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const config = PROVIDER_CONFIG[account.provider as CalendarProvider]
  const supportsSubCalendars = account.provider === 'GOOGLE' || account.provider === 'OUTLOOK' || account.provider === 'NOTION'
  const canReauthorize = !!config?.connectProvider

  return (
    <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: (config?.color ?? '#6366F1') + '15' }}>
            {config?.icon ?? '📅'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{account.name}</p>
            <p className="text-xs text-gray-500">{config?.label ?? account.provider}</p>
          </div>
          <div className="h-3 w-3 rounded-full border border-white shadow" style={{ backgroundColor: account.color }} />
        </div>

        <div className="flex items-center gap-1">
          <Badge variant="success" className="text-xs mr-1">
            {lang === 'fr' ? 'Connecté' : 'Connected'}
          </Badge>

          {supportsSubCalendars && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              {account.provider === 'NOTION'
                ? (lang === 'fr' ? 'Bases' : 'Databases')
                : (lang === 'fr' ? 'Calendriers' : 'Calendars')}
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title={lang === 'fr' ? 'Modifier' : 'Edit'}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {canReauthorize && (
            <a
              href={`/api/calendar/connect?provider=${config.connectProvider}&accountId=${account.id}`}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
              title={lang === 'fr' ? 'Ré-autoriser' : 'Re-authorize'}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </a>
          )}

          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title={lang === 'fr' ? 'Supprimer' : 'Remove'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && supportsSubCalendars && (
        <div className="border-t border-gray-50">
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
  lang: 'fr' | 'en'
  isDemo?: boolean
}) {
  const [provider, setProvider] = useState<CalendarProvider>('GOOGLE')
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4F46E5')
  const [saving, setSaving] = useState(false)

  const config = PROVIDER_CONFIG[provider]

  const handleAdd = async () => {
    if (isDemo) { onClose(); return }
    if (config.connectProvider) {
      // Dedicated calendar-only OAuth — does NOT touch the auth session
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
            {lang === 'fr' ? 'Connectez un calendrier pour synchroniser vos tâches.' : 'Connect a calendar to sync your tasks.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{lang === 'fr' ? 'Service' : 'Service'}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROVIDER_CONFIG) as CalendarProvider[]).filter(p => p !== 'LOCAL').map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm border transition-all text-left ${
                    provider === p ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span>{PROVIDER_CONFIG[p].icon}</span>
                  <span className="font-medium">{PROVIDER_CONFIG[p].label}</span>
                </button>
              ))}
            </div>
          </div>

          {!config.connectProvider && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{lang === 'fr' ? 'Nom affiché' : 'Display name'}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={config.label} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{lang === 'fr' ? 'Couleur' : 'Color'}</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {isDemo && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
              {lang === 'fr'
                ? 'La synchronisation calendrier n\'est pas disponible en mode démo.'
                : 'Calendar sync is not available in demo mode.'}
            </div>
          )}

          {!isDemo && config.connectProvider && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              {lang === 'fr'
                ? `Vous serez redirigé vers ${config.label} pour autoriser l'accès au calendrier. Votre session restera active.`
                : `You'll be redirected to ${config.label} to authorize calendar access. Your current session will stay active.`}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleAdd} disabled={saving || (!config.connectProvider && !name.trim())}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {config.connectProvider ? (lang === 'fr' ? 'Connecter' : 'Connect') : t('save', lang)}
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
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [showAddCalendar, setShowAddCalendar] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [editAccount, setEditAccount] = useState<CalendarAccount | null>(null)

  // Surface OAuth result toasts
  useEffect(() => {
    const success = searchParams.get('cal_success')
    const error = searchParams.get('cal_error')
    if (success === 'connected') toast({ title: language === 'fr' ? 'Calendrier connecté !' : 'Calendar connected!', variant: 'success' })
    if (success === 'reauthorized') toast({ title: language === 'fr' ? 'Calendrier ré-autorisé !' : 'Calendar re-authorized!', variant: 'success' })
    if (error === 'access_denied') toast({ title: language === 'fr' ? 'Accès refusé.' : 'Access denied.', variant: 'error' })
    if (error) toast({ title: `OAuth error: ${error}`, variant: 'error' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/calendar/accounts')
    setCalendarAccounts(await res.json())
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
      toast({ title: language === 'fr' ? 'Calendrier ajouté !' : 'Calendar added!', variant: 'success' })
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
      toast({ title: language === 'fr' ? 'Calendrier modifié !' : 'Calendar updated!', variant: 'success' })
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
    toast({ title: language === 'fr' ? 'Calendrier supprimé' : 'Calendar removed', variant: 'info' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-6 py-5 border-b border-gray-100 bg-white">
        <Settings className="h-5 w-5 text-indigo-600 mr-2" />
        <h1 className="text-xl font-bold text-gray-900">{t('settings', language)}</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl flex flex-col gap-8">

        {/* Language */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-500" />
            {t('language', language)}
          </h2>
          <div className="flex gap-3">
            {(['fr', 'en'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-all ${
                  language === lang ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {language === lang && <Check className="h-3.5 w-3.5" />}
                {lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
              </button>
            ))}
          </div>
        </section>

        {/* Connected calendars */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              {t('connectedAccounts', language)}
              <Badge variant="secondary">{calendarAccounts.length}</Badge>
            </h2>
            <Button size="sm" onClick={() => setShowAddCalendar(true)}>
              <Plus className="h-4 w-4" />
              {t('connectCalendar', language)}
            </Button>
          </div>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : calendarAccounts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
              <Calendar className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{language === 'fr' ? 'Aucun calendrier connecté' : 'No calendar connected'}</p>
              <p className="text-xs text-gray-400 mt-1">
                {language === 'fr' ? 'Connectez Google, Outlook, Apple ou Notion' : 'Connect Google, Outlook, Apple, or Notion'}
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
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-indigo-500" />
            {language === 'fr' ? 'Application' : 'Application'}
          </h2>
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-sm font-medium text-gray-900">FlowPlan</p>
            <p className="text-xs text-gray-500 mt-0.5">v0.1.0 — {language === 'fr' ? 'Planification intelligente' : 'Smart planning'}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-indigo-600">
              <Check className="h-3.5 w-3.5" />
              {language === 'fr' ? 'PWA — Installable sur mobile' : 'PWA — Installable on mobile'}
            </div>
          </div>
        </section>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'fr' ? 'Supprimer ce calendrier ?' : 'Remove this calendar?'}
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Les tâches associées ne seront pas supprimées.' : 'Associated tasks will not be deleted.'}
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
