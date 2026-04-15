import { useState, useMemo } from 'react'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 15


function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)          return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4)  return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

type AuditCategory = 'access' | 'building' | 'testing' | 'config'

interface AuditEvent {
  id: string
  timestamp: string
  action: string
  userName: string
  details: string
  category: AuditCategory
}

const CATEGORY_COLORS: Record<AuditCategory, { bg: string; color: string }> = {
  access:   { bg: '#dbeafe', color: '#1e40af' },
  building: { bg: '#dcfce7', color: '#166534' },
  testing:  { bg: '#fef3c7', color: '#92400e' },
  config:   { bg: '#f3e8ff', color: '#6b21a8' },
}

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  access: 'Access',
  building: 'Buildings',
  testing: 'Testing',
  config: 'Config',
}

function generateMockEvents(): AuditEvent[] {
  const now = Date.now()
  const DAY = 86_400_000
  let id = 0

  const events: Omit<AuditEvent, 'id' | 'timestamp'>[] = [
    { action: 'ACCESS_GRANTED',  userName: 'Admin User',      details: 'Granted Tester access to Chris Controller for Wausau Office',       category: 'access' },
    { action: 'ACCESS_REVOKED',  userName: 'Admin User',      details: 'Revoked Approver access for Jamie Roberts RC',                      category: 'access' },
    { action: 'ACCESS_GRANTED',  userName: 'Admin User',      details: 'Granted Approver access to Sarah Safety for Chicago North',          category: 'access' },
    { action: 'BUILDING_ADDED',  userName: 'Admin User',      details: 'Added building Tampa Bay Center',                                   category: 'building' },
    { action: 'BUILDING_UPDATED',userName: 'Admin User',      details: 'Updated Chicago North security details',                            category: 'building' },
    { action: 'BUILDING_ADDED',  userName: 'Admin User',      details: 'Added building Orlando Mall',                                       category: 'building' },
    { action: 'TEST_SUBMITTED',  userName: 'Chris Controller', details: 'Test submitted for Wausau Office (March 2026)',                     category: 'testing' },
    { action: 'TEST_APPROVED',   userName: 'Sarah Safety',     details: 'Test approved for Atlanta Hub (March 2026)',                        category: 'testing' },
    { action: 'TEST_REJECTED',   userName: 'Sarah Safety',     details: 'Test rejected for Milwaukee Center (February 2026)',                category: 'testing' },
    { action: 'TEST_SUBMITTED',  userName: 'Tester One',       details: 'Test submitted for Boston Tower (March 2026)',                      category: 'testing' },
    { action: 'TEST_APPROVED',   userName: 'Jamie Roberts RC', details: 'Test approved for Wausau Office (February 2026)',                   category: 'testing' },
    { action: 'RULES_UPDATED',   userName: 'Admin User',      details: 'Compliance rules updated: deadline day changed to 15',               category: 'config' },
    { action: 'RULES_UPDATED',   userName: 'Admin User',      details: 'Compliance rules updated: escalation tier 1 delay set to 3 days',   category: 'config' },
    { action: 'ZONE_ADDED',      userName: 'Admin User',      details: "Added zone 'Main Entrance' to Boston Tower",                        category: 'building' },
    { action: 'ZONE_ADDED',      userName: 'Admin User',      details: "Added zone 'Vault Motion Sensor' to Chicago North",                 category: 'building' },
    { action: 'ESCALATION_SENT', userName: 'System',           details: 'Tier 2 escalation sent for Orlando Mall',                           category: 'testing' },
    { action: 'ESCALATION_SENT', userName: 'System',           details: 'Tier 1 escalation sent for Milwaukee Center',                       category: 'testing' },
    { action: 'TEST_SUBMITTED',  userName: 'Chris Controller', details: 'Test submitted for Chicago North (March 2026)',                     category: 'testing' },
  ]

  return events.map((e, i) => ({
    ...e,
    id: `audit-${++id}`,
    timestamp: new Date(now - Math.floor((i + 1) * (30 * DAY / events.length)) + Math.floor(Math.random() * DAY * 0.5)).toISOString(),
  })).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function AlarmAuditTrail({ adminName, onNavigate: _onNavigate }: Props) {
  const events = useMemo(generateMockEvents, [])

  const [catFilter, setCatFilter] = useState<'all' | AuditCategory>('all')
  const [search, setSearch]       = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [page, setPage]           = useState(0)

  // Category counts
  const counts = useMemo(() => {
    const c = { all: events.length, access: 0, building: 0, testing: 0, config: 0 }
    for (const e of events) c[e.category]++
    return c
  }, [events])

  // Filtered events
  const filtered = useMemo(() => {
    return events.filter(e => {
      if (catFilter !== 'all' && e.category !== catFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.details.toLowerCase().includes(q) && !e.userName.toLowerCase().includes(q) && !e.action.toLowerCase().includes(q)) return false
      }
      if (dateFrom) {
        const from = new Date(dateFrom)
        if (new Date(e.timestamp) < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(e.timestamp) > to) return false
      }
      return true
    })
  }, [events, catFilter, search, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  const categoryPills: { key: 'all' | AuditCategory; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'access',   label: 'Access' },
    { key: 'building', label: 'Buildings' },
    { key: 'testing',  label: 'Testing' },
    { key: 'config',   label: 'Config' },
  ]

  return (
    <div className="fade-up">
      {/* Page header */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Alarm Audit Trail</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>Log of all key actions in the alarm testing module &middot; {adminName}</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => {
            const headers = ['Timestamp', 'User', 'Action', 'Category', 'Details']
            const rows = filtered.map(e => [
              formatTimestamp(e.timestamp),
              e.userName,
              e.action,
              CATEGORY_LABELS[e.category],
              e.details,
            ])
            const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `alarm-audit-trail.csv`
            a.click()
            URL.revokeObjectURL(url)
          }}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Audit log card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Activity Log</span>
          <span style={{ fontSize: 12, color: 'var(--ts)' }}>{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Filter row */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ow2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {categoryPills.map(cp => (
            <span
              key={cp.key}
              onClick={() => { setCatFilter(cp.key); setPage(0) }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: `1.5px solid ${catFilter === cp.key ? 'var(--g7)' : 'var(--ow2)'}`,
                background: catFilter === cp.key ? 'var(--g7)' : 'transparent',
                color: catFilter === cp.key ? '#fff' : 'var(--tm)',
              }}
            >
              {cp.label}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                fontSize: 10,
                fontWeight: 700,
                background: catFilter === cp.key ? 'rgba(255,255,255,0.25)' : 'var(--ow2)',
                color: catFilter === cp.key ? '#fff' : 'var(--ts)',
              }}>
                {counts[cp.key]}
              </span>
            </span>
          ))}

          <input
            className="f-inp"
            placeholder="Search events..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ marginLeft: 'auto', width: 180, fontSize: 12, padding: '6px 10px' }}
          />
          <input
            type="date"
            className="f-inp"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0) }}
            style={{ width: 130, fontSize: 12, padding: '6px 10px' }}
          />
          <span style={{ fontSize: 12, color: 'var(--ts)' }}>to</span>
          <input
            type="date"
            className="f-inp"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0) }}
            style={{ width: 130, fontSize: 12, padding: '6px 10px' }}
          />
        </div>

        {/* Table */}
        <div style={{ padding: 0 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No audit events found</div>
              <div>Try adjusting your filters or date range.</div>
            </div>
          )}
          {filtered.length > 0 && (<>
            <table className="dt">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(ev => {
                  const cat = CATEGORY_COLORS[ev.category]
                  return (
                    <tr key={ev.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--ts)' }}>{formatTimestamp(ev.timestamp)}</td>
                      <td style={{ fontSize: 13, fontWeight: 500 }}>{ev.userName}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 600,
                          background: cat.bg,
                          color: cat.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {ev.action.replace(/_/g, ' ')}
                        </span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--ts)', marginTop: 2 }}>
                          {CATEGORY_LABELS[ev.category]}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{ev.details}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)' }}>
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromRow}&ndash;{toRow} of {filtered.length} events</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
                  {pageNums(page, totalPages).map((n, i) => n === 'gap'
                    ? <span key={`g${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>&hellip;</span>
                    : <button key={n} onClick={() => setPage(n as number)} style={{ width: 30, height: 30, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: page === n ? 700 : 400, border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`, background: page === n ? 'var(--g7)' : '#fff', color: page === n ? '#fff' : 'var(--td)' }}>{(n as number) + 1}</button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
                </div>
              </div>
            )}
          </>)}
        </div>
      </div>
    </div>
  )
}
