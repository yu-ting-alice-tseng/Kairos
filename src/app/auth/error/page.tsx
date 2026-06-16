import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

const errorMessages: Record<string, string> = {
  Configuration:   'Server configuration error. Check your environment variables.',
  AccessDenied:    'Access denied. You may not be on the approved test users list.',
  Verification:    'The sign-in link is no longer valid.',
  OAuthCallback:   'Error during OAuth callback. Check your database connection.',
  OAuthSignin:     'Error starting the OAuth sign-in flow.',
  OAuthCreateAccount: 'Could not create an account. The database may not be reachable.',
  Default:         'An unexpected authentication error occurred.',
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = errorMessages[error ?? 'Default'] ?? errorMessages.Default

  return (
    <div className="min-h-screen bg-[#1b1612] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ab3326]/15 border border-[#ab3326]/25 mb-5">
          <AlertTriangle className="h-7 w-7 text-[#c44a3a]" />
        </div>
        <h1 className="text-xl font-brush text-[#e8d9b8] mb-2">Authentication Error</h1>
        <p className="text-sm text-[#a99873] mb-1">{message}</p>
        {error && (
          <p className="text-xs text-[#6e6147] font-mono mb-6">code: {error}</p>
        )}
        <Link
          href="/auth/signin"
          className="inline-flex items-center gap-2 rounded-xl bg-[#ab3326]/15 border border-[#ab3326]/25 px-5 py-2.5 text-sm font-medium text-[#e2a08f] hover:bg-[#ab3326]/25 transition-all"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
