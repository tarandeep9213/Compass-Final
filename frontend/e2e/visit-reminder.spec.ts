import { test, expect, request } from '@playwright/test'
import { execSync } from 'child_process'

const BASE_API = 'http://localhost:8002/v1'
const PASSWORD = 'demo1234'
const LOCATION = 'loc-appleton'

const CONTROLLER_EMAIL = 'rahuls18@damcogroup.com'
const DGM_EMAIL = 'rahulairesearcher@gmail.com'

const BACKEND_DIR = 'E:/Master - slave/Damco material/Compass-final-clone/backend'
const HELPER = 'E:/Master - slave/Damco material/Compass-final-clone/frontend/e2e/_reminder_setup.py'

function runPy(action: 'setup' | 'trigger_reminder' | 'teardown') {
  execSync(`python "${HELPER}" ${action}`, { cwd: BACKEND_DIR, stdio: 'inherit' })
}

async function apiLogin(email: string): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post(`${BASE_API}/auth/login`, {
    data: { email, password: PASSWORD },
  })
  if (!res.ok()) {
    throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`)
  }
  const body = await res.json()
  return body.access_token
}

function todayStr(): string {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

test.describe.serial('Visit day reminder — scheduled mail + 8AM reminder', () => {
  test.setTimeout(90000)

  test.beforeAll(() => {
    runPy('setup')
  })

  test.afterAll(() => {
    runPy('teardown')
  })

  test('Controller schedules today → immediate mail fires; reminder job fires second mail', async () => {
    const token = await apiLogin(CONTROLLER_EMAIL)
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    })

    // Schedule a visit for today — triggers N-05 "visit scheduled" mail
    const res = await ctx.post(`${BASE_API}/verifications/controller`, {
      data: { location_id: LOCATION, date: todayStr() },
    })
    expect(res.status(), await res.text()).toBe(201)

    // Wait a beat for BackgroundTasks (SMTP send) to flush
    await new Promise((r) => setTimeout(r, 4000))

    // Trigger the 8AM reminder job directly — second mail
    runPy('trigger_reminder')

    // Give SMTP a moment again
    await new Promise((r) => setTimeout(r, 4000))

    console.log(`\n✉  Check ${CONTROLLER_EMAIL} for TWO mails:\n   1) Visit Scheduled\n   2) Visit Day Reminder\n`)
  })

  test('DGM schedules today → immediate mail fires; reminder job fires second mail', async () => {
    const token = await apiLogin(DGM_EMAIL)
    const ctx = await request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    })

    const res = await ctx.post(`${BASE_API}/verifications/dgm`, {
      data: { location_id: LOCATION, date: todayStr() },
    })
    expect(res.status(), await res.text()).toBe(201)

    await new Promise((r) => setTimeout(r, 4000))

    // Trigger reminder — will iterate both today's visits but this spec is serial,
    // so the controller visit already got a reminder above. The DGM one gets one now.
    runPy('trigger_reminder')

    await new Promise((r) => setTimeout(r, 4000))

    console.log(`\n✉  Check ${DGM_EMAIL} for TWO mails:\n   1) Visit Scheduled\n   2) Visit Day Reminder\n`)
  })
})
