#!/usr/bin/env node
/**
 * User Guide screenshot drift checker.
 *
 * For every entry in scripts/userguide-targets.mjs, capture a fresh screenshot
 * to a temp dir and compare its bytes against the committed PNG under
 * frontend/public/help/screenshots/{role}/{file}. Exit non-zero if any differ.
 *
 * Usage:
 *   node scripts/userguide-diff.mjs [--update]
 *
 *   --update   Overwrite committed PNGs with the fresh captures (use locally
 *              after an intentional UI change to refresh the baseline).
 *
 * Requires:
 *   - Frontend running on http://localhost:3000 (override with FRONTEND_URL).
 *   - Backend reachable at whatever VITE_API_URL the frontend points to.
 *   - @playwright/test installed in frontend/ (already a devDep).
 *
 * Designed to run in CI. The workflow at .github/workflows/userguide-drift.yml
 * spins up the dev servers and then invokes this script.
 */
import { copyFile, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import process from 'node:process'

import targets from './userguide-targets.mjs'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT  = resolve(dirname(__filename), '..')
const FRONTEND   = resolve(REPO_ROOT, 'frontend')
const SHOT_ROOT  = resolve(FRONTEND, 'public', 'help', 'screenshots')

// Resolve playwright + pixelmatch from frontend/node_modules.
const require = createRequire(pathToFileURL(resolve(FRONTEND, 'package.json')).href)
const { chromium } = require('playwright')
const pixelmatch = require('pixelmatch').default || require('pixelmatch')
const { PNG } = require('pngjs')

// Drift threshold: ratio of pixels that must differ before we flag drift.
// Set just above the noise floor we see from chart animations + anti-aliasing.
// Override via USERGUIDE_DIFF_THRESHOLD=0.01 for a stricter/looser check.
const DIFF_THRESHOLD = parseFloat(process.env.USERGUIDE_DIFF_THRESHOLD ?? '0.005')
// Per-pixel tolerance passed to pixelmatch (0 = exact, 1 = any color).
const PIXEL_TOLERANCE = parseFloat(process.env.USERGUIDE_PIXEL_TOLERANCE ?? '0.12')

const CREDS = {
  operator:             { email: 'laura.diehl@compass.com',    password: 'demo1234' },
  controller:           { email: 'terri.serrano@compass.com',  password: 'demo1234' },
  dgm:                  { email: 'john.ranallo@compass.com',   password: 'demo1234' },
  admin:                { email: 'rahuls18@damcogroup.com',    password: 'demo1234' },
  'regional-controller':{ email: 'kyle.decker@compass.com',    password: 'demo1234' },
  'alarm-tester':       { email: 'tester@alarm.compass.com',   password: 'demo1234' },
  'alarm-approver':     { email: 'approver@alarm.compass.com', password: 'demo1234' },
  'alarm-admin':        { email: 'alarmadmin@alarm.compass.com', password: 'demo1234' },
}

const ROLE_MODE = {
  'alarm-tester':   'alarm',
  'alarm-approver': 'alarm',
  'alarm-admin':    'alarm',
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
const UPDATE = process.argv.includes('--update')

// ── Utilities ──────────────────────────────────────────────────────────────
async function readPng(path) {
  try {
    const buf = await readFile(path)
    return PNG.sync.read(buf)
  } catch {
    return null
  }
}

async function fileExists(path) {
  try { await stat(path); return true } catch { return false }
}

/**
 * Compare two PNGs pixel-by-pixel.
 * Returns { ratio, diffPixels, width, height, diffBuf } or { sizeChanged: true }
 * when dimensions differ. Null baseline → { missing: true }.
 */
async function comparePng(committedPath, freshPath, diffOutPath) {
  const a = await readPng(committedPath)
  const b = await readPng(freshPath)
  if (!a) return { missing: true }
  if (!b) throw new Error(`fresh capture missing: ${freshPath}`)
  if (a.width !== b.width || a.height !== b.height) {
    return { sizeChanged: true, oldW: a.width, oldH: a.height, newW: b.width, newH: b.height }
  }
  const diff = new PNG({ width: a.width, height: a.height })
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: PIXEL_TOLERANCE })
  const ratio = diffPixels / (a.width * a.height)
  if (diffOutPath && diffPixels > 0) {
    await writeFile(diffOutPath, PNG.sync.write(diff))
  }
  return { ratio, diffPixels, width: a.width, height: a.height }
}

