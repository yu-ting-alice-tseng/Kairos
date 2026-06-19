import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Dancing_Script } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ToastProvider } from '@/components/providers/ToastProvider'

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-cormorant' })
const script = Dancing_Script({ subsets: ['latin'], weight: ['700'], variable: '--font-dancing-script' })

export const metadata: Metadata = {
  title: 'Kairos — 墨時',
  verification: {
    google: 'wozi09rl40kAONzGXfn2G72Ta0NFXagn6PBBdZFswio',
  },
  description: 'Potrez le temps à l\'encre. Maîtrisez vos priorités avec la matrice Eisenhower, synchronisez vos calendriers et laissez l\'IA optimiser votre emploi du temps.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kairos' },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
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
    <html lang="fr" className={`${cormorant.variable} ${script.variable} h-full antialiased`}>
      <head>
        {/* CJK fonts loaded directly — next/font CJK subset support is unreliable in dev */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="h-full font-sans">
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-DYCZHN8RV5" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-DYCZHN8RV5');
        `}</Script>
        <SessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
