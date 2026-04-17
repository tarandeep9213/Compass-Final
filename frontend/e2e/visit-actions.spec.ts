import { test, expect, request, Page } from '@playwright/test'
import { execSync } from 'child_process'

const BASE_UI = 'http://localhost:3003'
const BASE_API = 'http://localhost:8004/v1'
const EMAIL = 'con@compass.com'
const PASSWORD = 'demo1234'

const BACKEND_DIR = 'E:/Master - slave/Damco material/Compass-final-clone/backend'
const SEED_SCRIPT = 'E:/Master - slave/Damco material/Compass-final-clone/frontend/e2e/_visit_seed.py'

function seed(action: 'seed' | 'clear') {
  execSync(`python "${SEED_SCRIPT}" ${action}`, { cwd: BACKEND_DIR, stdio: 'inherit' })
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDisplay(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` }

function dates() {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const mondayOffset = ((1 - today.getDay() + 7) % 7) || 7
  const future = new Date(today.getTime() + mondayOffset * 86400000)
  const futureStr = future.toISOString().slice(0, 10)
  const past = new Date(today.getTime() - 86400000)
  const pastStr = past.toISOString().slice(0, 10)
  return {
    todayStr, futureStr, pastStr,
    todayDisplay: fmtDisplay(today),
    futureDisplay: fmtDisplay(future),
    pastDisplay: fmtDisplay(past),
  }
}

async function login(page: Page) {
  await page.goto(BASE_UI)
  await page.evaluate(() => {
    localStorage.removeItem('ccs_token')
    localStorage.removeItem('ccs_refresh_token')
  })
  await page.goto(BASE_UI)
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('.btn-login-submit')
  await page.waitForSelector('.sidebar', { timeout: 10000 })
  // Navigate to the visits dashboard (sidebar label may vary — try common options)
  for (const label of [/Weekly Review Dashboard/i, /Weekly Review/i, /Visits/i, /Schedule/i]) {
    const item = page.locator('.nav-item').filter({ hasText: label }).first()
    if (await item.isVisible({ timeout: 1500 }).catch(() => false)) {
      await item.click()
      break
    }
  }
  await page.waitForTimeout(1500)
}

async function apiLogin(): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post(`${BASE_API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  return body.access_token
}

async function getVisitIdsByDate(token: string): Promise<Record<string, string>> {
  const ctx = await request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  const res = await ctx.get(
    `${BASE_API}/verifications/controller?location_id=loc-appleton&page_size=100`,
  )
  if (!res.ok()) {
    const txt = await res.text()
    throw new Error(`GET /verifications/controller failed: ${res.status()} ${txt}`)
  }
  const body = await res.json()
  const map: Record<string, string> = {}
  for (const v of body.items ?? []) {
    if (v.status === 'scheduled') map[v.verification_date] = v.id
  }
  return map
}

test.describe.serial('Controller visit actions — new SLA/time-less rules', () => {
  test.setTimeout(120000)

  test.beforeEach(() => {
    seed('seed')
  })

  test.afterAll(() => {
    seed('clear')
  })

  // ─── UI: button visibility for future/today/past rows ────────────────────
  test('UI — button visibility per row', async ({ page }) => {
    await login(page)
    const { todayDisplay, futureDisplay, pastDisplay } = dates()

    // All three rows should be visible somewhere in the tables
    for (const d of [futureDisplay, todayDisplay, pastDisplay]) {
      await expect(
        page.locator('tr', { hasText: d }).first(),
      ).toBeVisible({ timeout: 8000 })
    }

    const futureRow = page.locator('tr', { hasText: futureDisplay }).first()
    const todayRow = page.locator('tr', { hasText: todayDisplay }).first()
    const pastRow = page.locator('tr', { hasText: pastDisplay }).first()

    // Future → only Cancel
    await expect(futureRow.getByRole('button', { name: /Cancel/i })).toBeVisible()
    await expect(futureRow.getByRole('button', { name: /Mark as Completed/i })).toHaveCount(0)
    await expect(futureRow.getByRole('button', { name: /Mark as Missed/i })).toHaveCount(0)

    // Today → only Complete
    await expect(todayRow.getByRole('button', { name: /Mark as Completed/i })).toBeVisible()
    await expect(todayRow.getByRole('button', { name: /^Cancel$|⊘ Cancel/i })).toHaveCount(0)
    await expect(todayRow.getByRole('button', { name: /Mark as Missed/i })).toHaveCount(0)

    // Past → only Miss
    await expect(pastRow.getByRole('button', { name: /Mark as Missed/i })).toBeVisible()
    await expect(pastRow.getByRole('button', { name: /^Cancel$|⊘ Cancel/i })).toHaveCount(0)
    await expect(pastRow.getByRole('button', { name: /Mark as Completed/i })).toHaveCount(0)
  })

  // ─── API: backend rule enforcement ───────────────────────────────────────
  test('API — backend rejects mismatched actions', async () => {
    const token = await apiLogin()
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    })
    const ids = await getVisitIdsByDate(token)
    const { todayStr, futureStr, pastStr } = dates()

    const futureId = ids[futureStr]
    const todayId = ids[todayStr]
    const pastId = ids[pastStr]

    expect(futureId, 'future visit id').toBeTruthy()
    expect(todayId, 'today visit id').toBeTruthy()
    expect(pastId, 'past visit id').toBeTruthy()

    // --- Cancel rules: only future allowed ---
    const cancelToday = await ctx.patch(`${BASE_API}/verifications/controller/${todayId}/cancel`, { data: {} })
    expect(cancelToday.status()).toBe(400)

    const cancelPast = await ctx.patch(`${BASE_API}/verifications/controller/${pastId}/cancel`, { data: {} })
    expect(cancelPast.status()).toBe(400)

    const cancelFuture = await ctx.patch(`${BASE_API}/verifications/controller/${futureId}/cancel`, { data: {} })
    expect(cancelFuture.status()).toBe(200)

    // --- Miss rules: only past allowed (today within SLA rejects) ---
    // refresh state: future is now cancelled, re-seed to get it back scheduled
    // (Skip refresh — we already validated future was cancellable. Now test miss on today & past.)

    const missToday = await ctx.patch(`${BASE_API}/verifications/controller/${todayId}/miss`, { data: { missed_reason: 'test' } })
    expect(missToday.status()).toBe(400)   // within SLA

    // --- Complete rules: only today allowed ---
    const completePast = await ctx.patch(`${BASE_API}/verifications/controller/${pastId}/complete`, {
      data: { signature_data: 'x', observed_total: 1000 },
    })
    expect(completePast.status()).toBe(400)

    const completeToday = await ctx.patch(`${BASE_API}/verifications/controller/${todayId}/complete`, {
      data: { signature_data: 'x', observed_total: 1000 },
    })
    expect(completeToday.status()).toBe(200)

    // Past visit miss should now succeed
    const missPast = await ctx.patch(`${BASE_API}/verifications/controller/${pastId}/miss`, { data: { missed_reason: 'test' } })
    expect(missPast.status()).toBe(200)
  })

  // ─── API: confirm no early_completion_acknowledged required ──────────────
  test('API — complete today succeeds without early_completion_acknowledged', async () => {
    const token = await apiLogin()
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    })
    const ids = await getVisitIdsByDate(token)
    const { todayStr } = dates()
    const todayId = ids[todayStr]
    expect(todayId).toBeTruthy()

    const res = await ctx.patch(`${BASE_API}/verifications/controller/${todayId}/complete`, {
      data: { signature_data: 'x', observed_total: 1000 },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('completed')
  })
})
