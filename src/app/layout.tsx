import type { Metadata, Viewport } from 'next'
import { Geist, Noto_Serif_SC, Noto_Sans_SC, Ma_Shan_Zheng, Dancing_Script } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const notoSerifSC = Noto_Serif_SC({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-noto-serif-sc' })
const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-sans-sc' })
const brush = Ma_Shan_Zheng({ subsets: ['latin'], weight: ['400'], variable: '--font-ma-shan-zheng' })
// Latin script face for the "Flow" half of the wordmark — same flowing-vs-structured
// contrast as the static logo asset (public/logo-wordmark.svg), but loadable in-app.
const script = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-dancing-script' })

export const metadata: Metadata = {
  title: 'Kairos — 墨時',
  description: 'Potrez le temps à l\'encre. Maîtrisez vos priorités avec la matrice Eisenhower, synchronisez vos calendriers et laissez l\'IA optimiser votre emploi du temps.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kairos' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#ab3326',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} ${notoSerifSC.variable} ${notoSansSC.variable} ${brush.variable} ${script.variable} h-full antialiased`}>
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
