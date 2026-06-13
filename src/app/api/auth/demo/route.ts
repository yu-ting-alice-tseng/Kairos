import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEMO_USER_ID } from '@/lib/auth'
import { encode } from '@auth/core/jwt'
import { addDays } from 'date-fns'

async function seedDemoData(userId: string) {
  const count = await prisma.task.count({ where: { userId } })
  if (count > 0) return

  await prisma.task.createMany({
    data: [
      { userId, title: 'Préparer la présentation trimestrielle', description: 'Slides + chiffres Q4', importance: 9, urgency: 8, priority: 98, estimatedMinutes: 120, deadline: addDays(new Date(), 3), status: 'PENDING', aiSuggested: false },
      { userId, title: 'Répondre aux emails clients', description: 'Priorité haute : 3 emails en attente', importance: 6, urgency: 9, priority: 69, estimatedMinutes: 30, status: 'PENDING', aiSuggested: false },
      { userId, title: 'Lire le rapport annuel', description: 'Rapport 2024 de l\'équipe produit', importance: 7, urgency: 3, priority: 73, estimatedMinutes: 60, status: 'PENDING', aiSuggested: false },
      { userId, title: 'Nettoyer la boîte mail', description: 'Archiver et désabonner', importance: 2, urgency: 2, priority: 22, estimatedMinutes: 20, status: 'PENDING', aiSuggested: false },
      { userId, title: 'Planifier la réunion d\'équipe', description: 'Calendrier de mars', importance: 7, urgency: 6, priority: 76, estimatedMinutes: 15, status: 'PENDING', aiSuggested: false },
      { userId, title: 'Corriger bug #247 en production', description: 'Erreur 500 sur la page paiement', importance: 10, urgency: 10, priority: 110, estimatedMinutes: 90, status: 'IN_PROGRESS', aiSuggested: false },
      { userId, title: 'Mettre à jour la documentation', description: 'API v2 endpoints', importance: 5, urgency: 2, priority: 52, estimatedMinutes: 45, status: 'PENDING', aiSuggested: false },
      { userId, title: 'Réviser le budget marketing', importance: 8, urgency: 5, priority: 85, estimatedMinutes: 60, deadline: addDays(new Date(), 7), status: 'PENDING', aiSuggested: false },
    ],
  })

  await prisma.habit.createMany({
    data: [
      { userId, title: 'Méditation', icon: '🧘', color: '#8B5CF6', frequency: 'DAILY', scheduledTime: '07:00', durationMinutes: 10, streak: 5, longestStreak: 12 },
      { userId, title: 'Sport', icon: '💪', color: '#EF4444', frequency: 'WEEKDAYS', scheduledTime: '07:30', durationMinutes: 30, streak: 3, longestStreak: 21 },
      { userId, title: 'Lecture', icon: '📚', color: '#F59E0B', frequency: 'DAILY', scheduledTime: '21:00', durationMinutes: 20, streak: 8, longestStreak: 30 },
      { userId, title: 'Eau (2L)', icon: '💧', color: '#06B6D4', frequency: 'DAILY', durationMinutes: 1, streak: 2, longestStreak: 7 },
    ],
  })
}

export async function POST(req: NextRequest) {
  try {
    let user = await prisma.user.findUnique({ where: { id: DEMO_USER_ID } })
    if (!user) {
      user = await prisma.user.create({
        data: { id: DEMO_USER_ID, name: 'Demo User', email: 'demo@flowplan.app', emailVerified: new Date(), language: 'fr', timezone: 'Europe/Paris' },
      })
    }
    await seedDemoData(user.id)

    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'flowplan-demo-secret-replace-in-prod'
    const now = Math.floor(Date.now() / 1000)
    const maxAge = 365 * 24 * 60 * 60

    // Create a properly signed JWT that NextAuth JWT strategy will accept
    const token = await encode({
      token: {
        sub: DEMO_USER_ID,
        name: 'Demo User',
        email: 'demo@flowplan.app',
        picture: null,
        iat: now,
        exp: now + maxAge,
        jti: crypto.randomUUID(),
      },
      secret,
      salt: '',
    })

    const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
    const isHttps = proto === 'https'
    const cookieName = isHttps ? '__Secure-authjs.session-token' : 'authjs.session-token'

    const response = NextResponse.json({ ok: true })
    response.cookies.set(cookieName, token, {
      expires: new Date((now + maxAge) * 1000),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isHttps,
    })

    return response
  } catch (err) {
    console.error('Demo login error:', err)
    return NextResponse.json({ error: 'Demo login failed' }, { status: 500 })
  }
}
