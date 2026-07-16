'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MousePointerClick, Sparkles, ChevronRight, X } from 'lucide-react'

type Lang = 'fr' | 'en' | 'zh'

interface StepCopy { title: string; desc: string }

interface Step {
  key: string
  /** CSS selector of the element to spotlight; undefined = free-floating card */
  target?: string
  /** How the tour advances: user clicks the target / user reaches a route / presses Next */
  advance: 'click' | 'route' | 'manual'
  route?: string
  placement?: 'right' | 'bottom' | 'left' | 'top'
  /** Dim the rest of the screen (spotlight steps + welcome/done) */
  dim?: boolean
  /** Centered modal card (welcome / done) */
  centered?: boolean
  copy: Record<Lang, StepCopy>
}

const STEPS: Step[] = [
  {
    key: 'welcome',
    advance: 'manual',
    dim: true,
    centered: true,
    copy: {
      zh: { title: '歡迎來到 Kairos', desc: 'Kairos 在希臘語中意指「對的時刻」。接下來的導覽會帶你實際操作:點按鈕、切頁面,大約一分鐘。你隨時可以略過。' },
      en: { title: 'Welcome to Kairos', desc: 'Kairos is Greek for "the right moment". This tour is hands-on: you\'ll click real buttons and switch pages — about one minute. You can skip anytime.' },
      fr: { title: 'Bienvenue sur Kairos', desc: 'Kairos signifie « le bon moment » en grec. Ce guide est interactif : vous cliquerez sur de vrais boutons et changerez de page — environ une minute. Vous pouvez passer à tout moment.' },
    },
  },
  {
    key: 'nav-today',
    target: '[data-tour="nav-today"]',
    advance: 'route',
    route: '/today',
    placement: 'right',
    dim: true,
    copy: {
      zh: { title: '先到「今日」', desc: '點擊左側發亮的選單,前往每天的起點。' },
      en: { title: 'Head to Today', desc: 'Click the highlighted menu item to open your daily starting point.' },
      fr: { title: "Direction Aujourd'hui", desc: "Cliquez sur l'élément de menu en surbrillance pour ouvrir votre point de départ quotidien." },
    },
  },
  {
    key: 'add-task',
    target: '[data-tour="add-task"]',
    advance: 'click',
    route: '/today',
    placement: 'bottom',
    dim: true,
    copy: {
      zh: { title: '建立第一個任務', desc: '點擊「新增任務」按鈕,親手建立一個任務試試。' },
      en: { title: 'Create your first task', desc: 'Click the "Add task" button and create one yourself.' },
      fr: { title: 'Créez votre première tâche', desc: 'Cliquez sur « Ajouter une tâche » et créez-en une vous-même.' },
    },
  },
  {
    key: 'task-form',
    advance: 'manual',
    copy: {
      zh: { title: '設定重要性與緊急性', desc: '拖動兩個滑桿,Kairos 會自動計算優先度。填好按「儲存」— 完成(或關閉表單)後,按這裡的「下一步」。' },
      en: { title: 'Set importance & urgency', desc: 'Move the two sliders — Kairos computes the priority for you. Save the task (or close the form), then press Next here.' },
      fr: { title: "Réglez importance et urgence", desc: 'Déplacez les deux curseurs — Kairos calcule la priorité pour vous. Enregistrez la tâche (ou fermez le formulaire), puis appuyez sur Suivant ici.' },
    },
  },
  {
    key: 'nav-matrix',
    target: '[data-tour="nav-matrix"]',
    advance: 'route',
    route: '/matrix',
    placement: 'right',
    dim: true,
    copy: {
      zh: { title: '前往「矩陣」', desc: '點擊「矩陣」,看你的任務如何依重要 × 緊急自動分類。' },
      en: { title: 'Go to the Matrix', desc: 'Click "Matrix" to see your tasks sorted by importance × urgency.' },
      fr: { title: 'Ouvrez la Matrice', desc: 'Cliquez sur « Matrice » pour voir vos tâches triées par importance × urgence.' },
    },
  },
  {
    key: 'matrix-info',
    advance: 'manual',
    copy: {
      zh: { title: '四象限,一目了然', desc: '「立即執行」的事先做。試著拖曳一張任務卡到別的象限 — 優先度會即時更新。' },
      en: { title: 'Four quadrants at a glance', desc: 'Do First comes first. Try dragging a task card into another quadrant — its priority updates instantly.' },
      fr: { title: "Quatre quadrants, tout est clair", desc: "« À faire » d'abord. Essayez de glisser une carte vers un autre quadrant — sa priorité se met à jour instantanément." },
    },
  },
  {
    key: 'nav-calendar',
    target: '[data-tour="nav-calendar"]',
    advance: 'route',
    route: '/calendar',
    placement: 'right',
    dim: true,
    copy: {
      zh: { title: '前往「日曆」', desc: '點擊「日曆」,行程與任務在同一個畫面規劃。' },
      en: { title: 'Go to the Calendar', desc: 'Click "Calendar" — events and tasks planned in one view.' },
      fr: { title: 'Ouvrez le Calendrier', desc: 'Cliquez sur « Calendrier » — événements et tâches dans une seule vue.' },
    },
  },
  {
    key: 'calendar-info',
    advance: 'manual',
    copy: {
      zh: { title: '連接你的日曆', desc: '之後可在「設定」連接 Google、Outlook、Apple 或 Notion 日曆,行程會自動同步進來;任務也能直接拖進時段。' },
      en: { title: 'Connect your calendars', desc: 'Later, connect Google, Outlook, Apple or Notion calendars in Settings — events sync in automatically, and tasks can be dragged onto time slots.' },
      fr: { title: 'Connectez vos calendriers', desc: 'Plus tard, connectez Google, Outlook, Apple ou Notion dans Paramètres — les événements se synchronisent, et les tâches se glissent sur les créneaux.' },
    },
  },
  {
    key: 'nav-habits',
    target: '[data-tour="nav-habits"]',
    advance: 'route',
    route: '/habits',
    placement: 'right',
    dim: true,
    copy: {
      zh: { title: '前往「習慣」', desc: '點擊「習慣」— 小事重複做,就是大改變。' },
      en: { title: 'Go to Habits', desc: 'Click "Habits" — small things, repeated, become big change.' },
      fr: { title: 'Ouvrez les Habitudes', desc: 'Cliquez sur « Habitudes » — les petits gestes répétés font les grands changements.' },
    },
  },
  {
    key: 'add-habit',
    target: '[data-tour="add-habit"]',
    advance: 'click',
    route: '/habits',
    placement: 'bottom',
    dim: true,
    copy: {
      zh: { title: '建立一個習慣', desc: '點擊「新增習慣」。每日打卡後,燭火會隨連續天數越燒越旺。' },
      en: { title: 'Create a habit', desc: 'Click "Add habit". Check in daily and the candle burns brighter with your streak.' },
      fr: { title: 'Créez une habitude', desc: "Cliquez sur « Ajouter une habitude ». Validez chaque jour et la bougie brille avec votre série." },
    },
  },
  {
    key: 'nav-retroplanning',
    target: '[data-tour="nav-retroplanning"]',
    advance: 'route',
    route: '/retroplanning',
    placement: 'right',
    dim: true,
    copy: {
      zh: { title: '最後一站:「逆向規劃」', desc: '建立或關閉表單後,點擊「逆向規劃」。' },
      en: { title: 'Last stop: Retroplanning', desc: 'Save or close the form, then click "Retroplanning".' },
      fr: { title: 'Dernière étape : Rétroplanification', desc: 'Enregistrez ou fermez le formulaire, puis cliquez sur « Rétroplanification ».' },
    },
  },
  {
    key: 'done',
    advance: 'manual',
    dim: true,
    centered: true,
    copy: {
      zh: { title: '完成!', desc: '在這裡給 Kairos 一個目標和截止日,它會倒推出每個階段。導覽結束 — 之後隨時可從頭像選單的「使用教學」重看。' },
      en: { title: 'All set!', desc: 'Here, give Kairos a goal and a deadline and it works backwards through every stage. Tour complete — replay it anytime from the avatar menu.' },
      fr: { title: 'Terminé !', desc: "Ici, donnez un objectif et une échéance à Kairos : il remonte chaque étape. Guide terminé — revoyez-le à tout moment depuis le menu avatar." },
    },
  },
]

