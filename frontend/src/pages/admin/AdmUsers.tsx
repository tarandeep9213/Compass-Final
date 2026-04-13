import React, { useState, useEffect } from 'react'
import { USERS, LOCATIONS } from '../../mock/data'
import type { User } from '../../mock/data'
import { readGrants, writeGrants } from '../../utils/operatorAccess'
import type { AccessGrant, AccessType } from '../../utils/operatorAccess'
import { listUsers, listLocations, createUser, updateUser, deactivateUser, reactivateUser, listAccessGrants, grantAccess, updateGrantNote, revokeAccess, purgeNonAdminUsers, getConfig, updateConfig } from '../../api/admin'
import { me as getMe } from '../../api/auth'
import { ApiError } from '../../api/client'
import type { ApiUser, ApiRole } from '../../api/types'

function mapApiUser(u: ApiUser): User {
  const roleMap: Partial<Record<ApiRole, User['role']>> = {
    OPERATOR: 'operator', CONTROLLER: 'controller', DGM: 'dgm',
    ADMIN: 'admin', REGIONAL_CONTROLLER: 'regional-controller',
  }
  return { id: u.id, name: u.name, email: u.email, role: roleMap[u.role] ?? 'operator', locationIds: u.location_ids, active: u.active, createdAt: u.created_at }
}

function roleToApiRole(role: string): ApiRole {
  return role.toUpperCase().replace('-', '_') as ApiRole
}

interface Props { adminName: string }

type Role = User['role']
const ROLES: Role[] = ['operator','controller','dgm','admin','regional-controller']
const ROLE_LABELS: Record<Role,string> = { operator:'Operator', controller:'Controller', dgm:'DGM', admin:'Admin', 'regional-controller':'Regional Controller' }

const PAGE_SIZE = 10

function pageNums(cur: number, total: number): (number|'gap')[] {
  if (total<=7) return Array.from({length:total},(_,i)=>i)
  if (cur<=3)         return [0,1,2,3,'gap',total-1]
  if (cur>=total-4)   return [0,'gap',total-4,total-3,total-2,total-1]
  return [0,'gap',cur-1,cur,cur+1,'gap',total-1]
}
const ROLE_COLORS: Record<Role,string> = {
  operator:'#e0f2fe', controller:'#f0fdf4', dgm:'#fdf4ff', admin:'#fff1f2', 'regional-controller':'#fef9c3',
}

const EMPTY_FORM = { name:'', email:'', role:'operator' as Role, locationIds:[] as string[], password:'' }

function generatePassword(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0] ? (parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()) : 'User'
  const lastInitial = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : ''
  let pwd = `${first}${lastInitial}@${new Date().getFullYear()}`
  while (pwd.length < 8) pwd += '1'
  return pwd
}

const SYS_INIT = { dowLookbackWeeks: 4 as 4 | 6, reminderTime: '08:00', retentionYears: 7 }

