'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Zap, LayoutGrid, Calendar, Repeat2, GitBranch,
  Check, ChevronLeft, ChevronRight, Sparkles,
} from 'lucide-react'

type Lang = 'fr' | 'en' | 'zh'

interface StepCopy {
  eyebrow: string
  title: string
  desc: string
  tips: string[]
}

interface Step {
  key: string
  icon: React.ElementType | null // null = Kairos logo
  accent: string                 // icon / dot accent color
  copy: Record<Lang, StepCopy>
}

const STEPS: Step[] = [
  {
    key: 'welcome',
    icon: null,
    accent: '#ffd27a',
    copy: {
      zh: {
        eyebrow: '墨時 · TIME, INKED.',
        title: '歡迎來到 Kairos',
        desc: 'Kairos 在希臘語中意指「對的時刻」。這裡不只管理時間，更幫你掌握時機 — 花一分鐘，認識五個核心功能。',
        tips: ['支援中文、English、Français 三種語言', '你的資料安全儲存，無廣告追蹤', '隨時可從頭像選單重看本導覽'],
      },
      en: {
        eyebrow: 'TIME, INKED.',
        title: 'Welcome to Kairos',
        desc: 'Kairos is Greek for "the right moment". More than managing time, it helps you seize it — take a minute to meet the five core features.',
        tips: ['Available in English, Français and 中文', 'Your data is stored securely, no ad tracking', 'Replay this tour anytime from the avatar menu'],
      },
      fr: {
        eyebrow: 'TIME, INKED.',
        title: 'Bienvenue sur Kairos',
        desc: 'Kairos signifie « le bon moment » en grec. Plus que gérer votre temps, il vous aide à le saisir — prenez une minute pour découvrir les cinq fonctions clés.',
        tips: ['Disponible en français, English et 中文', 'Vos données sont stockées en sécurité, sans suivi publicitaire', 'Revoyez ce guide à tout moment depuis le menu avatar'],
      },
    },
  },
  {
    key: 'today',
    icon: Zap,
    accent: '#ffd27a',
    copy: {
      zh: {
        eyebrow: '第 1 站',
        title: '今日 — 每天的起點',
        desc: '左側是依優先度排序的待辦清單，右側是今日時程表。一眼掌握今天最該做的事。',
        tips: ['拖曳任務到時段，直接安排時間', '用 AI「智能拆解」把大任務變成可執行的步驟', '「早晨總結」為你生成今日重點'],
      },
      en: {
        eyebrow: 'Stop 1',
        title: 'Today — your daily starting point',
        desc: 'A priority-sorted to-do list on the left, your day schedule on the right. See at a glance what matters most today.',
        tips: ['Drag a task onto a time slot to schedule it', 'Use AI Smart Breakdown to split big tasks into steps', 'Generate a Morning Recap of your day'],
      },
      fr: {
        eyebrow: 'Étape 1',
        title: "Aujourd'hui — le point de départ",
        desc: "À gauche, vos tâches triées par priorité ; à droite, votre planning du jour. L'essentiel de la journée en un coup d'œil.",
        tips: ['Glissez une tâche sur un créneau pour la planifier', "Décomposez les grandes tâches en étapes avec l'IA", 'Générez votre récapitulatif du matin'],
      },
    },
  },
  {
    key: 'matrix',
    icon: LayoutGrid,
    accent: '#e88b7d',
    copy: {
      zh: {
        eyebrow: '第 2 站',
        title: '矩陣 — 分清輕重緩急',
        desc: '艾森豪矩陣依「重要 × 緊急」把任務分成四象限：立即執行、排程、委派、刪除。',
        tips: ['拖曳任務跨象限，即時調整優先度', '設定關鍵字規則，新任務自動歸類', '先做重要的事，而不是緊急的事'],
      },
      en: {
        eyebrow: 'Stop 2',
        title: 'Matrix — sort what truly matters',
        desc: 'The Eisenhower Matrix splits tasks by importance × urgency into four quadrants: Do First, Schedule, Delegate, Eliminate.',
        tips: ['Drag tasks across quadrants to reprioritize', 'Keyword rules auto-classify new tasks', 'Do the important before the merely urgent'],
      },
      fr: {
        eyebrow: 'Étape 2',
        title: "Matrice — l'essentiel d'abord",
        desc: "La matrice d'Eisenhower classe vos tâches par importance × urgence en quatre quadrants : à faire, planifier, déléguer, éliminer.",
        tips: ['Glissez les tâches entre quadrants pour reprioriser', 'Les règles de mots-clés classent automatiquement', "Faites l'important avant l'urgent"],
      },
    },
  },
  {
    key: 'calendar',
    icon: Calendar,
    accent: '#9ec89a',
    copy: {
      zh: {
        eyebrow: '第 3 站',
        title: '日曆 — 行程與任務同框',
        desc: '連接 Google、Outlook、Apple 或 Notion 日曆，行程與任務在同一個畫面裡規劃。',
        tips: ['多帳戶同步，各自有專屬顏色', '日 / 週 / 月三種視圖切換', '支援雙時區顯示，跨國協作不混亂'],
      },
      en: {
        eyebrow: 'Stop 3',
        title: 'Calendar — events and tasks, together',
        desc: 'Connect Google, Outlook, Apple or Notion calendars and plan events alongside your tasks in one view.',
        tips: ['Sync multiple accounts, each with its own color', 'Switch between day, week and month views', 'Dual time zone display for cross-border work'],
      },
      fr: {
        eyebrow: 'Étape 3',
        title: 'Calendrier — événements et tâches réunis',
        desc: 'Connectez vos calendriers Google, Outlook, Apple ou Notion et planifiez tout dans une seule vue.',
        tips: ['Synchronisez plusieurs comptes, chacun sa couleur', 'Basculez entre vues jour, semaine et mois', 'Double fuseau horaire pour le travail international'],
      },
    },
  },
  {
    key: 'habits',
    icon: Repeat2,
    accent: '#f0a95c',
    copy: {
      zh: {
        eyebrow: '第 4 站',
        title: '習慣 — 積累的力量',
        desc: '建立每日習慣，燭火會隨著你的連續天數越燒越旺。小事重複做，就是大改變。',
        tips: ['每日打卡，累積連續天數', '燭火動畫映照你的堅持', '可自訂每個習慣的顯示方式'],
      },
      en: {
        eyebrow: 'Stop 4',
        title: 'Habits — the power of streaks',
        desc: 'Build daily habits and watch the candle burn brighter as your streak grows. Small things, repeated, become big change.',
        tips: ['Check in daily to grow your streak', 'The candle flame reflects your consistency', 'Customize how each habit is displayed'],
      },
      fr: {
        eyebrow: 'Étape 4',
        title: 'Habitudes — la force de la régularité',
        desc: "Créez des habitudes quotidiennes : la bougie brille davantage à mesure que votre série s'allonge. Les petits gestes répétés font les grands changements.",
        tips: ['Validez chaque jour pour allonger votre série', 'La flamme reflète votre constance', "Personnalisez l'affichage de chaque habitude"],
      },
    },
  },
  {
    key: 'retroplanning',
    icon: GitBranch,
    accent: '#c9a86a',
    copy: {
      zh: {
        eyebrow: '第 5 站',
        title: '逆向規劃 — 從終點出發',
        desc: '給我目標與截止日期，Kairos 從 deadline 倒推出每個階段，把遠大的目標變成一步步的計畫。',
        tips: ['自動倒推階段時程，逾期風險一目了然', '常用流程可存成範本重複使用', '階段自動轉為任務，接軌今日與矩陣'],
      },
      en: {
        eyebrow: 'Stop 5',
        title: 'Retroplanning — start from the end',
        desc: 'Give Kairos a goal and a deadline; it works backwards to lay out every stage, turning big goals into step-by-step plans.',
        tips: ['Stages are back-scheduled from the deadline', 'Save recurring workflows as templates', 'Stages become tasks, flowing into Today and Matrix'],
      },
      fr: {
        eyebrow: 'Étape 5',
        title: 'Rétroplanification — partir de la fin',
        desc: "Donnez un objectif et une échéance : Kairos remonte le temps pour définir chaque étape et transformer vos grands objectifs en plan concret.",
        tips: ["Les étapes sont planifiées à rebours depuis l'échéance", 'Enregistrez vos processus récurrents comme modèles', "Les étapes deviennent des tâches, reliées à Aujourd'hui et à la Matrice"],
      },
    },
  },
]

