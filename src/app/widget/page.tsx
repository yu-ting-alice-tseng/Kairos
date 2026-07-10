import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { createWidgetToken, verifyWidgetToken, getWidgetData, WidgetTask } from '@/lib/widget'
import { AutoReload, CopyField } from './widget-client'

export const metadata: Metadata = {
  title: 'Kairos — 桌面小工具',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

async function getBaseUrl() {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, '')
  const host = (await headers()).get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
  return `${proto}://${host}`
}

function formatTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat('zh-TW', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

function TaskRow({ task, tz }: { task: WidgetTask; tz: string }) {
  const chip = task.scheduledStart
    ? formatTime(task.scheduledStart, tz)
    : task.overdue
      ? '逾期'
      : task.deadline
        ? '今天'
        : null
  return (
    <li className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] ${
          task.overdue
            ? 'bg-[var(--brand)] text-white'
            : chip
              ? 'bg-[var(--surface)] text-[var(--ink-light)]'
              : 'text-[var(--border)]'
        }`}
      >
        {chip ?? '·'}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{task.title}</span>
      {task.estimatedMinutes ? (
        <span className="shrink-0 text-[11px] text-[var(--gold-dark)]">{task.estimatedMinutes}分</span>
      ) : null}
    </li>
  )
}

export default async function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; tz?: string }>
}) {
  const { token, tz } = await searchParams

  // ── Board mode: opened from a widget / pinned window with a token ──
  if (token) {
    const userId = verifyWidgetToken(token)
    if (!userId) {
      return (
        <main className="flex min-h-screen items-center justify-center p-6">
          <p className="text-sm text-[var(--ink-light)]">
            這個小工具連結已失效，請重新到 <Link href="/widget" className="text-[var(--brand)] underline">kairos/widget</Link> 取得新連結。
          </p>
        </main>
      )
    }

    const data = await getWidgetData(userId, tz)
    const percent = data.totalCount > 0 ? Math.round((data.completedCount / data.totalCount) * 100) : 0

    return (
      <main className="mx-auto min-h-screen max-w-md p-4">
        <AutoReload seconds={300} />
        <header className="mb-3 flex items-baseline justify-between">
          <h1 className="font-serif text-lg font-bold text-[var(--ink)]">今日任務</h1>
          <span className="text-xs text-[var(--ink-light)]">{data.date}</span>
        </header>

        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-[var(--ink-light)]">
            <span>已完成 {data.completedCount} / {data.totalCount}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface)]">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {data.tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--ink-light)]">今天沒有待辦任務 🎉</p>
        ) : (
          <ul className="rounded-lg border border-[var(--border)] bg-white/40 px-3">
            {data.tasks.map((task) => (
              <TaskRow key={task.id} task={task} tz={data.timezone} />
            ))}
          </ul>
        )}

        <p className="mt-3 text-center text-[10px] text-[var(--gold-dark)]">每 5 分鐘自動更新 · Kairos</p>
      </main>
    )
  }

  // ── Setup mode: logged-in user grabs their personal widget URLs ──
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="mb-2 font-serif text-xl font-bold text-[var(--ink)]">Kairos 桌面小工具</h1>
          <p className="mb-4 text-sm text-[var(--ink-light)]">請先登入，才能取得你的專屬小工具連結。</p>
          <Link
            href="/auth/signin"
            className="inline-block rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-light)]"
          >
            前往登入
          </Link>
        </div>
      </main>
    )
  }

  const widgetToken = createWidgetToken(session.user.id)
  const base = await getBaseUrl()
  const boardUrl = `${base}/widget?token=${widgetToken}`
  const apiUrl = `${base}/api/widget/today?token=${widgetToken}`

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6">
      <h1 className="mb-1 font-serif text-2xl font-bold text-[var(--ink)]">桌面小工具</h1>
      <p className="mb-6 text-sm text-[var(--ink-light)]">
        不用打開 Kairos，就能在手機主畫面或電腦桌面看到今天該做的任務。
      </p>

      <div className="mb-6 space-y-4 rounded-lg border border-[var(--border)] bg-white/40 p-4">
        <CopyField label="看板網址（電腦桌面、Android 用）" value={boardUrl} />
        <CopyField label="API 網址（iPhone Scriptable 用）" value={apiUrl} />
        <p className="text-xs text-[var(--brand-dark)]">
          ⚠️ 這兩個網址等同你的任務清單鑰匙，只放進自己的裝置，不要傳給別人。
        </p>
        <Link href={boardUrl} className="inline-block text-sm text-[var(--brand)] underline">
          先預覽看板 →
        </Link>
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border border-[var(--border)] bg-white/40 p-4">
          <h2 className="mb-2 font-serif text-base font-bold text-[var(--ink)]"> iPhone 主畫面小工具</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--ink-light)]">
            <li>App Store 安裝免費的 <strong>Scriptable</strong></li>
            <li>下載腳本 <a href="/widget-scriptable.js" className="text-[var(--brand)] underline" download>widget-scriptable.js</a>，在 Scriptable 新增腳本並貼上內容</li>
            <li>把腳本最上面的 <code className="rounded bg-[var(--surface)] px-1 font-mono text-xs">WIDGET_URL</code> 換成上面複製的 API 網址</li>
            <li>回到主畫面長按 → 加入小工具 → Scriptable → 選這個腳本</li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-white/40 p-4">
          <h2 className="mb-2 font-serif text-base font-bold text-[var(--ink)]">🤖 Android</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--ink-light)]">
            <li>Chrome 開啟上面的<strong>看板網址</strong> → 選單 →「加到主畫面」，主畫面就有一鍵開啟的任務看板</li>
            <li>想要真正的桌面小工具，可安裝 <strong>KWGT</strong>，用 API 網址（JSON）自訂顯示內容</li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-white/40 p-4">
          <h2 className="mb-2 font-serif text-base font-bold text-[var(--ink)]">💻 Windows 電腦桌面</h2>
          <ol className="list-inside list-decimal space-y-1 text-sm text-[var(--ink-light)]">
            <li>用 Edge 或 Chrome 開啟上面的<strong>看板網址</strong></li>
            <li>選單 →「應用程式」→「將此網站安裝為應用程式」</li>
            <li>它會變成一個獨立小視窗，可釘選到工作列，開機常駐在桌面角落</li>
          </ol>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-white/40 p-4">
          <h2 className="mb-2 font-serif text-base font-bold text-[var(--ink)]">📱 把 Kairos 本體裝成手機 App</h2>
          <p className="text-sm text-[var(--ink-light)]">
            iPhone：Safari 開啟 Kairos → 分享 →「加入主畫面」。Android：Chrome 開啟 Kairos → 選單 →「安裝應用程式」。
            安裝後全螢幕開啟，跟一般 App 一樣。
          </p>
        </section>
      </div>
    </main>
  )
}
