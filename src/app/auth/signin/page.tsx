import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Target, Brain, CalendarDays, Flame } from 'lucide-react'
import { DemoLoginButton } from '@/components/auth/DemoLoginButton'
import { GoogleSignInButton, NotionSignInButton } from '@/components/auth/SignInButtons'
import { ChiseledWall } from '@/components/ui/ChiseledWall'
import { InkMountains } from '@/components/ui/InkMountains'

export default async function SignInPage() {
  const session = await auth()
  if (session?.user) redirect('/today')

  const features = [
    { icon: Target,      label: 'Matrice Eisenhower interactive' },
    { icon: Brain,       label: 'IA pour décomposer les tâches' },
    { icon: CalendarDays,label: 'Sync multi-calendriers' },
    { icon: Flame,       label: "Tracker d'habitudes" },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1b1612] flex items-center justify-center p-4">

      {/* ── Ink-wash background ── */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 45% at 12% 0%, rgba(171,51,38,0.14), transparent), radial-gradient(ellipse 60% 40% at 92% 8%, rgba(176,137,72,0.10), transparent), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0">
          <InkMountains className="opacity-60" />
        </div>
        {/* Drifting ink blooms */}
        <div className="orb-1 absolute -top-56 -left-40 h-[520px] w-[520px] rounded-full bg-[#ab3326]/[0.10] blur-[90px]" />
        <div className="orb-2 absolute -bottom-56 -right-40 h-[480px] w-[480px] rounded-full bg-[#b08948]/[0.10] blur-[90px]" />
        {/* Fine gold dust */}
        <div className="absolute top-[18%] left-[22%] h-1 w-1 rounded-full bg-[#e8d9b8]/25" />
        <div className="absolute top-[35%] right-[28%] h-1.5 w-1.5 rounded-full bg-[#cba968]/30" />
        <div className="absolute bottom-[38%] left-[35%] h-1 w-1 rounded-full bg-[#e8d9b8]/20" />
        <div className="absolute top-[72%] right-[18%] h-1 w-1 rounded-full bg-[#cba968]/20" />
      </div>

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[420px] animate-fade-in-scale">

        {/* Hero — 鑿壁偷光 */}
        <div className="text-center mb-9">
          <div className="inline-flex items-center justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-v3-animated.gif"
              alt="Kairos"
              className="h-[120px] w-[120px] animate-float rounded-2xl"
            />
          </div>
          <h1 className="text-[36px] tracking-tight mb-1 leading-none text-[#e2a08f]">
            <span className="font-script">Kairos</span>{' '}<span className="font-brush">墨時</span>
          </h1>
          <p className="text-[#8a7a5e] text-sm font-medium tracking-wide mb-2">潑墨成時，掌握生命中的關鍵時刻</p>
          <p className="text-[#cba968]/80 text-[13px] font-medium tracking-wide">
            鑿壁偷光 · 篤志而行 — Maîtrisez l&apos;Instant Décisif.
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-[28px] border border-[rgba(225,200,150,0.12)] bg-[#241d17]/70 backdrop-blur-xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-[#e8d9b8] text-center mb-1.5">Connexion</h2>
          <p className="text-[13px] text-[#8a7a5e] text-center mb-7 leading-relaxed">
            Connectez-vous avec votre compte Google ou Notion
          </p>

          {/* Auth buttons */}
          <div className="flex flex-col gap-3 mb-3">
            <GoogleSignInButton />
            <NotionSignInButton />
          </div>

          {/* Remember me — session lasts 1 year by default */}
          <p className="flex items-center gap-2 text-[12px] text-[#6e6147] px-1 mt-1">
            <svg className="h-3.5 w-3.5 text-[#c44a3a] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Vous resterez connecté(e) pendant 1 an
          </p>

          <DemoLoginButton />

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[rgba(225,200,150,0.10)]" />
            <span className="text-[11px] text-[#6e6147] uppercase tracking-widest">Fonctionnalités</span>
            <div className="flex-1 h-px bg-[rgba(225,200,150,0.10)]" />
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-2">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl bg-[#fbf7ee]/[0.03] border border-[rgba(225,200,150,0.08)] px-3 py-2"
              >
                <Icon className="h-3.5 w-3.5 text-[#c44a3a] shrink-0" />
                <span className="text-[11px] text-[#a99873] leading-snug">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[11.5px] text-[#6e6147] mt-5">
          Vos données restent privées et sécurisées.
        </p>
      </div>
    </div>
  )
}
