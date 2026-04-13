import React, { useState, useEffect, useRef } from 'react'
import Login, { type Role } from './pages/Login'
import { getLocation } from './mock/data'
import { hasAccess } from './utils/operatorAccess'
import { me, logout, refresh, changePassword } from './api/auth'
import { getToken } from './api/client'
import type { ApiRole, AuthUser } from './api/types'
import { writeGrants } from './utils/operatorAccess'
import { listLocations } from './api/locations'
import { listUsers } from './api/admin'
import { LOCATIONS, USERS, saveStored } from './mock/data'

function apiRoleToRole(apiRole: ApiRole): Role {
  const map: Partial<Record<ApiRole, Role>> = {
    OPERATOR:            'operator',
    CONTROLLER:          'controller',
    DGM:                 'dgm',
    ADMIN:               'admin',
    REGIONAL_CONTROLLER: 'regional-controller',
  }
  return map[apiRole] ?? 'operator'
}
import OpStart   from './pages/operator/OpStart'
import OpMethod  from './pages/operator/OpMethod'
import OpForm    from './pages/operator/OpForm'
import OpChat    from './pages/operator/OpChat'
import OpExcel   from './pages/operator/OpExcel'
import OpReadonly from './pages/operator/OpReadonly'
import OpMissed     from './pages/operator/OpMissed'
import MgrApprovals  from './pages/manager/MgrApprovals'
import MgrHistory    from './pages/manager/MgrHistory'
import CtrlLog       from './pages/controller/CtrlLog'
import CtrlDashboard from './pages/controller/CtrlDashboard'
import CtrlHistory   from './pages/controller/CtrlHistory'
import CtrlDgmReview from './pages/controller/CtrlDgmReview'
import OpDrafts      from './pages/operator/OpDrafts'
import DGMDash        from './pages/dgm/DGMDash'
import DGMLog         from './pages/dgm/DGMLog'
import DGMHistory     from './pages/dgm/DGMHistory'
import AdmLocations   from './pages/admin/AdmLocations'
import AdmUsers       from './pages/admin/AdmUsers'
import AdmConfig      from './pages/admin/AdmConfig'
import AdmAudit       from './pages/admin/AdmAudit'
import AdmReports     from './pages/admin/AdmReports'
import AdmImport      from './pages/admin/AdmImport'
import RcTrends       from './pages/regional-controller/RcTrends'
import RcBizDash      from './pages/regional-controller/RcBizDash'
import './index.css'

interface AuthState { userId: string; role: Role; name: string; locationIds: string[] }
interface NavCtx   { panel: string; ctx: Record<string, string> }

// ── Role-based nav items ───────────────────────────────────────────────────
function navItems(role: Role): { id: string; icon: string; label: string; panel: string }[] {
  switch (role) {
    case 'operator': return [
      { id: 'submit', icon: '🏠', label: 'Dashboard', panel: 'op-start' },
    ]
    case 'controller': return [
      { id: 'daily-report', icon: '📋', label: 'Daily Review Dashboard',  panel: 'ctrl-daily-report' },
      { id: 'dashboard',    icon: '📊', label: 'Weekly Review Dashboard', panel: 'ctrl-dashboard'    },
      { id: 'dgm-review',   icon: '🔍', label: 'Review DGM Visits',      panel: 'ctrl-dgm-review'   },
    ]
    case 'dgm': return [
      { id: 'dashboard', icon: '📊', label: 'Coverage Dashboard', panel: 'dgm-dash' },
      { id: 'history',   icon: '🕓', label: 'History',            panel: 'dgm-history' },
    ]
    case 'admin': return [
      { id: 'audit',     icon: '📑', label: 'Audit Trail',   panel: 'adm-audit'    },
      { id: 'locations', icon: '📍', label: 'Locations',     panel: 'adm-locations' },
      { id: 'users',     icon: '👥', label: 'Users',         panel: 'adm-users' },
      { id: 'import',    icon: '📥', label: 'Import Roster', panel: 'adm-import' },
    ]
    case 'regional-controller': return [
      { id: 'biz-dash',   icon: '🎯', label: 'Business Dashboard',   panel: 'rc-biz-dash'   },
      { id: 'audit',      icon: '📑', label: 'Audit Trail',          panel: 'adm-audit' },
      { id: 'reports',    icon: '📊', label: 'Reports',              panel: 'adm-reports' },
      { id: 'trends',     icon: '📉', label: 'Cash Trends',          panel: 'rc-trends'   },
    ]
  }
}

