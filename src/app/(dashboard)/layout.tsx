import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import { GlobalShortcuts } from '@/components/ui/ShortcutsDialog'
import { TimezoneSync } from '@/components/providers/TimezoneSync'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f3ecdd]">
      <Sidebar />
      {/* Room at the bottom for the phone nav bar */}
      <main className="flex-1 overflow-y-auto min-w-0 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <MobileNav />
      <OnboardingTour />
      <GlobalShortcuts />
      <TimezoneSync />
    </div>
  )
}
