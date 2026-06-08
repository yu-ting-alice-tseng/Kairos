import { signIn, auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import { DemoLoginButton } from '@/components/auth/DemoLoginButton'

export default async function SignInPage() {
  const session = await auth()
  if (session?.user) redirect('/today')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl mb-4">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FlowPlan</h1>
          <p className="text-indigo-300 text-sm">Planifiez intelligent. Vivez mieux.</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-2 text-center">Connexion</h2>
          <p className="text-sm text-indigo-300 text-center mb-8">
            Connectez-vous avec votre compte Google ou Microsoft
          </p>

          <div className="flex flex-col gap-3">
            <form action={async () => {
              'use server'
              await signIn('google', { redirectTo: '/today' })
            }}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-gray-900 shadow hover:bg-gray-50 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              await signIn('microsoft-entra-id', { redirectTo: '/today' })
            }}>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 rounded-2xl bg-[#0078D4] px-4 py-3.5 text-sm font-semibold text-white shadow hover:bg-[#106EBE] transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.5 2H2v9.5h9.5V2zm1 0v9.5H22V2h-9.5zm-1 10.5H2V22h9.5v-9.5zm1 0V22H22v-9.5h-9.5z" />
                </svg>
                Continuer avec Microsoft
              </button>
            </form>
          </div>

          <DemoLoginButton />

          <div className="mt-8 flex flex-col gap-2 text-center">
            {[
              '🎯 Matrice Eisenhower interactive',
              '🤖 IA pour décomposer les tâches',
              '📅 Sync multi-calendriers',
              '🔥 Tracker d\'habitudes',
            ].map((f) => (
              <p key={f} className="text-xs text-indigo-300">{f}</p>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-indigo-400 mt-6">
          Vos données restent privées et sécurisées.
        </p>
      </div>
    </div>
  )
}
