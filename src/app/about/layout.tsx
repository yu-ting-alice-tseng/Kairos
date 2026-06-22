import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kairos — Intelligent Productivity & Task Management',
  description:
    'Kairos is a free productivity app combining the Eisenhower priority matrix, multi-calendar sync (Google, Outlook, Notion), habit tracking, and retroplanning. Manage tasks, habits and schedules in one beautiful workspace.',
  openGraph: {
    title: 'Kairos — Intelligent Productivity & Task Management',
    description:
      'Kairos combines the Eisenhower matrix, multi-calendar sync, habit tracking and retroplanning in one beautiful app.',
    url: 'https://kairos-alicetseng-project.vercel.app/about',
    siteName: 'Kairos',
    type: 'website',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
