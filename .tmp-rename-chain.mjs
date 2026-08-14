import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const OUT = '/tmp/claude-0/-home-user-Kairos/e4a08fba-1a98-5699-b97a-2148eddfefc0/scratchpad'
const at = (offset, hour) => { const d = new Date(); d.setHours(hour, 0, 0, 0); d.setDate(d.getDate() + offset); return d.toISOString() }

const events = [{ id: 'ev-head', title: 'Train to Paris Gare de l’Est', start: at(-2, 9), end: at(-2, 11), calendarAccountId: 'a1', color: '#c44a3a', editable: true }]
const mk = (id, title, parentId, eventId, deadline) => ({
  id, userId: 'u', title, description: null, importance: 8, urgency: 7, priority: 87, status: 'PENDING',
  estimatedMinutes: null, actualMinutes: null, scheduledStart: null, scheduledEnd: null, deadline,
  completedAt: null, isRecurring: false, parentTaskId: parentId, chainName: null, calendarEventId: eventId,
  calendarAccountId: 'a1', calendarId: null, tags: null, notes: null, aiSuggested: false,
  createdAt: at(-30, 9), updatedAt: at(-30, 9), subTasks: [],
})
const tasks = [
  mk('t-head', 'Train to Paris Gare de l’Est', null, 'ev-head', at(-2, 11)),
  mk('t-stage', 'Train to Metz', 't-head', null, at(-6, 11)),
]

const patches = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
await ctx.addInitScript(() => {
  localStorage.setItem('flowplan-store', JSON.stringify({ state: { hasCompletedOnboarding: true, language: 'fr', hideHabitsViews: ['calendar'], matrixExcludePatterns: [], todayExcludePatterns: [], activeView: 'calendar', primaryTimezone: null, secondaryTimezone: null }, version: 0 }))
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && !/ERR_|Failed to load resource|ClientFetchError/.test(t)) errors.push('console: ' + t.slice(0, 200)) })

await page.route('**/api/calendar/events**', (route) =>
  route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(events) })
    : route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }))
await page.route('**/api/calendar/accounts**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'a1', name: 'Google', provider: 'GOOGLE', color: '#c44a3a', isActive: true, subCalendars: [] }]) }))
await page.route('**/api/tasks**', (route) => {
  const req = route.request()
  const url = new URL(req.url())
  if (req.method() === 'GET' && url.pathname === '/api/tasks') {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tasks) })
  }
  if (req.method() === 'PATCH') {
    const body = JSON.parse(req.postData() ?? '{}')
    const id = url.pathname.split('/').pop()
    patches.push({ id, ...body })
    const t = tasks.find((x) => x.id === id)
    if (t) Object.assign(t, body)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(t ?? {}) })
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
})

await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: /démo|demo/i }).first().click()
await page.waitForURL('**/today', { timeout: 30000 })
await page.goto('http://localhost:3000/calendar', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)

const titleBtn = page.getByRole('button', { name: 'Train to Paris Gare de l’Est' }).first()
console.log('auto title (latest member) shown:', await titleBtn.count() > 0)
await page.screenshot({ path: `${OUT}/rename-1-auto.png` })

// Click the title → it should become an input, not toggle the chain
await titleBtn.click()
await page.waitForTimeout(400)
const input = page.locator('input[placeholder="Train to Paris Gare de l’Est"]')
console.log('title turned into an input:', await input.count() > 0)
await input.fill('Voyage Metz → Paris')
await page.locator('span', { hasText: 'CHAÎNES' }).first().click()      // click away
await page.waitForTimeout(900)
console.log('PATCH sent:', JSON.stringify(patches.at(-1)))
console.log('sidebar now shows:', (await page.locator('button', { hasText: 'Voyage Metz' }).first().innerText().catch(() => '(not found)')).trim())
await page.screenshot({ path: `${OUT}/rename-2-named.png` })

// The chevron still expands
await page.locator('button[aria-expanded]').first().click()
await page.waitForTimeout(500)
const memberVisible = await page.getByRole('button', { name: /Train to Metz/ }).count()
console.log('chevron still expands the chain:', memberVisible > 0)
await page.screenshot({ path: `${OUT}/rename-3-expanded.png` })

// Clearing the name falls back to the automatic title
await page.getByRole('button', { name: 'Voyage Metz → Paris' }).first().click()
await page.waitForTimeout(300)
await page.locator('input').first().fill('')
await page.locator('span', { hasText: 'CHAÎNES' }).first().click()
await page.waitForTimeout(900)
console.log('PATCH on clear:', JSON.stringify(patches.at(-1)))
console.log('fallback title back:', await page.getByRole('button', { name: 'Train to Paris Gare de l’Est' }).count() > 0)

console.log('errors:', errors.length ? errors : 'none')
await browser.close()
