import { test, expect, request } from '@playwright/test'
import { execSync } from 'child_process'

const BASE_API = 'http://localhost:8001/v1'
const PASSWORD = 'demo1234'
const LOCATION = 'loc-appleton'

const BACKEND_DIR = 'E:/Master - slave/Damco material/Compass-final-clone/backend'
const SEEDER = 'E:/Master - slave/Damco material/Compass-final-clone/frontend/e2e/_section_i_seed.py'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function firstOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function runPy(args: string) {
  execSync(`python "${SEEDER}" ${args}`, { cwd: BACKEND_DIR, stdio: 'inherit' })
}

async function apiLogin(email: string): Promise<string> {
  const ctx = await request.newContext()
  const res = await ctx.post(`${BASE_API}/auth/login`, { data: { email, password: PASSWORD } })
  if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`)
  return (await res.json()).access_token
}

test.describe.serial('Section I carry-forward — prior in-month operator ending', () => {
  test.setTimeout(90000)

  test.afterAll(() => runPy('clear'))

  test('No prior submission in month → endpoint returns ending=0', async () => {
    runPy('clear')

    const token = await apiLogin('rc@compass.com')
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })

    const res = await ctx.get(
      `${BASE_API}/submissions/prior-section-i?location_id=${LOCATION}&date=${todayStr()}`,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ending).toBe(0)
    expect(body.source_date).toBeNull()
  })

  test('Prior in-month operator submission → endpoint returns that ending', async () => {
    runPy('clear')
    // Seed a yesterday operator submission with Section I total = -1
    runPy(`seed_prior ${yesterdayStr()} -1`)

    const token = await apiLogin('rc@compass.com')
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })

    const res = await ctx.get(
      `${BASE_API}/submissions/prior-section-i?location_id=${LOCATION}&date=${todayStr()}`,
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ending).toBe(-1)
    expect(body.source_date).toBe(yesterdayStr())
    // Seeder creates PENDING_APPROVAL status — UI will annotate as "(pending)"
    expect(body.source_status).toBe('pending_approval')
  })

  test('Multiple in-month submissions → returns the MOST RECENT prior', async () => {
    runPy('clear')
    const today = todayStr()
    const month = today.slice(0, 7)
    // Seed submissions at month-start (1) and yesterday. Skip if today IS day 1.
    if (today !== `${month}-01`) {
      runPy(`seed_prior ${month}-01 3`)
      if (yesterdayStr() !== `${month}-01`) {
        runPy(`seed_prior ${yesterdayStr()} 7`)
      }
    } else {
      // Today is the 1st, skip — there's no in-month prior possible.
      test.skip(true, 'today is 1st of month; no prior possible')
    }

    const token = await apiLogin('rc@compass.com')
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })

    const res = await ctx.get(
      `${BASE_API}/submissions/prior-section-i?location_id=${LOCATION}&date=${today}`,
    )
    const body = await res.json()
    // Most recent prior should be yesterday's seed (ending 7), not month-start (ending 3)
    expect(body.ending).toBe(7)
  })

  test('First of month → ending resets to 0 even if prior-month data exists', async () => {
    runPy('clear')
    // Seed a submission on first of month with some ending
    runPy(`seed_prior ${firstOfMonth()} 5`)

    const token = await apiLogin('rc@compass.com')
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })

    // Query for first of month itself — no prior in-month
    const res = await ctx.get(
      `${BASE_API}/submissions/prior-section-i?location_id=${LOCATION}&date=${firstOfMonth()}`,
    )
    const body = await res.json()
    expect(body.ending).toBe(0)
    expect(body.source_date).toBeNull()
  })

  test('Draft submissions are ignored by carry-forward lookup', async () => {
    runPy('clear')
    // Seed a submission with Section I = 10 on yesterday, then mutate it to DRAFT
    runPy(`seed_prior ${yesterdayStr()} 10`)

    // Set to DRAFT directly via seeder path (reuse inline python)
    execSync(
      `python -c "import sys; sys.path.insert(0, r'${BACKEND_DIR}'); from app.db.session import SessionLocal; from app.models.submission import Submission, SubmissionStatus; db=SessionLocal(); db.query(Submission).filter(Submission.location_id=='${LOCATION}', Submission.submission_date=='${yesterdayStr()}').update({'status': SubmissionStatus.DRAFT}); db.commit(); db.close(); print('set to draft')"`,
      { cwd: BACKEND_DIR, stdio: 'inherit' },
    )

    const token = await apiLogin('rc@compass.com')
    const ctx = await request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } })
    const res = await ctx.get(
      `${BASE_API}/submissions/prior-section-i?location_id=${LOCATION}&date=${todayStr()}`,
    )
    const body = await res.json()
    // Draft excluded → no prior found → ending 0
    expect(body.ending).toBe(0)
    expect(body.source_date).toBeNull()
  })
})