const UI_COPY: Record<Lang, { skip: string; back: string; next: string; start: string; stepOf: (n: number, total: number) => string; srTitle: string }> = {
  zh: { skip: '略過導覽', back: '上一步', next: '下一步', start: '開始使用 Kairos', stepOf: (n, t) => `第 ${n} 步，共 ${t} 步`, srTitle: 'Kairos 使用導覽' },
  en: { skip: 'Skip tour', back: 'Back', next: 'Next', start: 'Start using Kairos', stepOf: (n, t) => `Step ${n} of ${t}`, srTitle: 'Kairos onboarding tour' },
  fr: { skip: 'Passer', back: 'Retour', next: 'Suivant', start: 'Commencer avec Kairos', stepOf: (n, t) => `Étape ${n} sur ${t}`, srTitle: 'Guide de découverte Kairos' },
}

// Same paper-grain noise texture as the sidebar
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function OnboardingTour() {
  const { language, hasCompletedOnboarding, onboardingOpen, setOnboardingOpen, completeOnboarding } = useAppStore()
  const [step, setStep] = React.useState(0)
  const [direction, setDirection] = React.useState<'fwd' | 'back'>('fwd')

  const ui = UI_COPY[language]
  const total = STEPS.length
  const current = STEPS[step]
  const copy = current.copy[language]
  const isLast = step === total - 1

  // Auto-open once for first-time users (store is rehydrated from localStorage on mount)
  React.useEffect(() => {
    const { hasCompletedOnboarding: done, onboardingOpen: open } = useAppStore.getState()
    if (done || open) return
    const timer = setTimeout(() => useAppStore.getState().setOnboardingOpen(true), 700)
    return () => clearTimeout(timer)
  }, [])

  // Reset to first step each time the tour opens
  React.useEffect(() => {
    if (onboardingOpen) { setStep(0); setDirection('fwd') }
  }, [onboardingOpen])

  const goTo = React.useCallback((next: number) => {
    if (next < 0 || next >= total) return
    setDirection(next > step ? 'fwd' : 'back')
    setStep(next)
  }, [step, total])

  const finish = React.useCallback(() => { completeOnboarding() }, [completeOnboarding])

  const handleOpenChange = (open: boolean) => {
    if (!open) finish() // Esc / overlay click counts as "skip" — never nag again
    else setOnboardingOpen(true)
  }

  // ← → keyboard navigation
  React.useEffect(() => {
    if (!onboardingOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); if (isLast) finish(); else goTo(step + 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(step - 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onboardingOpen, step, isLast, goTo, finish])

  const Icon = current.icon

  return (
    <DialogPrimitive.Root open={onboardingOpen && !hasCompletedOnboarding ? true : onboardingOpen} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] max-w-[560px] translate-x-[-50%] translate-y-[-50%] rounded-3xl bg-[#fbf7ee] shadow-2xl shadow-black/40 overflow-hidden border border-[rgba(168,127,62,0.25)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">{ui.srTitle}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{copy.desc}</DialogPrimitive.Description>

          {/* ── Ink header band ── */}
          <div
            className="relative h-[150px] bg-[#2a1d10] flex items-center justify-center overflow-hidden"
            style={{ backgroundImage: `radial-gradient(ellipse 70% 90% at 50% 100%, ${current.accent}22, transparent), ${NOISE_BG}` }}
          >
            {/* red seal decoration */}
            <div className="absolute top-4 right-4 h-9 w-9 rotate-6 rounded-[4px] bg-[#ab3326]/90 shadow-md flex items-center justify-center select-none pointer-events-none">
              <span className="font-brush text-[13px] leading-[1.05] text-[#f3ecdd] text-center" style={{ fontFamily: 'var(--font-brush)' }}>墨<br />時</span>
            </div>

            {/* step visual — keyed so it re-animates on step change */}
            <div key={current.key} className="animate-fade-in-scale flex flex-col items-center gap-2.5">
              {Icon ? (
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center border"
                  style={{ backgroundColor: `${current.accent}1f`, borderColor: `${current.accent}45` }}
                >
                  <Icon className="h-8 w-8" style={{ color: current.accent }} />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/logo_v5/Logo.png" alt="Kairos" className="h-16 w-16 rounded-2xl object-cover shadow-lg shadow-black/40" />
              )}
              <span className="text-[10px] uppercase tracking-[0.22em] text-[#a87f3e]">{copy.eyebrow}</span>
            </div>
          </div>

          {/* gold progress bar */}
          <div className="h-[3px] bg-[#ece2cb]">
            <div
              className="h-full bg-gradient-to-r from-[#a87f3e] to-[#ffd27a] transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / total) * 100}%` }}
            />
          </div>

          {/* ── Step content ── */}
          <div className="px-7 pt-6 pb-5 min-h-[218px]">
            <div key={current.key} className={direction === 'fwd' ? 'animate-slide-right' : 'animate-slide-left'}>
              <h2 className="font-serif text-[22px] font-semibold text-[#2a2420] leading-snug">{copy.title}</h2>
              <p className="mt-2 text-sm text-[#8a7a5e] leading-relaxed">{copy.desc}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {copy.tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-[13px] text-[#5c5347] leading-relaxed">
                    <span
                      className="mt-0.5 h-4.5 w-4.5 shrink-0 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${current.accent}30` }}
                    >
                      <Check className="h-3 w-3" style={{ color: '#7a5a28' }} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[#ece2cb] bg-[#f7f1e3]">
            <button
              onClick={finish}
              className="text-xs text-[#a99873] hover:text-[#5c5347] transition-colors px-2 py-1 rounded-lg"
            >
              {ui.skip}
            </button>

            {/* progress dots */}
            <div className="flex items-center gap-1.5" role="tablist" aria-label={ui.stepOf(step + 1, total)}>
              {STEPS.map((s, i) => (
                <button
                  key={s.key}
                  role="tab"
                  aria-selected={i === step}
                  aria-label={ui.stepOf(i + 1, total)}
                  onClick={() => goTo(i)}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === step ? 'w-5 h-2 bg-[#ab3326]' : 'w-2 h-2 bg-[#d9c79f] hover:bg-[#a87f3e]'
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => goTo(step - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  {ui.back}
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={finish}>
                  <Sparkles className="h-3.5 w-3.5" />
                  {ui.start}
                </Button>
              ) : (
                <Button size="sm" onClick={() => goTo(step + 1)}>
                  {ui.next}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
