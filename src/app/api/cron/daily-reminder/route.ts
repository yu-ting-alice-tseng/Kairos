import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const resend = new Resend(process.env.RESEND_API_KEY)

// Called by Vercel Cron every day at midnight UTC
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or an authorized admin request)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all users who have at least one CalendarAccount
  const users = await prisma.user.findMany({
    where: { email: { not: null }, calendarAccounts: { some: {} } },
    include: { calendarAccounts: { select: { id: true, name: true, accessToken: true, refreshToken: true, expiresAt: true } } },
  })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0)
  const tomorrowEnd   = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59)
  const tomorrowStr   = tomorrow.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  let sent = 0
  for (const user of users) {
    if (!user.email) continue

    // Fetch tomorrow's tasks for this user
    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        scheduledStart: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { not: 'COMPLETED' },
      },
      orderBy: { scheduledStart: 'asc' },
    })

    if (tasks.length === 0) continue

    const taskRows = tasks.map((t) => {
      const start = t.scheduledStart ? new Date(t.scheduledStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '–'
      const end   = t.scheduledEnd   ? new Date(t.scheduledEnd).toLocaleTimeString('fr-FR',   { hour: '2-digit', minute: '2-digit' }) : ''
      const time  = end ? `${start} – ${end}` : start
      return `<tr><td style="padding:6px 12px;color:#8a7a5e;font-size:13px">${time}</td><td style="padding:6px 12px;font-size:13px;color:#2a2420">${t.title}</td></tr>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f3ec;font-family:'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fffdf8;border-radius:16px;border:1px solid #e2d6bc;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2a1d10,#3d2e1a);padding:28px 32px">
      <p style="margin:0;font-size:22px;color:#fbeacb;font-weight:600;letter-spacing:0.02em">Kairos 墨時</p>
      <p style="margin:6px 0 0;font-size:13px;color:#a87f3e;letter-spacing:0.12em;text-transform:uppercase">Agenda de demain</p>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#5c5347;font-size:14px;margin:0 0 20px">
        Voici ton agenda pour <strong style="color:#2a2420">${tomorrowStr}</strong> :
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2d6bc;border-radius:12px;overflow:hidden">
        <thead>
          <tr style="background:#fbf7ee">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#a99873;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Heure</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#a99873;font-weight:600;text-transform:uppercase;letter-spacing:0.08em">Tâche</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#a99873;text-align:center">
        潑墨成時，掌握生命中的關鍵時刻 · Kairos
      </p>
    </div>
  </div>
</body>
</html>`

    try {
      await resend.emails.send({
        from: 'Kairos <reminder@kairos.app>',
        to: user.email,
        subject: `📅 Demain : ${tasks.length} tâche${tasks.length > 1 ? 's' : ''} planifiée${tasks.length > 1 ? 's' : ''}`,
        html,
      })
      sent++
    } catch (err) {
      console.error('[cron/daily-reminder] email failed for', user.email, err)
    }
  }

  return NextResponse.json({ sent, total: users.length })
}
