/**
 * Capture targets for the User Guide drift check.
 *
 * Each entry describes ONE screenshot the repo currently ships. The CI
 * drift checker (scripts/userguide-diff.mjs) captures every entry afresh
 * and compares against the committed PNG under
 * frontend/public/help/screenshots/{role}/{file}.
 *
 * Fields:
 *   role           — demo account to log in as (see CREDS map in diff script).
 *   panel          — sidebar panel id to navigate to.
 *   section        — (optional) crop to [data-screenshot="<name>"] sub-element.
 *   clickTrigger   — (optional) click [data-screenshot-trigger="<name>"] first
 *                    (used for modal + cross-panel captures).
 *   file           — filename under screenshots/{role}/.
 *   threshold      — (optional) per-target pixel-diff threshold override, e.g.
 *                    0.03 for targets with intrinsically dynamic content
 *                    (audit-trail timestamps, "today" dates, chart tooltips).
 *                    Default is USERGUIDE_DIFF_THRESHOLD env (0.005).
 *
 * Add an entry here whenever you reference a new screenshot from a guide .md.
 * The drift checker also warns about orphaned PNGs — files that exist on disk
 * but have no target entry.
 */
export default [
  // ── Alarm Tester ─────────────────────────────────────────────────────────
  { role: 'alarm-tester',   panel: 'alarm-history', file: 'history-monthly.png' },
  { role: 'alarm-tester',   panel: 'alarm-history', clickTrigger: 'tab-biannual',     file: 'history-biannual.png' },
  { role: 'alarm-tester',   panel: 'alarm-history', clickTrigger: 'nav-test-form',    file: 'test-form.png' },

  // ── Alarm Approver ───────────────────────────────────────────────────────
  { role: 'alarm-approver', panel: 'alarm-approval',      file: 'approval.png' },
  { role: 'alarm-approver', panel: 'alarm-approval', clickTrigger: 'review-first', file: 'review-detail.png' },
  { role: 'alarm-approver', panel: 'alarm-overview',      file: 'overview.png' },
  { role: 'alarm-approver', panel: 'alarm-trends',        file: 'trends.png' },
  { role: 'alarm-approver', panel: 'alarm-escalation',    file: 'escalation.png' },
  // audit-trail shows per-event timestamps that shift every run → higher threshold.
  { role: 'alarm-approver', panel: 'alarm-audit-trail',   file: 'audit-trail.png', threshold: 0.04 },

  // ── Alarm Admin ──────────────────────────────────────────────────────────
  { role: 'alarm-admin', panel: 'alarm-building-setup',  file: 'buildings.png' },
  { role: 'alarm-admin', panel: 'alarm-building-setup', clickTrigger: 'add-building', file: 'building-add-modal.png' },
  { role: 'alarm-admin', panel: 'alarm-building-setup', clickTrigger: 'sub-alarm-user-access', file: 'user-access.png' },
  { role: 'alarm-admin', panel: 'alarm-zone-config',     file: 'zones.png' },
  { role: 'alarm-admin', panel: 'alarm-compliance-rules', file: 'compliance-rules.png' },
  { role: 'alarm-admin', panel: 'alarm-user-mgmt',       file: 'users.png' },
  { role: 'alarm-admin', panel: 'alarm-overview',        file: 'overview.png' },
  // audit-trail shows per-event timestamps that shift every run → higher threshold.
  { role: 'alarm-admin', panel: 'alarm-audit-trail',     file: 'audit-trail.png', threshold: 0.04 },

  // ── Regional Controller ──────────────────────────────────────────────────
  { role: 'regional-controller', panel: 'rc-biz-dash', file: 'biz-dash-full.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'kpi-row',            file: 'biz-dash-kpis.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'coverage-strip',    file: 'biz-dash-coverage.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'compliance-trend',  file: 'biz-dash-compliance-trend.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'top-at-risk',       file: 'biz-dash-at-risk.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'operator-behaviour', file: 'biz-dash-op-behaviour.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'controller-activity', file: 'biz-dash-controller.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'dgm-coverage',      file: 'biz-dash-dgm.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'slowest-approvers', file: 'biz-dash-slowest.png' },
  { role: 'regional-controller', panel: 'rc-biz-dash', section: 'location-detail',   file: 'biz-dash-loc-detail.png' },
  { role: 'regional-controller', panel: 'rc-location-review', file: 'location-review.png' },
]