const UI: Record<Lang, {
  start: string; skipTour: string; skipStep: string; next: string; finish: string
  clickHint: string; stepOf: (n: number, t: number) => string
}> = {
  zh: { start: '開始導覽', skipTour: '略過導覽', skipStep: '略過此步', next: '下一步', finish: '開始使用 Kairos', clickHint: '點擊發亮的按鈕', stepOf: (n, t) => `${n} / ${t}` },
  en: { start: 'Start tour', skipTour: 'Skip tour', skipStep: 'Skip step', next: 'Next', finish: 'Start using Kairos', clickHint: 'Click the highlighted button', stepOf: (n, t) => `${n} / ${t}` },
  fr: { start: 'Commencer', skipTour: 'Passer le guide', skipStep: 'Passer', next: 'Suivant', finish: 'Commencer avec Kairos', clickHint: 'Cliquez sur le bouton en surbrillance', stepOf: (n, t) => `${n} / ${t}` },
}

const CARD_W = 300
const CARD_EST_H = 190
const GAP = 14
const PAD = 6 // spotlight padding around target

function useTargetRect(selector: string | undefined, active: boolean, pathname: string) {
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const [missing, setMissing] = React.useState(false)
  const elRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    elRef.current = null
    setRect(null)
    setMissing(false)
    if (!active || !selector) return

    let cancelled = false
    let tries = 0
    let interval: ReturnType<typeof setInterval> | undefined

    const track = () => {
      if (cancelled || !elRef.current) return
      const r = elRef.current.getBoundingClientRect()
      setRect((prev) =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev : r
      )
    }

    const find = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(selector)
      if (el) {
        elRef.current = el
        track()
        interval = setInterval(track, 250)
      } else if (++tries < 16) {
        setTimeout(find, 300)
      } else {
        setMissing(true)
      }
    }
    find()

    window.addEventListener('resize', track)
    window.addEventListener('scroll', track, true)
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      window.removeEventListener('resize', track)
      window.removeEventListener('scroll', track, true)
    }
  }, [selector, active, pathname])

  return { rect, missing, elRef }
}