export default function AdmUsers({ adminName }: Props) {
  const [users,        setUsers]        = useState<User[]>([])
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState('')
  const [apiLocations, setApiLocations] = useState<{id: string; name: string}[]>(LOCATIONS.map(l => ({ id: l.id, name: l.name })))
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ── Access delegation (operator + controller) ─────────────────────────
  const [opGrants,   setOpGrants]   = useState<Record<string, AccessGrant>>(() => readGrants('operator'))
  const [ctrlGrants, setCtrlGrants] = useState<Record<string, AccessGrant>>(() => readGrants('controller'))

  useEffect(() => {
    getMe().then(u => setCurrentUserId(u.id)).catch(() => {})
    // FETCH EXISTING SETTINGS
    getConfig().then(cfg => {
      setSys({
        dowLookbackWeeks: cfg.global.dow_lookback_weeks as 4 | 6,
        reminderTime: cfg.global.daily_reminder_time,
        retentionYears: cfg.global.data_retention_years,
      })
    }).catch(() => { /* keep defaults if fails */ })
    listUsers({ page_size: 200 })
      .then(r => { setUsers(r.items.map(mapApiUser)); setFetchError('') })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          setFetchError('Your session is not valid. Please sign out and log in again with your real credentials.')
          setUsers([])
        } else {
          setFetchError('Could not reach the server. Make sure the backend is running on port 8000.')
          setUsers([...USERS])
        }
      })
      .finally(() => setLoading(false))
    listLocations()
      .then(r => setApiLocations(r.items.map(l => ({ id: l.id, name: l.name }))))
      .catch(() => { /* keep mock */ })
    listAccessGrants().then(res => {
      const op:   Record<string, AccessGrant> = {}
      const ctrl: Record<string, AccessGrant> = {}
      res.items.forEach(g => {
        const grant: AccessGrant = { userId: g.user_id, userName: g.user_name, role: g.user_role, note: g.note, grantedAt: g.granted_at, grantId: g.id }
        if (g.access_type === 'operator')   op[g.user_id]   = grant
        if (g.access_type === 'controller') ctrl[g.user_id] = grant
      })
      if (res.items.length > 0) { setOpGrants(op); setCtrlGrants(ctrl); writeGrants(op, 'operator'); writeGrants(ctrl, 'controller') }
    }).catch(() => { /* use localStorage */ })

    getConfig().then(cfg => {
      setSys({
        dowLookbackWeeks: cfg.global.dow_lookback_weeks as 4 | 6,
        reminderTime: cfg.global.daily_reminder_time,
        retentionYears: cfg.global.data_retention_years
      })
    }).catch(() => {
      const localSys = localStorage.getItem('mockSystemConfig')
      if (localSys) setSys(JSON.parse(localSys))
    })
  }, [])
  const [mode,    setMode]    = useState<'add'|{id:string}|null>(null)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [errors,  setErrors]  = useState<Record<string,string>>({})
  const [confirm, setConfirm] = useState<string|null>(null)
  const [saved,   setSaved]   = useState('')
  const [page,    setPage]    = useState(0)
  const [sys,     setSys]     = useState(SYS_INIT)
  const [sysSaved, setSysSaved] = useState(false)
  const [filterRole, setFilterRole] = useState<Role | ''>('')
  const [filterLoc,  setFilterLoc]  = useState('')
  const [filterName, setFilterName] = useState('')
  const [purgeConfirm, setPurgeConfirm] = useState(false)
  const [purging,      setPurging]      = useState(false)

  // grantEdit: { userId, type } — which user+type is the inline form open for
  const [grantEdit,  setGrantEdit]  = useState<{ userId: string; type: AccessType } | null>(null)
  const [grantNote,  setGrantNote]  = useState('')
  const [grantFlash, setGrantFlash] = useState('')

  const eligibleUsers = users.filter(u => u.role === 'dgm' || u.role === 'regional-controller')

  function getGrants(type: AccessType) { return type === 'operator' ? opGrants : ctrlGrants }
  function setGrants(type: AccessType, g: Record<string, AccessGrant>) {
    if (type === 'operator') setOpGrants(g); else setCtrlGrants(g)
  }

  async function saveGrant(u: User) {
    if (!grantEdit) return
    const { type } = grantEdit
    const existingGrant = getGrants(type)[u.id]
    let grantId = existingGrant?.grantId
    try {
      if (grantId) {
        await updateGrantNote(grantId, grantNote.trim())
      } else {
        const res = await grantAccess(u.id, type, grantNote.trim())
        grantId = res.id
      }
    } catch { /* proceed with local update */ }
    const updated = {
      ...getGrants(type),
      [u.id]: { userId: u.id, userName: u.name, role: u.role, note: grantNote.trim(), grantedAt: new Date().toISOString(), grantId },
    }
    setGrants(type, updated); writeGrants(updated, type)
    setGrantEdit(null); setGrantNote('')
    const label = type === 'operator' ? 'Operator' : 'Controller'
    setGrantFlash(`${label} access granted to ${u.name}.`)
    setTimeout(() => setGrantFlash(''), 3000)
  }

  async function revokeGrant(u: User, type: AccessType) {
    const existing = getGrants(type)[u.id]
    if (existing?.grantId) {
      try { await revokeAccess(existing.grantId) } catch { /* proceed locally */ }
    }
    const updated = { ...getGrants(type) }
    delete updated[u.id]
    setGrants(type, updated); writeGrants(updated, type)
    const label = type === 'operator' ? 'Operator' : 'Controller'
    setGrantFlash(`${label} access revoked for ${u.name}.`)
    setTimeout(() => setGrantFlash(''), 3000)
  }

  function openGrantEdit(u: User, type: AccessType) {
    setGrantEdit({ userId: u.id, type })
    setGrantNote(getGrants(type)[u.id]?.note ?? '')
  }

  const nameQuery = filterName.trim().toLowerCase()
  const filteredUsers = users.filter(u =>
    (filterRole === '' || u.role === filterRole) &&
    (filterLoc  === '' || u.locationIds.includes(filterLoc)) &&
    (nameQuery  === '' || u.name.toLowerCase().includes(nameQuery) || u.email.toLowerCase().includes(nameQuery))
  )
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pageRows   = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = filteredUsers.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, filteredUsers.length)

  function flash(msg: string) { setSaved(msg); setTimeout(()=>setSaved(''), 3000) }

  function openAdd() { setMode('add'); setForm(EMPTY_FORM); setErrors({}); setConfirm(null); setPage(0) }
  function openEdit(u: User) {
    // Calculate page index against filteredUsers so it stays on the correct page when filters are active
    const idx = filteredUsers.findIndex(x => x.id === u.id)
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE))
    setMode({id:u.id}); setErrors({}); setConfirm(null)
    setForm({ name:u.name, email:u.email, role:u.role as Role, locationIds:[...u.locationIds], password:'' })
  }
  function cancel() { setMode(null); setErrors({}) }

  const LOC_REQUIRED_ROLES: Role[] = ['operator', 'controller', 'dgm']

  function validate() {
    const e: Record<string,string> = {}
    if (!form.name.trim()) e.name = 'Name required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required'
    if (mode === 'add' && !e.email && users.some(u => u.email.toLowerCase() === form.email.trim().toLowerCase())) e.email = 'An account with this email already exists'
    if (mode === 'add' && !e.name && !e.email) {
      const nameLower = form.name.trim().toLowerCase()
      const locSet = new Set(form.locationIds)
      const isDupe = users.some(u =>
        u.name.trim().toLowerCase() === nameLower &&
        u.role === form.role &&
        u.locationIds.length === locSet.size &&
        u.locationIds.every(id => locSet.has(id))
      )
      if (isDupe) e.name = 'A user with the same name, role, and location(s) already exists'
    }
    if (mode === 'add' && form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (LOC_REQUIRED_ROLES.includes(form.role) && form.locationIds.length === 0) e.locationIds = 'At least one location required for this role'
    return e
  }

  function toggleLoc(id: string) {
    setForm(p => ({...p, locationIds: p.locationIds.includes(id) ? p.locationIds.filter(x=>x!==id) : [...p.locationIds, id]}))
  }

  async function handleSave() {
    const e = validate(); if (Object.keys(e).length) { setErrors(e); return }
    if (mode==='add') {
      const nu: User = { id:`U${Date.now()}`, name:form.name.trim(), email:form.email.trim(), role:form.role, locationIds:form.locationIds, active:true }
      try {
        const created = await createUser({ name:nu.name, email:nu.email, password:form.password, role:roleToApiRole(nu.role), location_ids:nu.locationIds })
        nu.id = created.id
      } catch (err) {
        if (err instanceof ApiError) {
          const msg = err.message || 'Failed to create user'
          if (msg.toLowerCase().includes('email')) setErrors(e => ({...e, email: msg}))
          else setErrors(e => ({...e, name: msg}))
          return
        }
        // demo mode — continue with local state
      }
      setUsers(p => {
        const next = [...p, nu]
        setPage(Math.floor((next.length - 1) / PAGE_SIZE))
        return next
      })
      flash(`User "${nu.name}" added.`)
    } else if (mode && typeof mode==='object') {
      try {
        await updateUser(mode.id, { name:form.name.trim(), email:form.email.trim(), role:roleToApiRole(form.role), location_ids:form.locationIds })
      } catch (err) {
        if (err instanceof ApiError) {
          const msg = err.message || 'Failed to update user'
          if (msg.toLowerCase().includes('email')) setErrors(e => ({...e, email: msg}))
          else setErrors(e => ({...e, name: msg}))
          return
        }
      }
      setUsers(p=>p.map(u=>u.id===mode.id?{...u,name:form.name.trim(),email:form.email.trim(),role:form.role,locationIds:form.locationIds}:u))
      flash('Changes saved.')
    }
    setMode(null)
  }

  async function toggleActive(id: string) {
    const user = users.find(u => u.id === id)
    try {
      if (user?.active) await deactivateUser(id)
      else              await reactivateUser(id)
    } catch { /* demo mode */ }
    setUsers(p=>p.map(u=>u.id===id?{...u,active:!u.active}:u))
    setConfirm(null)
    flash('User status updated.')
  }

  async function handlePurge() {
    setPurging(true)
    try {
      const res = await purgeNonAdminUsers()
      // Clear local state — keep only admin users
      const adminsOnly = users.filter(u => u.role === 'admin')
      setUsers(adminsOnly)
      USERS.splice(0, USERS.length, ...adminsOnly)
      setPurgeConfirm(false)
      flash(`Removed ${res.deleted} user${res.deleted !== 1 ? 's' : ''}. Admin account preserved.`)
    } catch {
      flash('Error removing users.')
    } finally {
      setPurging(false)
    }
  }

  async function handleSysSave() {
    try {
      await updateConfig({
        dow_lookback_weeks: sys.dowLookbackWeeks,
        daily_reminder_time: sys.reminderTime,
        data_retention_years: sys.retentionYears
      })
      setSysSaved(true)
      setTimeout(() => setSysSaved(false), 3000)
    } catch {
      // Fallback to local storage if DB is not connected
      localStorage.setItem('mockSystemConfig', JSON.stringify(sys))
      setSysSaved(true)
      setTimeout(() => setSysSaved(false), 3000)
    }
  }

  const locNeeded = !['admin'].includes(form.role)

  return (
    <div className="fade-up">
      <div className="ph" style={{marginBottom:18}}>
        <div>
          <h2>Users</h2>
          <p style={{color:'var(--ts)',fontSize:13}}>Manage user accounts and role assignments · {adminName}</p>
        </div>
        <div className="ph-right">
          {saved && <span style={{fontSize:12,color:'var(--g7)',fontWeight:600}}>{saved}</span>}
          <button className="btn btn-ghost" style={{fontSize:12,color:'var(--red)',border:'1px solid var(--red)'}} onClick={()=>setPurgeConfirm(true)}>
            Remove All Users
          </button>
          <button className="btn btn-primary" onClick={openAdd} disabled={mode==='add'}>+ Add User</button>
        </div>
      </div>

      {/* ── Purge confirmation banner ── */}
      {purgeConfirm && (
        <div style={{background:'#fff5f5',border:'1.5px solid var(--red)',borderRadius:10,padding:'14px 20px',marginBottom:16,display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:600,color:'var(--red)',flex:1}}>
            ⚠ This will permanently delete all users except the Admin account. This cannot be undone.
          </span>
          <button className="btn btn-ghost" style={{fontSize:12,padding:'5px 16px',color:'var(--red)',border:'1px solid var(--red)',fontWeight:700}} onClick={handlePurge} disabled={purging}>
            {purging ? 'Removing…' : 'Yes, Remove All'}
          </button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:'5px 14px'}} onClick={()=>setPurgeConfirm(false)} disabled={purging}>
            Cancel
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Users</span>
          <span className="card-sub">{users.length} total · {users.filter(u=>u.active).length} active</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="f-inp"
              placeholder="Search name or email…"
              value={filterName}
              onChange={e => { setFilterName(e.target.value); setPage(0) }}
              style={{ fontSize: 12, width: 190 }}
            />
            <select
              className="f-inp"
              value={filterRole}
              onChange={e => { setFilterRole(e.target.value as Role | ''); setPage(0) }}
              style={{ fontSize: 12, width: 160 }}
            >
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <select
              className="f-inp"
              value={filterLoc}
              onChange={e => { setFilterLoc(e.target.value); setPage(0) }}
              style={{ fontSize: 12, width: 180 }}
            >
              <option value="">All locations</option>
              {apiLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            {(filterRole || filterLoc || filterName) && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => { setFilterRole(''); setFilterLoc(''); setFilterName(''); setPage(0) }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="card-body" style={{padding:0}}>
          <table className="dt">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th style={{textAlign:'center'}}>Role</th>
                <th>Assigned Locations</th><th style={{textAlign:'center'}}>Status</th><th style={{textAlign:'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{textAlign:'center',padding:'24px',color:'var(--ts)',fontSize:13}}>Loading users…</td></tr>
              )}
              {!loading && fetchError && (
                <tr><td colSpan={6} style={{textAlign:'center',padding:'16px',color:'var(--red)',fontSize:13,fontWeight:600}}>⚠ {fetchError}</td></tr>
              )}
              {/* Add row */}
              {mode==='add' && (
                <tr style={{background:'var(--g0)'}}>
                  <td colSpan={6}>
                    <AddEditForm form={form} setForm={setForm} errors={errors} setErrors={setErrors}
                      locNeeded={locNeeded} toggleLoc={toggleLoc} locations={apiLocations} onSave={handleSave} onCancel={cancel} isAdd={true} />
                  </td>
                </tr>
              )}

              {pageRows.map(u => {
                const isEditing = mode && typeof mode==='object' && mode.id===u.id
                return (
                  <React.Fragment key={u.id}>
                    <tr style={{opacity:u.active?1:0.55}}>
                      <td style={{fontWeight:600,fontSize:13}}>{u.name}</td>
                      <td style={{fontSize:12,color:'var(--ts)'}}>{u.email}</td>
                      <td style={{textAlign:'center'}}>
                        <span style={{fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:6,background:ROLE_COLORS[u.role as Role]??'#f5f5f5',color:'var(--td)'}}>
                          {ROLE_LABELS[u.role as Role]??u.role}
                        </span>
                      </td>
                      <td style={{fontSize:12,color:'var(--ts)',maxWidth:220}}>
                        {u.locationIds.length===0?<span style={{color:'#bbb'}}>—</span>
                          :u.locationIds.length===apiLocations.length?<span style={{color:'var(--g7)',fontWeight:600}}>All locations</span>
                          :u.locationIds.map(id=>apiLocations.find(l=>l.id===id)?.name??id).join(', ')}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {u.active
                          ? <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,background:'var(--g0)',color:'var(--g7)',border:'1px solid var(--g2)'}}>ACTIVE</span>
                          : <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,background:'var(--ow)',color:'#999',border:'1px solid var(--ow2)'}}>INACTIVE</span>}
                      </td>
                      <td style={{textAlign:'right'}}>
                        <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>openEdit(u)}>Edit</button>
                        {u.id !== currentUserId && (
                          <button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px',marginLeft:4,color:u.active?'var(--red)':'var(--g7)'}} onClick={()=>setConfirm(u.id)}>
                            {u.active?'Deactivate':'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {isEditing && (
                      <tr key={u.id+'-edit'} style={{background:'var(--g0)'}}>
                        <td colSpan={6}>
                          <AddEditForm form={form} setForm={setForm} errors={errors} setErrors={setErrors}
                            locNeeded={locNeeded} toggleLoc={toggleLoc} locations={apiLocations} onSave={handleSave} onCancel={cancel} isAdd={false} />
                        </td>
                      </tr>
                    )}

                    {confirm===u.id && (
                      <tr key={u.id+'-confirm'} style={{background:u.active?'#fff5f5':'#f0fdf4'}}>
                        <td colSpan={6}>
                          <div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 4px'}}>
                            <span style={{fontSize:13,fontWeight:600,color:u.active?'var(--red)':'var(--g7)'}}>
                              {u.active?`⚠ Deactivate "${u.name}"? Account is preserved.`:`Reactivate "${u.name}"?`}
                            </span>
                            <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 14px',color:u.active?'var(--red)':'var(--g7)',border:`1px solid ${u.active?'var(--red)':'var(--g7)'}`}} onClick={()=>toggleActive(u.id)}>
                              {u.active?'Yes, Deactivate':'Yes, Reactivate'}
                            </button>
                            <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>setConfirm(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'1px solid var(--ow2)',background:'var(--ow)'}}>
              <span style={{fontSize:12,color:'var(--ts)'}}>Showing {fromRow}–{toRow} of {filteredUsers.length} users{(filterRole || filterLoc) ? ` (filtered from ${users.length})` : ''}</span>
              <div style={{display:'flex',gap:4,alignItems:'center'}}>
                <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                {pageNums(page,totalPages).map((n,i)=>n==='gap'
                  ? <span key={`g${i}`} style={{fontSize:12,color:'var(--ts)',padding:'0 4px'}}>…</span>
                  : <button key={n} onClick={()=>setPage(n as number)} style={{width:30,height:30,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:page===n?700:400,border:`1px solid ${page===n?'var(--g4)':'var(--ow2)'}`,background:page===n?'var(--g7)':'#fff',color:page===n?'#fff':'var(--td)'}}>{(n as number)+1}</button>
                )}
                <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={page>=totalPages-1} onClick={()=>setPage(p=>p+1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── System Settings ── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">System Settings</span>
          <span className="card-sub">Global operational parameters</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)', display: 'block', marginBottom: 6 }}>DOW Lookback Window</label>
              <div style={{ display: 'flex', gap: 0, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--ow2)' }}>
                {([4, 6] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => setSys(p => ({ ...p, dowLookbackWeeks: w }))}
                    style={{
                      padding: '6px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      border: 'none', outline: 'none',
                      background: sys.dowLookbackWeeks === w ? 'var(--g7)' : '#fff',
                      color: sys.dowLookbackWeeks === w ? '#fff' : 'var(--td)',
                      fontWeight: sys.dowLookbackWeeks === w ? 700 : 400,
                    }}
                  >
                    {w} weeks
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)', display: 'block', marginBottom: 4 }}>Daily Reminder Time</label>
              <input
                className="f-inp"
                type="time"
                value={sys.reminderTime}
                onChange={e => setSys(p => ({ ...p, reminderTime: e.target.value }))}
                style={{ fontSize: 13, width: 120 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)', display: 'block', marginBottom: 4 }}>Data Retention</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="f-inp"
                  type="number"
                  min={1} max={7}
                  value={sys.retentionYears}
                  onChange={e => setSys(p => ({ ...p, retentionYears: Number(e.target.value) }))}
                  style={{ width: 70, fontSize: 13 }}
                />
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>years</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '7px 18px' }}
                onClick={handleSysSave}
              >
                Save Settings
              </button>
              {sysSaved && <span style={{ fontSize: 12, color: 'var(--g7)', fontWeight: 600 }}>Saved</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Access Delegation ── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <span className="card-title">Screen Access Delegation</span>
            <span className="card-sub" style={{ marginLeft: 8 }}>
              Grant DGM or Regional Controller users temporary access to Operator or Controller screens
            </span>
          </div>
          {grantFlash && <span style={{ fontSize: 12, color: 'var(--g7)', fontWeight: 600 }}>{grantFlash}</span>}
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {eligibleUsers.length === 0 ? (
            <div style={{ padding: '24px 20px', fontSize: 13, color: 'var(--ts)' }}>No DGM or Regional Controller users found.</div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>User</th>
                  <th style={{ textAlign: 'center' }}>Role</th>
                  <th style={{ textAlign: 'center' }}>🏧 Operator Access</th>
                  <th style={{ textAlign: 'center' }}>🔍 Controller Access</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eligibleUsers.map(u => {
                  const opGrant   = opGrants[u.id]
                  const ctrlGrant = ctrlGrants[u.id]
                  const editingOp   = grantEdit?.userId === u.id && grantEdit?.type === 'operator'
                  const editingCtrl = grantEdit?.userId === u.id && grantEdit?.type === 'controller'

                  return (
                    <React.Fragment key={u.id}>
                      <tr>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ts)' }}>{u.email}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                            background: u.role === 'dgm' ? '#fdf4ff' : '#f0f9ff',
                            color:      u.role === 'dgm' ? '#7e22ce' : '#0369a1',
                          }}>
                            {u.role === 'dgm' ? 'DGM' : 'Regional Controller'}
                          </span>
                        </td>
                        <GrantCell grant={opGrant}   type="operator"   user={u} onOpenGrantEdit={openGrantEdit} onRevokeGrant={revokeGrant} />
                        <GrantCell grant={ctrlGrant} type="controller" user={u} onOpenGrantEdit={openGrantEdit} onRevokeGrant={revokeGrant} />
                        <td />
                      </tr>

                      {/* Inline form for operator */}
                      {editingOp && (
                        <tr key={u.id + '-op-edit'} style={{ background: '#eff6ff' }}>
                          <td colSpan={5}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', padding: '10px 4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>🏧 Operator Access — {u.name}</span>
                              <div style={{ flex: '1 1 260px' }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)', display: 'block', marginBottom: 4 }}>
                                  Reason / Note <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                                </label>
                                <input className="f-inp" value={grantNote} onChange={e => setGrantNote(e.target.value)}
                                  placeholder="e.g. Covering absent operator at T5-01" style={{ width: '100%', fontSize: 13 }} />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 18px' }} onClick={() => saveGrant(u)}>
                                  {opGrant ? 'Update' : 'Confirm Grant'}
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setGrantEdit(null); setGrantNote('') }}>Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Inline form for controller */}
                      {editingCtrl && (
                        <tr key={u.id + '-ctrl-edit'} style={{ background: '#fdf4ff' }}>
                          <td colSpan={5}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', padding: '10px 4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>🔍 Controller Access — {u.name}</span>
                              <div style={{ flex: '1 1 260px' }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)', display: 'block', marginBottom: 4 }}>
                                  Reason / Note <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                                </label>
                                <input className="f-inp" value={grantNote} onChange={e => setGrantNote(e.target.value)}
                                  placeholder="e.g. Reviewing controller logs for audit" style={{ width: '100%', fontSize: 13 }} />
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 18px' }} onClick={() => saveGrant(u)}>
                                  {ctrlGrant ? 'Update' : 'Confirm Grant'}
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setGrantEdit(null); setGrantNote('') }}>Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Grant cell for access delegation table ────────────────────────────────
function GrantCell({ grant, type, user, onOpenGrantEdit, onRevokeGrant }: {
  grant: AccessGrant | undefined
  type: AccessType
  user: User
  onOpenGrantEdit: (u: User, t: AccessType) => void
  onRevokeGrant: (u: User, t: AccessType) => void
}) {
  return (
    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {grant
          ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#f0fdf4', color: 'var(--g7)', border: '1px solid var(--g2)' }}>GRANTED</span>
          : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'var(--ow)', color: '#bbb', border: '1px solid var(--ow2)' }}>NONE</span>}
        {grant?.note && <span style={{ fontSize: 10, color: 'var(--ts)', maxWidth: 160, textAlign: 'center' }}>{grant.note}</span>}
        {grant?.grantedAt && <span style={{ fontSize: 10, color: 'var(--ts)' }}>{new Date(grant.grantedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          {grant ? (
            <>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 8px' }} onClick={() => onOpenGrantEdit(user, type)}>Edit</button>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '3px 8px', color: 'var(--red)' }} onClick={() => onRevokeGrant(user, type)}>Revoke</button>
            </>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => onOpenGrantEdit(user, type)}>Grant</button>
          )}
        </div>
      </div>
    </td>
  )
}

// ── Reusable add/edit form ─────────────────────────────────────────────────
type UserForm = { name: string; email: string; role: Role; locationIds: string[]; password: string }
type FormErrors = Record<string, string>

function AddEditForm({ form, setForm, errors, setErrors, locNeeded, toggleLoc, locations, onSave, onCancel, isAdd }:
  { form: UserForm; setForm: React.Dispatch<React.SetStateAction<UserForm>>; errors: FormErrors; setErrors: React.Dispatch<React.SetStateAction<FormErrors>>; locNeeded: boolean; toggleLoc:(id:string)=>void; locations: {id:string;name:string}[]; onSave:()=>void; onCancel:()=>void; isAdd: boolean }) {

  function handleNameChange(val: string) {
    setForm(p => ({ ...p, name: val, ...(isAdd ? { password: generatePassword(val) } : {}) }))
    setErrors(p => ({ ...p, name: '' }))
  }

  return (
    <div style={{display:'flex',gap:14,flexWrap:'wrap',padding:'12px 4px',alignItems:'flex-start'}}>
      <div style={{flex:'1 1 160px'}}>
        <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Name *</label>
        <input className="f-inp" value={form.name} onChange={e => handleNameChange(e.target.value)} style={{width:'100%',fontSize:13}}/>
        {errors.name&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.name}</div>}
      </div>
      <div style={{flex:'1 1 200px'}}>
        <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Email *</label>
        <input className="f-inp" value={form.email} type="email" onChange={e=>{setForm(p=>({...p,email:e.target.value}));setErrors(p=>({...p,email:''}))}} style={{width:'100%',fontSize:13}}/>
        {errors.email&&<div style={{fontSize:11,color:'var(--red)'}}>{errors.email}</div>}
      </div>
      <div style={{flex:'0 0 140px'}}>
        <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Role *</label>
        <select className="f-inp" value={form.role} onChange={e=>{
          const newRole = e.target.value as Role
          setForm(p => ({
            ...p,
            role: newRole,
            // Operator allows only one location — trim if switching to operator
            locationIds: newRole === 'operator' && p.locationIds.length > 1 ? [p.locationIds[0]] : p.locationIds,
          }))
        }} style={{width:'100%',fontSize:13}}>
          {ROLES.map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      {isAdd && (
        <div style={{flex:'1 1 200px'}}>
          <label style={{fontSize:11,fontWeight:600,color:'var(--td)',display:'block',marginBottom:4}}>Temporary Password *</label>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input
              className="f-inp"
              value={form.password}
              onChange={e=>{setForm(p=>({...p,password:e.target.value}));setErrors(p=>({...p,password:''}))}}
              style={{flex:1,fontSize:13,fontFamily:'monospace'}}
            />
            <button
              type="button"
              className="btn btn-ghost"
              style={{fontSize:12,padding:'5px 10px',flexShrink:0}}
              title="Regenerate from name"
              onClick={()=>setForm(p=>({...p,password:generatePassword(p.name)}))}
            >↺</button>
          </div>
          {errors.password
            ? <div style={{fontSize:11,color:'var(--red)'}}>{errors.password}</div>
            : <div style={{fontSize:11,color:'var(--ts)',marginTop:3}}>✉ Will be emailed to the user on save</div>
          }
        </div>
      )}
      {locNeeded && (
        <div style={{flex:'1 1 220px'}}>
          <label style={{fontSize:11,fontWeight:600,color:errors.locationIds?'var(--red)':'var(--td)',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
            <span>
              Location{form.role !== 'operator' ? 's' : ''} {['operator','controller','dgm'].includes(form.role) ? '*' : ''}
              {form.role === 'operator' && <span style={{fontSize:10,fontWeight:400,color:'var(--ts)',marginLeft:6}}>(single only)</span>}
            </span>
            {form.role === 'regional-controller' && locations.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ts)', cursor: 'pointer', fontWeight: 400 }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--g7)' }}
                  checked={form.locationIds.length === locations.length}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setForm(p => ({ ...p, locationIds: isChecked ? locations.map(l => l.id) : [] }));
                    setErrors(p => ({ ...p, locationIds: '' }));
                  }}
                />
                All Locations
              </label>
            )}
          </label>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {locations.map(l=>(
              <label key={l.id} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,cursor:'pointer',padding:'4px 8px',borderRadius:6,border:`1px solid ${form.locationIds.includes(l.id)?'var(--g3)':errors.locationIds?'var(--red)':'var(--ow2)'}`,background:form.locationIds.includes(l.id)?'var(--g0)':'#fff',color:form.locationIds.includes(l.id)?'var(--g7)':'var(--ts)'}}>
                {form.role === 'operator'
                  ? <input type="radio" name="loc-radio" checked={form.locationIds.includes(l.id)}
                      onChange={()=>{setForm(p=>({...p,locationIds:[l.id]}));setErrors(p=>({...p,locationIds:''}))}}
                      style={{accentColor:'var(--g7)'}}/>
                  : <input type="checkbox" checked={form.locationIds.includes(l.id)}
                      onChange={()=>{toggleLoc(l.id);setErrors(p=>({...p,locationIds:''}))}}
                      style={{accentColor:'var(--g7)'}}/>
                }
                {l.name}
              </label>
            ))}
          </div>
          {errors.locationIds && <div style={{fontSize:11,color:'var(--red)',marginTop:4}}>{errors.locationIds}</div>}
        </div>
      )}
      <div style={{display:'flex',gap:8,alignSelf:'flex-end',paddingBottom:2}}>
        <button className="btn btn-primary" style={{fontSize:12,padding:'7px 18px'}} onClick={onSave}>Save</button>
        <button className="btn btn-ghost" style={{fontSize:12}} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
