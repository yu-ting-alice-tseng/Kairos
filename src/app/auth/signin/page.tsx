import { signIn, auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Target, Brain, CalendarDays, Flame } from 'lucide-react'
import { DemoLoginButton } from '@/components/auth/DemoLoginButton'
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
              src="/Kairos Logo -animated-.gif"
              alt="Kairos"
              className="h-[100px] w-[100px] rounded-[22px] shadow-2xl shadow-black/50 animate-float object-cover"
            />
          </div>
          <h1 className="text-[36px] font-brush text-[#e2a08f] tracking-tight mb-1 leading-none">Kairos 墨時</h1>
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
            <form action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/today' })
            }}>
              <button
                type="submit"
                className="group w-full flex items-center justify-center gap-3 rounded-2xl bg-[#fbf7ee] px-4 py-3.5 text-sm font-semibold text-[#3a3326] shadow-lg shadow-black/20 hover:bg-[#f3ecdd] transition-all duration-200 hover:scale-[1.015] active:scale-[0.99]"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continuer avec Google
              </button>
            </form>

            <form action={async () => {
              'use server'
              await signIn('notion', { redirectTo: '/today' })
            }}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#fbf7ee]/[0.06] border border-[rgba(225,200,150,0.14)] px-4 py-3.5 text-sm font-semibold text-[#e8d9b8] shadow-lg shadow-black/20 hover:bg-[#fbf7ee]/[0.10] transition-all duration-200 hover:scale-[1.015] active:scale-[0.99]"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.934zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                </svg>
                Continuer avec Notion
              </button>
            </form>
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