const ROLE_LABELS: Record<Role, string> = {
  operator: 'Operator', controller: 'Controller',
  dgm: 'DGM', admin: 'Admin', 'regional-controller': 'Regional Controller',
}

function scheduleRefresh(
  token: string,
  timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>,
  setAuth: (v: AuthState | null) => void,
) {
  try {
    const payload    = JSON.parse(atob(token.split('.')[1]))
    const msToExpiry = payload.exp * 1000 - Date.now()
    const delay      = Math.max(msToExpiry - 60_000, 10_000) // refresh 1 min early, min 10s
    timerRef.current = setTimeout(async () => {
      try {
        const newToken = await refresh()
        scheduleRefresh(newToken, timerRef, setAuth)
      } catch {
        setAuth(null)
      }
    }, delay)
  } catch { /* non-JWT token or parse error — skip refresh scheduling */ }
}

// ── Coming Soon placeholder for screens not yet built ─────────────────────
function ComingSoon({ panel }: { panel: string; role?: Role }) {
  const screenMap: Record<string, string> = {
    'mgr-approvals': 'Screen 10: Pending Approvals',
    'mgr-history':   'Screen 11: Approval History',
    'ctrl-verify':   'Screen 12: Log Verification',
    'ctrl-history':  'Screen 13: Verification History',
    'dgm-dash':      'Screen 14: Monthly Status Dashboard',
    'dgm-log':       'Screen 15: Log Monthly Visit',
    'adm-locations': 'Screen 16: Admin — Locations',
    'adm-users':     'Screen 17: Admin — Users',
    'adm-config':    'Screen 18: Admin — Configuration',
    'adm-audit':     'Screen 20: Audit Trail',
    'adm-reports':   'Screen 21: Weekly Reports',
  }
  return (
    <div className="fade-up">
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
        <h2 style={{ fontFamily: 'DM Serif Display,serif', marginBottom: 8 }}>Coming Soon</h2>
        <p style={{ color: 'var(--ts)', fontSize: 13, marginBottom: 18 }}>
          <strong>{screenMap[panel] ?? panel}</strong> is being built next.
          Operator screens (1–9) are complete — this role's screens are next in the queue.
        </p>
        <span className="badge badge-amber"><span className="bdot"></span>In development</span>
      </div>
    </div>
  )
}