// ── Playwright capture (self-contained; mirrors the skill helper) ──────────
async function captureWithBrowser(target, outPath, browser) {
  const { role, panel, section, clickTrigger, file } = target
  const creds = CREDS[role]
  if (!creds) throw new Error(`unknown role: ${role}`)
  const mode = ROLE_MODE[role] || 'cashroom'
  const loginUrl = mode === 'alarm' ? `${FRONTEND_URL}/?mode=alarm` : FRONTEND_URL

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  try {
    await page.goto(loginUrl)
    await page.evaluate(() => {
      try { localStorage.removeItem('ccs_token'); localStorage.removeItem('ccs_refresh_token') } catch {}
    })
    await page.goto(loginUrl)
    await page.fill('input[type="email"]', creds.email)
    await page.fill('input[type="password"]', creds.password)
    await page.click('.btn-login-submit')
    await page.waitForSelector('.sidebar', { timeout: 15000 })

    // Navigate via sidebar data-panel.
    await page.evaluate((p) => {
      const items = Array.from(document.querySelectorAll('.nav-item'))
      for (const el of items) {
        if (el.getAttribute('data-panel') === p) { el.click(); return true }
      }
      return false
    }, panel)
    await page.waitForSelector('.fade-up', { timeout: 15000 })
    // Wait for the panel's XHRs to finish so charts/tables are populated.
    try { await page.waitForLoadState('networkidle', { timeout: 10000 }) } catch {}
    await page.waitForTimeout(1500) // final settle for fonts + chart animations

    if (clickTrigger) {
      const sel = `[data-screenshot-trigger="${clickTrigger}"]`
      try {
        await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 })
      } catch {
        throw new Error(`click trigger not found: ${clickTrigger} (${role}/${file})`)
      }
      const loc = page.locator(sel).first()
      await loc.scrollIntoViewIfNeeded()
      await loc.click()
      await page.waitForTimeout(800) // settle post-click (modal mount, nav render)
    }

    if (section) {
      const sel = `[data-screenshot="${section}"]`
      try {
        await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 })
      } catch {
        throw new Error(`section not found: ${section} (${role}/${file})`)
      }
      const loc = page.locator(sel).first()
      await loc.scrollIntoViewIfNeeded()
      await page.waitForTimeout(500) // settle post-scroll
      await loc.screenshot({ path: outPath })
    } else {
      await page.screenshot({ path: outPath, fullPage: true })
    }
  } finally {
    await ctx.close()
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[drift] ${targets.length} targets · ${UPDATE ? 'UPDATE mode' : 'check mode'} · ${FRONTEND_URL}`)
  const tmpDir = await mkdtemp(join(tmpdir(), 'userguide-diff-'))
  const browser = await chromium.launch({ headless: true })

  const drifted = []
  const missing = []
  const errors = []

  try {
    for (const t of targets) {
      const committed = join(SHOT_ROOT, t.role, t.file)
      const fresh = join(tmpDir, `${t.role}__${t.file}`)
      const diffPath = join(tmpDir, `${t.role}__diff__${t.file}`)
      const label = `${t.role}/${t.file}`

      try {
        await captureWithBrowser(t, fresh, browser)
      } catch (err) {
        errors.push({ target: t, error: err.message })
        console.error(`[drift] ✗ ${label} — capture failed: ${err.message}`)
        continue
      }

      let cmp
      try {
        cmp = await comparePng(committed, fresh, diffPath)
      } catch (err) {
        errors.push({ target: t, error: err.message })
        console.error(`[drift] ✗ ${label} — compare failed: ${err.message}`)
        continue
      }

      if (cmp.missing) {
        missing.push({ ...t, fresh })
        console.log(`[drift] + ${label} — NEW (no committed baseline)`)
        if (UPDATE) await copyFile(fresh, committed)
        continue
      }
      if (cmp.sizeChanged) {
        drifted.push({ ...t, ratio: 1, sizeChanged: true, fresh, diffPath })
        console.log(`[drift] ± ${label} — SIZE CHANGED (${cmp.oldW}x${cmp.oldH} → ${cmp.newW}x${cmp.newH})`)
        if (UPDATE) await copyFile(fresh, committed)
        continue
      }
      const threshold = t.threshold ?? DIFF_THRESHOLD
      if (cmp.ratio > threshold) {
        drifted.push({ ...t, ratio: cmp.ratio, fresh, diffPath, threshold })
        console.log(`[drift] ± ${label} — CHANGED (${(cmp.ratio * 100).toFixed(3)}% of pixels differ, threshold ${(threshold * 100).toFixed(2)}%)`)
        if (UPDATE) await copyFile(fresh, committed)
        continue
      }
      const pct = (cmp.ratio * 100).toFixed(3)
      const tInfo = t.threshold ? ` / ${(t.threshold * 100).toFixed(2)}% target threshold` : ''
      console.log(`[drift] · ${label}${cmp.ratio > 0 ? ` (${pct}% noise${tInfo}, within threshold)` : ''}`)
    }
  } finally {
    await browser.close()
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('')
  console.log(`[drift] ─────────────────────────────────────────`)
  console.log(`[drift] Targets: ${targets.length}`)
  console.log(`[drift]  clean:   ${targets.length - drifted.length - missing.length - errors.length}`)
  console.log(`[drift]  drifted: ${drifted.length}`)
  console.log(`[drift]  missing: ${missing.length}`)
  console.log(`[drift]  errors:  ${errors.length}`)

  // ── GitHub Actions step summary (when running under Actions) ────────────
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises')
    const lines = [
      '## User Guide screenshot drift',
      '',
      `- **Targets**: ${targets.length}`,
      `- **Clean**: ${targets.length - drifted.length - missing.length - errors.length}`,
      `- **Drifted**: ${drifted.length}`,
      `- **Missing baseline**: ${missing.length}`,
      `- **Errors**: ${errors.length}`,
      '',
    ]
    if (drifted.length) {
      lines.push('### Changed screenshots', '')
      lines.push('| Role | File | Δ | Capture args |')
      lines.push('|---|---|---|---|')
      for (const t of drifted) {
        const args = [t.panel, t.section && `section=${t.section}`, t.clickTrigger && `click=${t.clickTrigger}`].filter(Boolean).join(' · ')
        const delta = t.sizeChanged ? 'size' : `${(t.ratio * 100).toFixed(2)}%`
        lines.push(`| ${t.role} | ${t.file} | ${delta} | ${args} |`)
      }
      lines.push('',
        'Δ shows the percentage of pixels that differ against the committed PNG.',
        `Threshold: **${(DIFF_THRESHOLD * 100).toFixed(2)}%**.`,
        '',
        'If the UI change is intentional: run `node scripts/userguide-diff.mjs --update` locally and commit the refreshed PNGs + any guide prose updates.',
        'If not: the PR has unintentionally changed a documented screen — look at the diff artifacts or adjust the PR to match the guide.',
        '')
    }
    if (errors.length) {
      lines.push('### Errors', '')
      for (const e of errors) {
        lines.push(`- **${e.target.role}/${e.target.file}** — ${e.error}`)
      }
      lines.push('')
    }
    await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
  }

  // Orphan scan: PNGs in committed tree that no target references.
  const referencedByRole = new Map()
  for (const t of targets) {
    if (!referencedByRole.has(t.role)) referencedByRole.set(t.role, new Set())
    referencedByRole.get(t.role).add(t.file)
  }
  const { readdir } = await import('node:fs/promises')
  const orphans = []
  try {
    const roles = await readdir(SHOT_ROOT)
    for (const role of roles) {
      const files = await readdir(join(SHOT_ROOT, role)).catch(() => [])
      const refs = referencedByRole.get(role)
      for (const f of files) {
        if (!f.endsWith('.png')) continue
        if (!refs || !refs.has(f)) orphans.push(`${role}/${f}`)
      }
    }
  } catch {}
  if (orphans.length) {
    console.log('')
    console.log(`[drift] Orphan PNGs (no target entry — add to userguide-targets.mjs or delete):`)
    for (const o of orphans) console.log(`[drift]   ? ${o}`)
  }

  if (errors.length) process.exit(2) // infrastructure failure
  if (drifted.length || missing.length) process.exit(1) // drift detected
  console.log('[drift] ✓ no drift')
  process.exit(0)
}

main().catch(err => {
  console.error('[drift] fatal:', err)
  process.exit(2)
})
