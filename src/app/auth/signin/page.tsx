import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Target, Brain, CalendarDays, Flame } from 'lucide-react'
import { DemoLoginButton } from '@/components/auth/DemoLoginButton'
import { GoogleSignInButton, NotionSignInButton } from '@/components/auth/SignInButtons'
import { InkMountains } from '@/components/ui/InkMountains'

type Locale = 'zh' | 'fr' | 'en'

const i18n: Record<Locale, {
  tagline1: string
  tagline2: string
  cardTitle: string
  cardDesc: string
  remember: string
  featuresLabel: string
  features: string[]
  privacy: string
}> = {
  zh: {
    tagline1: '潑墨成時，掌握生命中的關鍵時刻',
    tagline2: '鑿壁偷光 · 篤志而行',
    cardTitle: '登入',
    cardDesc: '使用你的 Google 或 Notion 帳號登入',
    remember: '登入狀態將保留 1 年',
    featuresLabel: '功能特色',
    features: ['艾森豪矩陣', 'AI 任務拆解', '多行事曆同步', '習慣追蹤器'],
    privacy: '你的資料保持私密與安全。',
  },
  fr: {
    tagline1: "L’encre coule, le temps prend forme.",
    tagline2: "Maîtrisez l’Instant Décisif.",
    cardTitle: 'Connexion',
    cardDesc: 'Connectez-vous avec votre compte Google ou Notion',
    remember: 'Vous resterez connecté(e) pendant 1 an',
    featuresLabel: 'Fonctionnalités',
    features: ['Matrice Eisenhower', 'IA pour les tâches', 'Sync multi-calendriers', "Tracker d'habitudes"],
    privacy: 'Vos données restent privées et sécurisées.',
  },
  en: {
    tagline1: 'Where ink meets time. Seize the decisive moment.',
    tagline2: 'Focus. Flow. Achieve.',
    cardTitle: 'Sign In',
    cardDesc: 'Sign in with your Google or Notion account',
    remember: 'You will stay signed in for 1 year',
    featuresLabel: 'Features',
    features: ['Eisenhower Matrix', 'AI task breakdown', 'Multi-calendar sync', 'Habit tracker'],
    privacy: 'Your data stays private and secure.',
  },
}

function detectLocale(headersList: Headers): Locale {
  // Vercel injects the visitor's country code
  const country = headersList.get('x-vercel-ip-country') ?? ''
  if (['TW', 'HK', 'MO', 'CN', 'SG', 'MY'].includes(country)) return 'zh'
  if (['FR', 'BE', 'CH', 'LU', 'MC', 'CA'].includes(country)) return 'fr'

  // Fallback: browser Accept-Language
  const lang = (headersList.get('accept-language') ?? '').toLowerCase()
  if (lang.startsWith('zh')) return 'zh'
  if (lang.startsWith('fr')) return 'fr'
  return 'en'
}

export default async function SignInPage() {
  const session = await auth()
  if (session?.user) redirect('/today')

  const headersList = await headers()
  const locale = detectLocale(headersList)
  const t = i18n[locale]

  const featureIcons = [Target, Brain, CalendarDays, Flame]

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbeacb] flex items-center justify-center p-4">

      {/* ── Parchment background ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 50% at 8% -5%, rgba(239,138,50,0.07), transparent), radial-gradient(ellipse 60% 45% at 100% 0%, rgba(168,127,62,0.09), transparent), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.025 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Warm ink-wash blooms */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full bg-[#ef8a32]/[0.07] blur-[100px]" />
        <div className="absolute -bottom-32 -right-24 h-[440px] w-[440px] rounded-full bg-[#a87f3e]/[0.08] blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[#ab3326]/[0.03] blur-[120px]" />
      </div>

      {/* Ink mountains — visible on cream */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0">
        <InkMountains className="opacity-40" />
      </div>

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[480px] animate-fade-in-scale">

        {/* Hero banner */}
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_v5/Banner.png"
            alt="Kairos 墨時"
            className="w-full rounded-2xl shadow-[0_4px_24px_rgba(42,31,18,0.13)]"
          />
          <p className="text-center text-[#6b5840] text-sm font-medium tracking-wide mt-3 mb-0.5">{t.tagline1}</p>
          <p className="text-center text-[#a87f3e] text-[13px] font-medium tracking-[0.12em]">{t.tagline2}</p>
        </div>

        {/* Main card */}
        <div className="rounded-[28px] border border-[#e7c894] bg-[#f3dcb2]/80 backdrop-blur-sm shadow-[0_8px_40px_rgba(42,31,18,0.12)] p-8">
          <h2 className="text-lg font-semibold text-[#2a1f12] text-center mb-1.5">{t.cardTitle}</h2>
          <p className="text-[13px] text-[#6b5840] text-center mb-7 leading-relaxed">{t.cardDesc}</p>

          {/* Auth buttons */}
          <div className="flex flex-col gap-3 mb-3">
            <GoogleSignInButton />
            <NotionSignInButton />
          </div>

          {/* Remember me */}
          <p className="flex items-center gap-2 text-[12px] text-[#8a6b3e] px-1 mt-1">
            <svg className="h-3.5 w-3.5 text-[#ab3326] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t.remember}
          </p>

          <DemoLoginButton />

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#c9aa72]/40" />
            <span className="text-[11px] text-[#8a6b3e] uppercase tracking-widest">{t.featuresLabel}</span>
            <div className="flex-1 h-px bg-[#c9aa72]/40" />
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-2">
            {t.features.map((label, i) => {
              const Icon = featureIcons[i]
              return (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl bg-[#2a1f12]/[0.04] border border-[#e7c894]/60 px-3 py-2"
                >
                  <Icon className="h-3.5 w-3.5 text-[#ab3326] shrink-0" />
                  <span className="text-[11px] text-[#6b5840] leading-snug">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-[11.5px] text-[#8a6b3e] mt-5">{t.privacy}</p>
      </div>
    </div>
  )
}
