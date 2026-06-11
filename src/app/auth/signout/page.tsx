import { signOut } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function SignOutPage() {
  // Clear any stale OAuth state cookies that could block a future sign-in
  // (e.g. from a cancelled calendar-connect flow)
  const cookieStore = await cookies()
  const oauthCookies = ['authjs.state', 'authjs.pkce.code_verifier', 'authjs.callback-url', '_cal_restore_session']
  for (const name of oauthCookies) {
    if (cookieStore.get(name)) cookieStore.delete(name)
  }

  await signOut({ redirectTo: '/auth/signin' })
}