export function OnboardingTour() {
  const { language, onboardingOpen, completeOnboarding } = useAppStore()
  const pathname = usePathname()
  const [index, setIndex] = React.useState(0)
  const [mounted, setMounted] = React.useState(false)

  const ui = UI[language]
  const total = STEPS.length
  const step = STEPS[index]
  const copy = step.copy[language]
  const isLast = index === total - 1

  React.useEffect(() => { setMounted(true) }, [])

  // Auto-open once for first-time users (store rehydrated from localStorage by then)
  React.useEffect(() => {
    const { hasCompletedOnboarding: done, onboardingOpen: open } = useAppStore.getState()
    if (done || open) return
    const timer = setTimeout(() => useAppStore.getState().setOnboardingOpen(true), 700)
    return () => clearTimeout(timer)
  }, [])

  // Reset to first step each time the tour opens
  React.useEffect(() => { if (onboardingOpen) setIndex(0) }, [onboardingOpen])

  const finish = React.useCallback(() => completeOnboarding(), [completeOnboarding])
  const next = React.useCallback(() => {
    setIndex((i) => Math.min(i + 1, total - 1))
  }, [total])

  const { rect, missing } = useTargetRect(step.target, onboardingOpen, pathname)

  // Advance when the user reaches the step's route (also auto-skips if already there)
  React.useEffect(() => {
    if (!onboardingOpen) return
    if (step.advance === 'route' && step.route && pathname === step.route) next()
  }, [onboardingOpen, step, pathname, next])

  // Advance when the user clicks the spotlighted element.
  // Window-level capture + closest(): survives the page re-rendering the target node.
  React.useEffect(() => {
    if (!onboardingOpen || step.advance !== 'click' || !step.target) return
    const selector = step.target
    const handler = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest?.(selector)) setTimeout(next, 150) // let the app's own click handler run first
    }
    window.addEventListener('click', handler, true)
    return () => window.removeEventListener('click', handler, true)
  }, [onboardingOpen, step, next])

  // Esc skips the whole tour; → advances (same as skip-step/next).
  // Ignored while typing or while an app dialog (e.g. task form) is open —
  // Esc must close that dialog, not kill the tour.
  React.useEffect(() => {
    if (!onboardingOpen) return
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (
        t.closest('input, textarea, select, [contenteditable="true"]') ||
        (t.closest('[role="dialog"]') && !t.closest('[data-tour-root]'))
      )) return
      if (e.key === 'Escape') { e.preventDefault(); finish() }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (isLast) finish(); else next() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onboardingOpen, isLast, finish, next])

  if (!mounted || !onboardingOpen) return null

  const hasSpot = !!step.target && !!rect && !missing
  const floating = !step.centered && (!step.target || missing || !rect)

  // Tooltip position next to the target, clamped to the viewport
  let cardStyle: React.CSSProperties = {}
  if (hasSpot && rect) {
    const placement = step.placement ?? 'bottom'
    let top = 0, left = 0
    if (placement === 'right') { top = rect.top + rect.height / 2 - CARD_EST_H / 2; left = rect.right + PAD + GAP }
    if (placement === 'left') { top = rect.top + rect.height / 2 - CARD_EST_H / 2; left = rect.left - PAD - GAP - CARD_W }
    if (placement === 'bottom') { top = rect.bottom + PAD + GAP; left = rect.left + rect.width / 2 - CARD_W / 2 }
    if (placement === 'top') { top = rect.top - PAD - GAP - CARD_EST_H; left = rect.left + rect.width / 2 - CARD_W / 2 }
    top = Math.max(12, Math.min(top, window.innerHeight - CARD_EST_H - 12))
    left = Math.max(12, Math.min(left, window.innerWidth - CARD_W - 12))
    cardStyle = { top, left, width: CARD_W }
  }

  const progress = ((index + 1) / total) * 100

  const skipTourBtn = (
    <button onClick={finish} className="text-[11px] text-[#a99873] hover:text-[#5c5347] transition-colors">
      {ui.skipTour}
    </button>
  )

  return createPortal(
    <div aria-live="polite" data-tour-root>
      {/* Dim layer — visual only, never blocks the page (spotlight target stays clickable) */}
      {step.dim && !hasSpot && <div className="fixed inset-0 z-[80] bg-[#140c04]/55 backdrop-blur-[1px] animate-fade-in pointer-events-none" style={{ animationDuration: '0.25s' }} />}

      {/* Spotlight ring — the cutout dims everything around the target */}
      {hasSpot && rect && (
        <div
          className="fixed z-[80] rounded-2xl pointer-events-none transition-all duration-300"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(20,12,4,0.55), 0 0 0 3px rgba(255,210,122,0.9), 0 0 22px 4px rgba(255,210,122,0.45)',
          }}
        />
      )}

      {/* ── Centered card (welcome / done) ── */}
      {step.centered && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none">
          <div
            role="dialog"
            aria-label={copy.title}
            className="pointer-events-auto w-full max-w-[420px] rounded-3xl bg-[#fbf7ee] border border-[rgba(168,127,62,0.25)] shadow-2xl shadow-black/40 overflow-hidden animate-fade-in-scale"
          >
            <div className="relative h-[110px] bg-[#2a1d10] flex items-center justify-center"
              style={{ backgroundImage: 'radial-gradient(ellipse 70% 90% at 50% 100%, rgba(255,210,122,0.14), transparent)' }}>
              <div className="absolute top-3.5 right-3.5 h-8 w-8 rotate-6 rounded-[4px] bg-[#ab3326]/90 shadow-md flex items-center justify-center select-none">
                <span className="text-[11px] leading-[1.05] text-[#f3ecdd] text-center" style={{ fontFamily: 'var(--font-brush)' }}>墨<br />時</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_v5/Logo.png" alt="Kairos" className="h-14 w-14 rounded-2xl object-cover shadow-lg shadow-black/40" />
            </div>
            <div className="px-6 pt-5 pb-4">
              <h2 className="font-serif text-[21px] font-semibold text-[#2a2420]">{copy.title}</h2>
              <p className="mt-2 text-sm text-[#8a7a5e] leading-relaxed">{copy.desc}</p>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#ece2cb] bg-[#f7f1e3]">
              {index === 0 ? skipTourBtn : <span />}
              <Button size="sm" onClick={isLast ? finish : next}>
                {isLast ? <Sparkles className="h-3.5 w-3.5" /> : null}
                {index === 0 ? ui.start : ui.finish}
                {index === 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Anchored tooltip (spotlight steps) / floating card (info steps) ── */}
      {!step.centered && (
        <div
          role="dialog"
          aria-label={copy.title}
          className={cn(
            'fixed z-[90] rounded-2xl bg-[#fbf7ee] border border-[rgba(168,127,62,0.3)] shadow-2xl shadow-black/35 overflow-hidden animate-fade-in-scale',
            floating && 'bottom-6 left-1/2 -translate-x-1/2 w-[340px] max-w-[calc(100vw-2rem)]'
          )}
          style={floating ? undefined : cardStyle}
          key={step.key}
        >
          {/* progress */}
          <div className="h-[3px] bg-[#ece2cb]">
            <div className="h-full bg-gradient-to-r from-[#a87f3e] to-[#ffd27a] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="px-4 pt-3 pb-2 relative">
            <button onClick={finish} aria-label={ui.skipTour} className="absolute right-2.5 top-2.5 p-1 rounded-lg text-[#a99873] hover:text-[#5c5347] hover:bg-[#ece2cb] transition-all">
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#a87f3e]">{ui.stepOf(index + 1, total)}</span>
            <h2 className="font-serif text-[17px] font-semibold text-[#2a2420] mt-0.5 pr-5">{copy.title}</h2>
            <p className="mt-1 text-[13px] text-[#8a7a5e] leading-relaxed">{copy.desc}</p>
            {step.advance !== 'manual' && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#ab3326]">
                <MousePointerClick className="h-3.5 w-3.5 animate-float" />
                {ui.clickHint}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#ece2cb] bg-[#f7f1e3]">
            {skipTourBtn}
            {step.advance === 'manual' ? (
              <Button size="sm" onClick={next}>
                {ui.next}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <button onClick={next} className="text-[11px] text-[#8a7a5e] hover:text-[#5c5347] transition-colors underline underline-offset-2">
                {ui.skipStep}
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