// ── Change Password Modal ──────────────────────────────────────────────────
function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px 36px 8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', fontSize: 16, lineHeight: 1 }}
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit() {
    setError('')
    if (!currentPw) { setError('Please enter your current password.'); return }
    if (newPw.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await changePassword(currentPw, newPw)
      setSuccess('Password changed successfully!')
      setTimeout(onClose, 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <h3 style={{ margin: '0 0 20px', fontFamily: 'DM Serif Display,serif', fontSize: 20 }}>Change Password</h3>
        {success ? (
          <p style={{ color: 'var(--g5)', fontWeight: 600 }}>{success}</p>
        ) : (
          <>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Current Password</label>
              <PasswordInput value={currentPw} onChange={setCurrentPw} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>New Password</label>
              <PasswordInput value={newPw} onChange={setNewPw} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Confirm New Password</label>
              <PasswordInput value={confirmPw} onChange={setConfirmPw} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSubmit} disabled={loading}
                style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--g5)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {loading ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── AppShell ───────────────────────────────────────────────────────────────
function AppShell({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  const eligible  = auth.role === 'dgm' || auth.role === 'regional-controller'
  const opAccess  = eligible && hasAccess(auth.userId, 'operator')
  const ctrlAccess= eligible && hasAccess(auth.userId, 'controller')
  const baseItems = navItems(auth.role)
  const items = [
    ...baseItems,
    ...(opAccess   ? [{ id: 'op-access',   icon: '🏧', label: 'Operator View',   panel: 'op-start'      }] : []),
    ...(ctrlAccess ? [{ id: 'ctrl-access', icon: '🔍', label: 'Controller View', panel: 'ctrl-dashboard' }] : []),
  ]
  const defaultPanel = items[0]?.panel ?? 'op-start'
  const [nav, setNav] = useState<NavCtx>({ panel: defaultPanel, ctx: {} })
  const [showChangePw, setShowChangePw] = useState(false)

  const initials = auth.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  function navigate(panel: string, ctx: Record<string, string> = {}) {
    setNav({ panel, ctx })
  }

  function renderPanel() {
    const { panel, ctx } = nav
    switch (panel) {
      // ── Operator panels ──────────────────────────────────────────────
      case 'op-start':    return <OpStart    locationIds={auth.locationIds} userName={auth.name} onNavigate={navigate} />
      case 'op-method':   return <OpMethod   ctx={ctx} onNavigate={navigate} />
      case 'op-form':     return <OpForm     ctx={ctx} onNavigate={navigate} />
      case 'op-chat':     return <OpChat     ctx={ctx} onNavigate={navigate} />
      case 'op-excel':    return <OpExcel    ctx={ctx} onNavigate={navigate} />
      case 'op-readonly': return <OpReadonly ctx={ctx} onNavigate={navigate} />
      case 'op-missed':   return <OpMissed   ctx={ctx} onNavigate={navigate} />
      case 'op-drafts':   return <OpDrafts   onNavigate={navigate} />

      // ── Manager panels ────────────────────────────────────────────────
      case 'mgr-approvals': return <MgrApprovals managerName={auth.name} locationIds={auth.locationIds} onNavigate={navigate} />
      case 'mgr-history':   return <MgrHistory   managerName={auth.name} locationIds={auth.locationIds} onNavigate={navigate} />

      // ── Controller panels ─────────────────────────────────────────────
      case 'ctrl-dashboard':    return <CtrlDashboard controllerName={auth.name} locationIds={auth.locationIds} ctx={nav.ctx} onNavigate={navigate} />
      case 'ctrl-schedule':     return <CtrlLog        controllerName={auth.name} locationIds={auth.locationIds} ctx={nav.ctx} onNavigate={navigate} />
      case 'ctrl-history':      return <CtrlHistory    controllerName={auth.name} locationIds={auth.locationIds} onNavigate={navigate} />
      case 'ctrl-daily-report': return <MgrApprovals   managerName={auth.name}   locationIds={auth.locationIds} onNavigate={navigate} />
      case 'ctrl-dgm-review':   return <CtrlDgmReview  controllerName={auth.name} locationIds={auth.locationIds} onNavigate={navigate} />

      // ── DGM panels ────────────────────────────────────────────────────
      case 'dgm-dash':    return <DGMDash    dgmName={auth.name} locationIds={auth.locationIds} ctx={nav.ctx} onNavigate={navigate} />
      case 'dgm-history': return <DGMHistory dgmName={auth.name} locationIds={auth.locationIds} onNavigate={navigate} />
      case 'dgm-log':     return <DGMLog     dgmName={auth.name} locationIds={auth.locationIds} ctx={nav.ctx} onNavigate={navigate} />

      // ── Admin panels ─────────────────────────────────────────────────
      case 'adm-locations':  return <AdmLocations  adminName={auth.name} />
      case 'adm-users':      return <AdmUsers      adminName={auth.name} />
      case 'adm-config':     return <AdmConfig     adminName={auth.name} />
      case 'adm-audit':      return <AdmAudit      adminName={auth.name} />
      case 'adm-reports':    return <AdmReports    adminName={auth.name} />
      case 'adm-import':     return <AdmImport     adminName={auth.name} />

      // ── Regional Controller panels ──────────────────────────────────
      case 'rc-biz-dash': return <RcBizDash adminName={auth.name} />
      case 'rc-trends': return <RcTrends adminName={auth.name} />

      // ── All other panels (coming soon) ───────────────────────────────
      default: return <ComingSoon panel={panel} role={auth.role} />
    }
  }

  // Determine which sidebar item is "active" (also covers sub-panels)
  const activeSidebarPanel = (() => {
    const p = nav.panel
    // Operator sub-panels: highlight Operator View for DGM/RC, Dashboard for operator role
    if (p.startsWith('op-')) return opAccess ? 'op-start' : 'op-start'
    // Controller schedule maps to dashboard (it's a sub-panel of dashboard)
    if (p === 'ctrl-schedule') return 'ctrl-dashboard'
    // Regional Controller reuses adm- panels — map back to the regional-controller nav ids
    if (p === 'rc-biz-dash')    return 'biz-dash'
    if (p === 'adm-audit')      return 'adm-audit'
    if (p === 'adm-reports')    return 'adm-reports'
    return p
  })()

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <nav className="sidebar">
        <div className="sb-logo">
          <div className="sb-logo-name">CashRoom</div>
          <div className="sb-logo-tag">Compliance System</div>
        </div>
        <div className="sb-user">
          <div className="sb-av">{initials}</div>
          <div>
            <div className="sb-uname">{auth.name}</div>
            <div className="sb-role">{ROLE_LABELS[auth.role]}</div>
            {auth.role === 'operator' && auth.locationIds[0] && (
              <div style={{ fontSize: 10, color: 'var(--g2)', marginTop: 3, lineHeight: 1.4 }}>
                📍 {getLocation(auth.locationIds[0])?.name ?? auth.locationIds[0]}
              </div>
            )}
            {opAccess && (
              <div style={{ fontSize: 9, fontWeight: 700, marginTop: 4, color: '#fbbf24', letterSpacing: '0.04em' }}>
                🏧 OPERATOR ACCESS
              </div>
            )}
            {ctrlAccess && (
              <div style={{ fontSize: 9, fontWeight: 700, marginTop: 2, color: '#a78bfa', letterSpacing: '0.04em' }}>
                🔍 CONTROLLER ACCESS
              </div>
            )}
          </div>
        </div>
        <div className="sb-nav">
          {items.map(item => (
            <div
              key={item.id}
              className={`nav-item${activeSidebarPanel === item.panel ? ' active' : ''}`}
              onClick={() => navigate(item.panel)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
        {/*<div className="sb-bottom">
          <button className="btn-logout" onClick={onLogout}>← Sign out</button>
        </div>*/}
      </nav>


      {/* ── Main area ── */}
      <div className="main-area" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        
        {/* ── Global Top Bar ── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          padding: '12px 32px', background: '#fff', borderBottom: '1px solid var(--ow2)', flexShrink: 0
        }}>
          <button
            onClick={() => setShowChangePw(true)}
            style={{
              fontWeight: 600, fontSize: 13, color: '#374151',
              background: '#f3f4f6', border: '1px solid #d1d5db',
              padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
              marginRight: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Change Password
          </button>
          <button
            onClick={onLogout}
            style={{
              fontWeight: 'bold', fontSize: 13, color: 'var(--red)',
              background: '#fff1f2', border: '1px solid #fca5a5',
              padding: '7px 18px', borderRadius: 8, cursor: 'pointer',
              display: 'flex', gap: 6, alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            Sign Out <span>→</span>
          </button>
          {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        </div>

        {/* ── Scrollable Content ── */}
        <div className="content" style={{ flex: 1, overflowY: 'auto' }}>
          {renderPanel()}
        </div>
        
      </div>






      {/* ── Main area ── 
      <div className="main-area">
        <div className="content">
          {renderPanel()}
        </div>
      </div>*/}
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth]       = useState<AuthState | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function syncLocations() {
    listLocations().then(apiLocs => {
      LOCATIONS.length = 0
      apiLocs.forEach(l => LOCATIONS.push({
        id: l.id, name: l.name, cost_center: l.cost_center, city: l.city,
        expectedCash: l.expected_cash,
        tolerancePct: l.effective_tolerance_pct,
        effectiveTolerancePct: l.effective_tolerance_pct,
        slaHours: l.sla_hours,
        active: l.active,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      }))
      saveStored('compass_locations', LOCATIONS)
    }).catch(() => { /* use whatever is in localStorage */ })
  }

  function syncUsers() {
    // Lowered page_size to 100 to satisfy strict backend validation limits
    listUsers({ page_size: 100 }).then(r => {
      USERS.length = 0
      r.items.forEach(u => USERS.push({
        id: u.id, name: u.name, email: u.email,
        role: u.role.toLowerCase() as (typeof USERS)[0]['role'],
        locationIds: u.location_ids ?? [],
        active: u.active,
      }))
      saveStored('compass_users', USERS)
    }).catch(() => { /* keep whatever is in localStorage */ })
  }

  function syncGrants(user: AuthUser) {
    const opGrants:   Record<string, { userId: string; userName: string; role: string; note: string; grantedAt: string }> = {}
    const ctrlGrants: typeof opGrants = {}
    if (user.access_grants.includes('operator'))   opGrants[user.id]   = { userId: user.id, userName: user.name, role: user.role, note: '', grantedAt: new Date().toISOString() }
    if (user.access_grants.includes('controller')) ctrlGrants[user.id] = { userId: user.id, userName: user.name, role: user.role, note: '', grantedAt: new Date().toISOString() }
    writeGrants(opGrants,   'operator')
    writeGrants(ctrlGrants, 'controller')
  }

  useEffect(() => {
    // 1. Check if we even have a token before pinging the backend
    const token = getToken()
    if (!token) {
      setTimeout(() => setLoading(false), 0)
      return
    }

    // 2. We have a token, now ask the backend who we are
    me()
      .then(user => {
        syncGrants(user)
        syncLocations()
        const appRole = apiRoleToRole(user.role)
        if (appRole === 'admin' || appRole === 'regional-controller') {
          syncUsers()
        }
        setAuth({
        userId: user.id,
        role: appRole,
        name: user.name,
        locationIds: user.location_ids,
      })

      const token = getToken()
      if (token) scheduleRefresh(token, timerRef, setAuth)
    })
    .catch(() => { 
      // If the backend rejects the stored token, wipe it out
      logout() 
    })
    .finally(() => setLoading(false))

  const timer = timerRef.current

  return () => {
    if (timer) clearTimeout(timer)
  }
}, [])

  function handleLogin(userId: string, role: Role, name: string, locationIds: string[]) {
    setAuth({ userId, role, name, locationIds })
    syncLocations()
    // Ensure ONLY admins attempt to sync the user database on login
    if (role === 'admin' || role === 'regional-controller') {
      syncUsers()
    }
    const token = getToken()
    if (token) scheduleRefresh(token, timerRef, setAuth)
  }

  function handleLogout() {
    if (timerRef.current) clearTimeout(timerRef.current)
    logout()
    setAuth(null)
  }

  if (loading) return (
    <div className="login-screen">
      <div className="login-box" style={{ textAlign: 'center', color: 'var(--ts)' }}>Loading…</div>
    </div>
  )
  if (!auth) return <Login onLogin={handleLogin} />
  return <AppShell auth={auth} onLogout={handleLogout} />
}
