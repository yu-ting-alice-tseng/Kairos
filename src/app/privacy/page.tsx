import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Privacy Policy — Kairos 墨時' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#1b1612] text-[#e8d9b8]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/about" className="inline-flex items-center gap-2 text-[#7a6c54] hover:text-[#d9c79f] transition-colors text-sm mb-8">
          <ArrowLeft className="h-4 w-4" />
          Kairos 墨時
        </Link>

        <h1 className="text-3xl font-bold text-[#e8d9b8] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#7a6c54] mb-10">Last updated: June 2026</p>

        <div className="flex flex-col gap-8 text-[#c9b68a] leading-relaxed text-sm">

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">1. What we collect</h2>
            <p>When you sign in with Google or Notion, Kairos receives your name, email address, and profile picture from those providers to create and identify your account. We do not collect any other personal data beyond what is necessary to provide the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">2. Calendar data</h2>
            <p>If you connect Google Calendar or Outlook, Kairos reads your calendar events solely to display them in the app and to help you schedule tasks. This data is never sold, shared with third parties, or used for advertising.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">3. How we store data</h2>
            <p>Your tasks, habits, and app preferences are stored in a secure database (Supabase / PostgreSQL). Authentication tokens are encrypted. You can delete your account and all associated data at any time by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">4. Third-party services</h2>
            <p>Kairos uses the following third-party services: Google OAuth (authentication &amp; calendar), Notion OAuth (authentication &amp; database sync), Vercel (hosting), and Supabase (database). Each service has its own privacy policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">5. Cookies &amp; sessions</h2>
            <p>We use a single secure session cookie to keep you logged in for up to one year. No tracking or advertising cookies are used.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">6. Your rights</h2>
            <p>You may request access to, correction of, or deletion of your personal data at any time by contacting us at <a href="mailto:yexiu07060810@gmail.com" className="text-[#cba968] hover:underline">yexiu07060810@gmail.com</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">7. Changes</h2>
            <p>We may update this policy from time to time. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
