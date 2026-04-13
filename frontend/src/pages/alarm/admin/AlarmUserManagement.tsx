import { useState, useEffect } from 'react'
import { api } from '../../../api/client'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

interface AlarmUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  created_at: string
}

interface UserListResponse {
  items: AlarmUser[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

const ALARM_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALARM_TESTER',   label: 'Alarm Tester' },
  { value: 'ALARM_APPROVER', label: 'Alarm Approver' },
  { value: 'ALARM_ADMIN',    label: 'Alarm Admin' },
]

const NAV_PILLS = [
  { label: 'Buildings',   panel: 'alarm-building-setup' },
  { label: 'Zones',       panel: 'alarm-zone-config' },
  { label: 'Rules',       panel: 'alarm-compliance-rules' },
  { label: 'Alarm Users', panel: 'alarm-user-mgmt' },
]

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    padding: '6px 16px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--g7)' : 'var(--ow2)'}`,
    background: active ? 'var(--g7)' : 'transparent',
    color: active ? '#fff' : 'var(--tm)',
  }
}

export default function AlarmUserManagement({ adminName: _adminName, onNavigate }: Props) {
  const [users, setUsers] = useState<AlarmUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState<AlarmUser | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>('ALARM_TESTER')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<UserListResponse>('/alarm/admin/users?page_size=200')
      setUsers(res.items)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setName(''); setEmail(''); setPassword(''); setRole('ALARM_TESTER')
    setShowCreate(false); setEditingUser(null)
  }

  function startEdit(u: AlarmUser) {
    setEditingUser(u)
    setName(u.name); setEmail(u.email); setRole(u.role); setPassword('')
    setShowCreate(true)
  }

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return }
    if (!editingUser && password.length < 6) { setError('Password must be at least 6 characters'); return }
    setSubmitting(true)
    setError('')
    try {
      if (editingUser) {
        const body: Record<string, unknown> = { name: name.trim(), email: email.trim(), role }
        if (password.length > 0) body.password = password
        await api.put(`/alarm/admin/users/${editingUser.id}`, body)
      } else {
        await api.post('/alarm/admin/users', { name: name.trim(), email: email.trim(), password, role })
      }
      resetForm()
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeactivate(u: AlarmUser) {
    if (!confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) return
    try {
      await api.delete(`/alarm/admin/users/${u.id}`)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user')
    }
  }

  return (
    <div className="fade-up" style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'DM Serif Display,serif', fontSize: 26, marginBottom: 6 }}>Alarm Users</h1>
      <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 16 }}>
        Manage users with access to the Alarm Testing System. Only alarm-specific roles can be created here.
      </p>

      {/* Nav pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {NAV_PILLS.map(p => (
          <span key={p.panel} style={pillStyle(p.panel === 'alarm-user-mgmt')} onClick={() => onNavigate(p.panel)}>
            {p.label}
          </span>
        ))}
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--ts)' }}>
          {loading ? 'Loading...' : `${users.length} alarm user${users.length === 1 ? '' : 's'}`}
        </div>
        <button
          onClick={() => { resetForm(); setShowCreate(true) }}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--g7)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          + Add User
        </button>
      </div>

      {/* User table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--ow)', textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--ts)' }}>Name</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--ts)' }}>Email</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--ts)' }}>Role</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--ts)' }}>Status</th>
              <th style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: 'var(--ts)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--ow2)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>{u.name}</td>
                <td style={{ padding: '12px 14px', color: 'var(--ts)' }}>{u.email}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ background: 'var(--g0)', color: 'var(--g7)', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    {u.role.replace('ALARM_', '')}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    color: u.active ? '#15803d' : '#991b1b',
                    background: u.active ? '#dcfce7' : '#fee2e2',
                    padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                  }}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', display: 'flex', gap: 8 }}>
                  <button onClick={() => startEdit(u)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--ow2)', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                    Edit
                  </button>
                  {u.active && (
                    <button onClick={() => handleDeactivate(u)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#991b1b', cursor: 'pointer', fontSize: 12 }}>
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--ts)' }}>
                No alarm users yet. Add one to get started.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px 28px', width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 18px', fontFamily: 'DM Serif Display,serif', fontSize: 20 }}>
              {editingUser ? 'Edit Alarm User' : 'Add Alarm User'}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', display: 'block', marginBottom: 4 }}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--ow2)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', display: 'block', marginBottom: 4 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--ow2)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', display: 'block', marginBottom: 4 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--ow2)', fontSize: 13, boxSizing: 'border-box', background: '#fff' }}>
                {ALARM_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', display: 'block', marginBottom: 4 }}>
                Password {editingUser && <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(leave blank to keep current)</span>}
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--ow2)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid var(--ow2)', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'var(--g7)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {submitting ? 'Saving...' : editingUser ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
