'use client'

import React, { useState, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { t } from '@/lib/i18n'
import { cn, getQuadrant } from '@/lib/utils'
import { EISENHOWER_QUADRANTS, QUADRANT_LABEL_ZH, type EisenhowerQuadrant, type MonthlyStats } from '@/types'
import { Sundial } from '@/components/ui/Sundial'
import {
  ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlarmClock, Flame, TrendingUp, TrendingDown, Minus,
} from 'lucide-react'
import { format, parse } from 'date-fns'
import { fr, enUS, zhTW } from 'date-fns/locale'

export interface FilterAccount {
  id: string
  name: string
  color: string
  subCalendars: { externalId: string; name: string; color: string }[]
}

const MONTHS_SHOWN = 12

/** One accent hue for the whole chart: a single series, emphasis on the month being reviewed. */
const BAR_SELECTED = '#ab3326'
const BAR_REST = '#dcb9a4'
const BAR_EMPTY = '#ece2cb'

const COPY = {
  fr: {
    subtitle: 'Volume de tâches terminées et bilan du mois',
    account: 'Compte', calendar: 'Calendrier', all: 'Tous', noCalendar: 'Sans calendrier',
    chartTitle: 'Tâches terminées par mois', chartHint: 'Cliquez sur un mois pour le passer en revue',
    table: 'Voir le tableau', month: 'Mois', done: 'Terminées', due: 'Échéances',
    completedTile: 'Terminées ce mois', rate: 'Taux de complétion', late: 'En retard', habits: 'Habitudes',
    rateHint: 'des échéances du mois', lateHint: 'échéances dépassées', habitsHint: 'habitudes cochées',
    vs: 'vs', noPrev: 'pas de mois précédent',
    breakdown: 'Répartition Eisenhower', highlights: 'Faits marquants',
    activeDays: 'Jours actifs', activeDaysHint: 'jours avec au moins une tâche terminée',
    bestDay: 'Meilleure journée', open: 'Encore ouvertes', dueThisMonth: 'Échéances ce mois',
    reviewTitle: 'Terminées en', nothing: 'Rien de terminé ce mois-ci.',
    nothingBreakdown: 'Aucune tâche terminée à répartir.',
    today: 'Ce mois',
  },
  en: {
    subtitle: 'Completion volume and the month in review',
    account: 'Account', calendar: 'Calendar', all: 'All', noCalendar: 'No calendar',
    chartTitle: 'Tasks completed per month', chartHint: 'Click a month to review it',
    table: 'Show table', month: 'Month', done: 'Completed', due: 'Due',
    completedTile: 'Completed this month', rate: 'Completion rate', late: 'Overdue', habits: 'Habits',
    rateHint: 'of what was due this month', lateHint: 'deadlines passed', habitsHint: 'habits ticked off',
    vs: 'vs', noPrev: 'no previous month',
    breakdown: 'Eisenhower split', highlights: 'Highlights',
    activeDays: 'Active days', activeDaysHint: 'days with at least one task completed',
    bestDay: 'Best day', open: 'Still open', dueThisMonth: 'Due this month',
    reviewTitle: 'Completed in', nothing: 'Nothing completed this month.',
    nothingBreakdown: 'No completed tasks to break down.',
    today: 'This month',
  },
  zh: {
    subtitle: '每月任務達標量與月度回顧',
    account: '帳號', calendar: '日曆', all: '全部', noCalendar: '無日曆',
    chartTitle: '每月完成任務數', chartHint: '點選月份即可回顧該月',
    table: '顯示表格', month: '月份', done: '已完成', due: '到期',
    completedTile: '本月完成', rate: '達標率', late: '逾期', habits: '習慣',
    rateHint: '本月到期任務的完成比例', lateHint: '已過期的到期任務', habitsHint: '習慣打卡次數',
    vs: '相較', noPrev: '沒有前一個月資料',
    breakdown: '艾森豪矩陣分佈', highlights: '本月亮點',
    activeDays: '活躍天數', activeDaysHint: '至少完成一項任務的天數',
    bestDay: '最佳單日', open: '尚未完成', dueThisMonth: '本月到期',
    reviewTitle: '完成於', nothing: '本月尚無完成的任務。',
    nothingBreakdown: '沒有可分佈的已完成任務。',
    today: '本月',
  },
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const currentMonthKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ReviewClient({ initialStats, accounts }: {
  initialStats: MonthlyStats | null
  accounts: FilterAccount[]
}) {
  const { language } = useAppStore()
  const copy = COPY[language]
  const locale = language === 'fr' ? fr : language === 'zh' ? zhTW : enUS

  const [stats, setStats] = useState<MonthlyStats | null>(initialStats)
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(initialStats?.summary.key ?? currentMonthKey())
  const [accountId, setAccountId] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const reqSeq = useRef(0)

  const monthDate = parse(month, 'yyyy-MM', new Date())
  const monthLabel = format(monthDate, language === 'zh' ? 'yyyy 年 M 月' : 'MMMM yyyy', { locale })
  const selectedAccount = accounts.find((a) => a.id === accountId)

  /**
   * Every control routes through here, so the request that lands last is always
   * the one the user asked for — a slow response for a filter they already
   * moved past can't overwrite the view.
   */
  const load = async (next: { month?: string; accountId?: string; calendarId?: string }) => {
    const m = next.month ?? month
    const a = next.accountId ?? accountId
    const c = next.calendarId ?? calendarId
    setMonth(m); setAccountId(a); setCalendarId(c); setLoading(true)
    const seq = ++reqSeq.current
    try {
      const params = new URLSearchParams({ month: m, months: String(MONTHS_SHOWN) })
      if (a) params.set('accountId', a)
      if (a && a !== 'none' && c) params.set('calendarId', c)
      const res = await fetch(`/api/stats/monthly?${params}`)
      if (seq !== reqSeq.current) return
      if (res.ok) setStats(await res.json())
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }

  const months = stats?.months ?? []
  const maxCompleted = Math.max(1, ...months.map((m) => m.completed))
  const summary = stats?.summary
  const delta = summary && summary.previousCompleted !== null ? summary.completed - summary.previousCompleted : null
  const prevMonthLabel = format(parse(shiftMonth(month, -1), 'yyyy-MM', new Date()), 'MMMM', { locale })

  const quadrantLabel = (q: EisenhowerQuadrant) =>
    language === 'fr' ? q.labelFr : language === 'zh' ? QUADRANT_LABEL_ZH[q.id] : q.label
  const quadrantDot: Record<EisenhowerQuadrant['id'], string> = {
    'do-first': '#b91c1c', schedule: '#1d4ed8', delegate: '#b45309', eliminate: '#8a7a5e',
  }

  // Completed tasks grouped by the day they were finished, newest day first.
  const byDay = React.useMemo(() => {
    const groups = new Map<string, MonthlyStats['completedTasks']>()
    for (const task of stats?.completedTasks ?? []) {
      const day = task.completedAt.slice(0, 10)
      const list = groups.get(day)
      if (list) list.push(task)
      else groups.set(day, [task])
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [stats])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-[72px] shrink-0 border-b border-[#e2d6bc] bg-[#fbf7ee] sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <Sundial className="h-8 w-8" />
            <h1 className="text-2xl font-serif text-[#2a2420] tracking-tight leading-none">{t('review', language)}</h1>
          </div>
          <p className="text-[13px] text-[#8a7a5e] mt-1 pl-[42px]">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[#e2d6bc] bg-white/60 px-1 py-1">
          <button
            onClick={() => load({ month: shiftMonth(month, -1) })}
            className="p-1 rounded-lg hover:bg-[#f3ecdd] text-[#8a7a5e] transition-colors"
            aria-label={copy.month}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-medium text-[#3a3326] min-w-[130px] text-center first-letter:uppercase">{monthLabel}</span>
          <button
            onClick={() => load({ month: shiftMonth(month, 1) })}
            disabled={month >= currentMonthKey()}
            className="p-1 rounded-lg hover:bg-[#f3ecdd] text-[#8a7a5e] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label={copy.month}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {month !== currentMonthKey() && (
            <button
              onClick={() => load({ month: currentMonthKey() })}
              className="ml-0.5 px-1.5 py-0.5 rounded-lg text-[10px] bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
            >
              {copy.today}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 animate-fade-in">
        {/* Filters — one row, above everything they scope */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-[#8a7a5e]">
            {copy.account}
            <select
              value={accountId}
              onChange={(e) => load({ accountId: e.target.value, calendarId: '' })}
              className="rounded-xl border border-[#e2d6bc] bg-[#fbf7ee] px-2.5 py-1.5 text-xs text-[#3a3326] focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30"
            >
              <option value="">{copy.all}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              <option value="none">{copy.noCalendar}</option>
            </select>
          </label>
          {selectedAccount && selectedAccount.subCalendars.length > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-[#8a7a5e]">
              {copy.calendar}
              <select
                value={calendarId}
                onChange={(e) => load({ calendarId: e.target.value })}
                className="rounded-xl border border-[#e2d6bc] bg-[#fbf7ee] px-2.5 py-1.5 text-xs text-[#3a3326] focus:outline-none focus:ring-2 focus:ring-[#ab3326]/30"
              >
                <option value="">{copy.all}</option>
                {selectedAccount.subCalendars.map((sc) => (
                  <option key={sc.externalId} value={sc.externalId}>{sc.name}</option>
                ))}
              </select>
            </label>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#a99873]" />}
        </div>

        {/* Stat tiles — the hero is the month's completion count */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-[#e2d6bc] bg-gradient-to-br from-[#ab3326]/[0.07] to-[#b08948]/[0.05] paper-surface p-5 md:col-span-1">
            <p className="text-xs font-medium text-[#861f17]">{copy.completedTile}</p>
            <p className="text-5xl font-bold text-[#2a2420] leading-none mt-2">{summary?.completed ?? 0}</p>
            <p className="text-[11px] text-[#8a7a5e] mt-2 flex items-center gap-1">
              {delta === null ? copy.noPrev : (
                <>
                  {delta > 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                    : delta < 0 ? <TrendingDown className="h-3 w-3 text-[#ab3326]" />
                    : <Minus className="h-3 w-3 text-[#a99873]" />}
                  <span className={cn(delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-[#ab3326]' : 'text-[#8a7a5e]')}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                  <span>{copy.vs} <span className="first-letter:uppercase">{prevMonthLabel}</span></span>
                </>
              )}
            </p>
          </div>
          {[
            {
              label: copy.rate,
              value: summary?.completionRate === null || summary === undefined ? '—' : `${summary.completionRate}%`,
              hint: copy.rateHint,
              icon: CheckCircle2,
              tint: 'text-[#3d5a4b]',
            },
            {
              label: copy.late,
              value: summary?.openOverdue ?? 0,
              hint: copy.lateHint,
              icon: AlarmClock,
              tint: 'text-[#861f17]',
            },
            {
              label: copy.habits,
              value: summary?.habitCompletions ?? 0,
              hint: copy.habitsHint,
              icon: Flame,
              tint: 'text-[#8a6a32]',
            },
          ].map(({ label, value, hint, icon: Icon, tint }) => (
            <div key={label} className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] paper-surface p-5">
              <p className={cn('text-xs font-medium flex items-center gap-1.5', tint)}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </p>
              <p className="text-3xl font-bold text-[#2a2420] leading-none mt-2">{value}</p>
              <p className="text-[11px] text-[#a99873] mt-2">{hint}</p>
            </div>
          ))}
        </div>

        {/* Monthly volume — one series, the reviewed month emphasised */}
        <div className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] paper-surface p-5">
          <div className="flex items-baseline justify-between gap-3 mb-5">
            <h2 className="text-sm font-semibold text-[#2a1f12]">{copy.chartTitle}</h2>
            <span className="text-[11px] text-[#a99873]">{copy.chartHint}</span>
          </div>

          {/* Bars grow from one baseline; the month labels sit below the rule. */}
          <div className="flex items-end gap-2 h-[150px] border-b border-[#e2d6bc]">
            {months.map((m) => {
              const selected = m.key === month
              const pct = (m.completed / maxCompleted) * 100
              const label = format(parse(m.key, 'yyyy-MM', new Date()), language === 'zh' ? 'M月' : 'MMM', { locale })
              return (
                <button
                  key={m.key}
                  onClick={() => load({ month: m.key })}
                  className="group relative flex-1 h-full flex flex-col justify-end items-center gap-1 focus:outline-none"
                  aria-label={`${label} — ${m.completed}`}
                  aria-pressed={selected}
                >
                  {/* Tooltip: value first, month second — on hover and on keyboard focus */}
                  <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block group-focus-visible:block rounded-lg border border-[#e2d6bc] bg-white px-2 py-1 text-center shadow-md whitespace-nowrap">
                    <span className="block text-xs font-bold text-[#2a2420] leading-none">{m.completed}</span>
                    <span className="block text-[10px] text-[#8a7a5e] mt-0.5">
                      <span className="first-letter:uppercase">{label}</span> · {copy.due} {m.due}
                    </span>
                  </span>
                  {selected && m.completed > 0 && (
                    <span className="text-[11px] font-semibold text-[#861f17] leading-none">{m.completed}</span>
                  )}
                  <span
                    className={cn(
                      'w-full max-w-[24px] rounded-t-[4px] transition-all duration-200',
                      !selected && 'group-hover:brightness-95'
                    )}
                    style={{
                      height: m.completed > 0 ? `max(${pct}%, 6px)` : '2px',
                      backgroundColor: m.completed > 0 ? (selected ? BAR_SELECTED : BAR_REST) : BAR_EMPTY,
                    }}
                  />
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 mt-1.5">
            {months.map((m) => {
              const selected = m.key === month
              const label = format(parse(m.key, 'yyyy-MM', new Date()), language === 'zh' ? 'M月' : 'MMM', { locale })
              return (
                <span
                  key={m.key}
                  className={cn(
                    'flex-1 text-center text-[10px] leading-none first-letter:uppercase',
                    selected ? 'text-[#861f17] font-semibold' : 'text-[#a99873]'
                  )}
                >
                  {label}
                </span>
              )
            })}
          </div>

          {/* Every value stays reachable without hovering */}
          <details className="mt-1">
            <summary className="text-[11px] text-[#8a7a5e] cursor-pointer hover:text-[#3a3326] w-fit">{copy.table}</summary>
            <table className="mt-2 w-full text-xs tabular-nums">
              <thead>
                <tr className="text-[#a99873] text-left">
                  <th className="font-medium py-1">{copy.month}</th>
                  <th className="font-medium py-1 text-right">{copy.done}</th>
                  <th className="font-medium py-1 text-right">{copy.due}</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key} className={cn('border-t border-[#f0e7d4]', m.key === month && 'font-semibold text-[#861f17]')}>
                    <td className="py-1 first-letter:uppercase">{format(parse(m.key, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale })}</td>
                    <td className="py-1 text-right">{m.completed}</td>
                    <td className="py-1 text-right">{m.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Eisenhower split — labels carry identity, length carries magnitude */}
          <div className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] paper-surface p-5">
            <h2 className="text-sm font-semibold text-[#2a1f12] mb-4">{copy.breakdown}</h2>
            {summary && summary.completed > 0 ? (
              <div className="flex flex-col gap-3">
                {EISENHOWER_QUADRANTS.map((q) => {
                  const count = summary.byQuadrant[q.id] ?? 0
                  const pct = summary.completed > 0 ? (count / summary.completed) * 100 : 0
                  return (
                    <div key={q.id} className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: quadrantDot[q.id] }} />
                      <span className="text-xs text-[#5c5347] w-32 shrink-0 truncate">{quadrantLabel(q)}</span>
                      <span className="flex-1 h-2 rounded-full bg-[#f0e7d4] overflow-hidden">
                        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: quadrantDot[q.id] }} />
                      </span>
                      <span className="text-xs font-semibold text-[#3a3326] w-10 text-right tabular-nums">{count}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-[#a99873]">{copy.nothingBreakdown}</p>
            )}
          </div>

          {/* Highlights */}
          <div className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] paper-surface p-5">
            <h2 className="text-sm font-semibold text-[#2a1f12] mb-4">{copy.highlights}</h2>
            <dl className="flex flex-col gap-3 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[#5c5347]">{copy.activeDays}<span className="block text-[10px] text-[#a99873]">{copy.activeDaysHint}</span></dt>
                <dd className="text-lg font-bold text-[#2a2420] tabular-nums">{summary?.activeDays ?? 0}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[#f0e7d4] pt-3">
                <dt className="text-[#5c5347]">{copy.bestDay}</dt>
                <dd className="text-right">
                  {summary?.bestDay ? (
                    <>
                      <span className="text-lg font-bold text-[#2a2420] tabular-nums">{summary.bestDay.count}</span>
                      <span className="block text-[10px] text-[#a99873]">
                        {format(parse(summary.bestDay.date, 'yyyy-MM-dd', new Date()), language === 'zh' ? 'M月d日' : 'd MMM', { locale })}
                      </span>
                    </>
                  ) : <span className="text-[#a99873]">—</span>}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[#f0e7d4] pt-3">
                <dt className="text-[#5c5347]">{copy.open}</dt>
                <dd className="text-lg font-bold text-[#2a2420] tabular-nums">{summary?.stillOpen ?? 0}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[#f0e7d4] pt-3">
                <dt className="text-[#5c5347]">{copy.dueThisMonth}</dt>
                <dd className="text-lg font-bold text-[#2a2420] tabular-nums">{summary?.due ?? 0}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* The review itself: what actually got done, day by day */}
        <div className="rounded-2xl border border-[#e2d6bc] bg-[#fbf7ee] paper-surface p-5">
          <h2 className="text-sm font-semibold text-[#2a1f12] mb-4">
            {copy.reviewTitle} {monthLabel}
            <span className="ml-2 text-xs font-normal text-[#a99873]">{stats?.completedTasks.length ?? 0}</span>
          </h2>
          {byDay.length === 0 ? (
            <p className="text-xs text-[#a99873]">{copy.nothing}</p>
          ) : (
            <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
              {byDay.map(([day, items]) => (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-[#8a6b3e] first-letter:uppercase">
                      {format(parse(day, 'yyyy-MM-dd', new Date()), language === 'zh' ? 'M月d日 EEEE' : 'EEEE d MMMM', { locale })}
                    </span>
                    <span className="flex-1 h-px bg-[#f0e7d4]" />
                    <span className="text-[10px] text-[#a99873] tabular-nums">{items.length}</span>
                  </div>
                  <ul className="flex flex-col gap-1">
                    {items.map((task) => (
                      <li key={task.id} className="flex items-center gap-2 text-xs text-[#5c5347]">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: quadrantDot[getQuadrant(task.importance, task.urgency)] }}
                        />
                        <span className="truncate">{task.title}</span>
                        {task.isSubTask && <span className="text-[9px] text-[#c4b48a] shrink-0">↳</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
