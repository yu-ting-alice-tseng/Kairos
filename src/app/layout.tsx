import type { Metadata, Viewport } from 'next'
import { Geist, Noto_Serif_SC, Noto_Sans_SC, Ma_Shan_Zheng } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const notoSerifSC = Noto_Serif_SC({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-noto-serif-sc' })
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-sans-sc' })
const brush = Ma_Shan_Zheng({ subsets: ['latin'], weight: ['400'], variable: '--font-brush' })

export const metadata: Metadata = {
  title: 'FlowPlan — 流光計劃',
  description: 'Organisez vos tâches avec la matrice Eisenhower, synchronisez vos calendriers et laissez l\'IA optimiser votre emploi du temps.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'FlowPlan' },
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#ab3326',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} ${notoSerifSC.variable} ${notoSansSC.variable} ${brush.variable} h-full antialiased`}>
      <body className="h-full font-sans">
        <SessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
