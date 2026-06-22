import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Terms of Service — Kairos 墨時' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#1b1612] text-[#e8d9b8]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/about" className="inline-flex items-center gap-2 text-[#7a6c54] hover:text-[#d9c79f] transition-colors text-sm mb-8">
          <ArrowLeft className="h-4 w-4" />
          Kairos 墨時
        </Link>

        <h1 className="text-3xl font-bold text-[#e8d9b8] mb-2">Terms of Service</h1>
        <p className="text-sm text-[#7a6c54] mb-10">Last updated: June 2026</p>

        <div className="flex flex-col gap-8 text-[#c9b68a] leading-relaxed text-sm">

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">1. Acceptance</h2>
            <p>By using Kairos 墨時 ("the App"), you agree to these Terms of Service. If you do not agree, please do not use the App.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">2. Description of service</h2>
            <p>Kairos is a personal productivity application offering task management (Eisenhower matrix), calendar synchronisation, habit tracking, and retroplanning tools. The App is provided free of charge for personal use.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">3. Account &amp; access</h2>
            <p>You must sign in with a valid Google or Notion account. You are responsible for maintaining the security of your account credentials. We reserve the right to suspend accounts that abuse the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">4. Acceptable use</h2>
            <p>You agree not to use the App for any unlawful purpose, to attempt to reverse-engineer or disrupt the service, or to upload content that infringes third-party rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">5. Intellectual property</h2>
            <p>All design, branding, and code of Kairos 墨時 is the property of its creator. Your personal data (tasks, habits, notes) remains yours at all times.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">6. Disclaimer &amp; limitation of liability</h2>
            <p>The App is provided "as is" without warranties of any kind. We are not liable for any loss of data or damages arising from use of the App. We recommend maintaining personal backups of important information.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">7. Changes to these terms</h2>
            <p>We may update these terms at any time. Continued use of the App after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#e8d9b8] mb-3">8. Contact</h2>
            <p>Questions about these terms? Contact us at <a href="mailto:yexiu07060810@gmail.com" className="text-[#cba968] hover:underline">yexiu07060810@gmail.com</a>.</p>
          </section>

        </div>
      </div>
    </div>
  )
}
