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
import { signIn } from 'next-auth/react'
import {
  Settings, Plus, Trash2, Globe, Calendar, Check,
  MonitorSmartphone, Loader2, AlertTriangle,
} from 'lucide-react'
import { useGlobalToast } from '@/components/providers/ToastProvider'

const PROVIDER_CONFIG: Record<CalendarProvider, { label: string; icon: string; color: string; oauthKey?: string }> = {
  GOOGLE: { label: 'Google Calendar', icon: '🔵', color: '#4285F4', oauthKey: 'google' },
  OUTLOOK: { label: 'Outlook Calendar', icon: '🟦', color: '#0078D4', oauthKey: 'microsoft-entra-id' },
  APPLE: { label: 'Apple Calendar', icon: '⚫', color: '#1C1C1E' },
  NOTION: { label: 'Notion', icon: '⬜', color: '#000000' },
  LOCAL: { label: 'Local', icon: '📅', color: '#6366F1' },
}

const COLORS = ['#4F46E5', '#7C3AED', '#DC2626', '#16A34A', '#D97706', '#0891B2', '#DB2777', '#059669']

function AddCalendarDialog({ open, onClose, onAdd, lang }: {
  open: boolean
  onClose: () => void
  onAdd: (data: { provider: CalendarProvider; name: string; color: string }) => Promise<void>
  lang: 'fr' | 'en'
}) {
  const [provider, setProvider] = useState<CalendarProvider>('GOOGLE')
  const [name, setName] = useState('')
  const [color, setColor] = useState('#4F46E5')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!name.trim()) return
    setSaving(true)
    const config = PROVIDER_CONFIG[provider]
    if (config.oauthKey) {
      await signIn(config.oauthKey, { callbackUrl: '/settings' })
      return
    }
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
          {!PROVIDER_CONFIG[provider].oauthKey && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>{lang === 'fr' ? 'Nom affiché' : 'Display name'}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={PROVIDER_CONFIG[provider].label} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{lang === 'fr' ? 'Couleur' : 'Color'}</Label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </>
          )}
          {PROVIDER_CONFIG[provider].oauthKey && (
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-blue-700">
              {lang === 'fr'
                ? `Vous serez redirigé vers ${PROVIDER_CONFIG[provider].label} pour autoriser l'accès à votre calendrier.`
                : `You'll be redirected to ${PROVIDER_CONFIG[provider].label} to authorize calendar access.`}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('cancel', lang)}</Button>
          <Button onClick={handleAdd} disabled={saving || (!PROVIDER_CONFIG[provider].oauthKey && !name.trim())}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {PROVIDER_CONFIG[provider].oauthKey ? (lang === 'fr' ? 'Connecter' : 'Connect') : t('save', lang)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function SettingsPage() {
  const { language, setLanguage, calendarAccounts, setCalendarAccounts } = useAppStore()
  const { toast } = useGlobalToast()
  const [loading, setLoading] = useState(true)
  const [showAddCalendar, setShowAddCalendar] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
              {calendarAccounts.map((account) => {
                const config = PROVIDER_CONFIG[account.provider as CalendarProvider]
                return (
                  <div key={account.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: config?.color + '15' }}>
                        {config?.icon ?? '📅'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{account.name}</p>
                        <p className="text-xs text-gray-500">{config?.label ?? account.provider}</p>
                      </div>
                      <div className="h-3 w-3 rounded-full border border-white shadow" style={{ backgroundColor: account.color }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success" className="text-xs">
                        {language === 'fr' ? 'Connecté' : 'Connected'}
                      </Badge>
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

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

      <AddCalendarDialog open={showAddCalendar} onClose={() => setShowAddCalendar(false)} onAdd={handleAddCalendar} lang={language} />
    </div>
  )
}
