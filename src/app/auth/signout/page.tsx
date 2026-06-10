import { signOut } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SignOutPage() {
  await signOut({ redirectTo: '/auth/signin' })
}
