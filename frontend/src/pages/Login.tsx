import { useState } from 'react'
import { USERS } from '../mock/data'
import { login as apiLogin, forgotPassword, verifyOtp, resetPassword } from '../api/auth'
import { ApiError } from '../api/client'
import type { ApiRole } from '../api/types'

// Frontend role type — lowercase kebab-case to match existing nav/routing
export type Role = 'operator' | 'controller' | 'dgm' | 'admin' | 'regional-controller'

// Map API uppercase role to frontend lowercase role
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

interface LoginProps {
  onLogin: (userId: string, role: Role, name: string, locationIds: string[]) => void
}

const DEMO_PASSWORD = 'demo1234'

type View = 'login' | 'forgot' | 'otp' | 'newpw'

export default function Login({ onLogin }: LoginProps) {
  // ── Login state ──────────────────────────────────────────────────────────
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showHints, setShowHints] = useState(false)

  // ── Forgot password state ─────────────────────────────────────────────────
  const [view, setView]         = useState<View>('login')
  const [fpEmail, setFpEmail]   = useState('')
  const [otp, setOtp]           = useState('')
  const [newPw, setNewPw]       = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [fpError, setFpError]   = useState('')
  const [fpLoading, setFpLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // ── Login submit ──────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!password)     { setError('Please enter your password.'); return }
    setLoading(true)
    setError('')

    try {
      // Try real API first
      const res = await apiLogin(email.trim(), password)
      const role = apiRoleToRole(res.user.role)
      onLogin(res.user.id, role, res.user.name, res.user.location_ids)
    } catch (err) {
      // If the API responded (4xx/5xx), show the real error — do NOT fall back to mock
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Incorrect email or password.' : err.message || 'Login failed.')
        setLoading(false)
        return
      }
      // API unreachable — fall back to mock data for demo/development
      const user = USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
      if (!user) { setError('No account found for this email address.'); setLoading(false); return }
      if (password !== DEMO_PASSWORD) { setError('Incorrect password.'); setLoading(false); return }
      onLogin(user.id, user.role as Role, user.name, user.locationIds)
    } finally {
      setLoading(false)
    }
  }

  // ── Forgot password: step 1 — send OTP ───────────────────────────────────
  async function handleForgotSubmit() {
    if (!fpEmail.trim()) { setFpError('Please enter your email address.'); return }
    setFpLoading(true)
    setFpError('')
    try {
      await forgotPassword(fpEmail.trim())
      setView('otp')
    } catch {
      setFpError('Password reset is not available in demo mode. Please contact your administrator.')
    } finally {
      setFpLoading(false)
    }
  }

  // ── Forgot password: step 2 — verify OTP ─────────────────────────────────
  async function handleOtpNext() {
    if (otp.trim().length !== 6 || !/^\d{6}$/.test(otp.trim())) {
      setFpError('Please enter the 6-digit code from your email.')
      return
    }
    setFpLoading(true)
    setFpError('')
    try {
      await verifyOtp(fpEmail.trim(), otp.trim())
      setView('newpw')
    } catch {
      setFpError('Invalid or expired reset code. Please check your email and try again.')
    } finally {
      setFpLoading(false)
    }
  }

  // ── Forgot password: step 3 — set new password ───────────────────────────
  async function handleResetSubmit() {
    if (newPw.length < 8)       { setFpError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw)    { setFpError('Passwords do not match.'); return }
    setFpLoading(true)
    setFpError('')
    try {
      await resetPassword(fpEmail.trim(), otp.trim(), newPw)
      setSuccessMsg('Password reset successfully. You can now sign in.')
      setView('login')
      setFpEmail(''); setOtp(''); setNewPw(''); setConfirmPw('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setFpError(msg.includes('Invalid') ? 'Invalid or expired reset code. Please request a new one.' : 'Something went wrong. Please try again.')
    } finally {
      setFpLoading(false)
    }
  }

  function backToLogin() {
    setView('login'); setFpError(''); setFpEmail(''); setOtp(''); setNewPw(''); setConfirmPw('')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="login-screen">
      <div className="login-box">
        <div className="login-logo">CashRoom</div>
        <div className="login-sub">Compliance System · Compass Group</div>

        {/* ── Success banner (after reset) ── */}
        {successMsg && (
          <div style={{ margin: '12px 0', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803d' }}>
            ✓ {successMsg}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            VIEW: login
        ══════════════════════════════════════════════════ */}
        {view === 'login' && (
          <>
            <div className="login-field">
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@compassgroup.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setSuccessMsg('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
            </div>

            <div className="login-field">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{ width: '100%', paddingRight: 38 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ts)', padding: 0, fontSize: 16, lineHeight: 1,
                  }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="btn-login-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>

            {/* Demo accounts collapsible hint */}
            <div style={{ marginTop: 14, borderTop: '1px solid var(--ow2)', paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setShowHints(v => !v)}
                style={{
                  background: 'none', border: 'none', color: 'var(--ts)', fontSize: 12,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto',
                }}
              >
                <span style={{ fontSize: 10 }}>{showHints ? '▲' : '▼'}</span>
                Demo accounts
              </button>

              {showHints && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    { email: 'admin@compass.com', role: 'Admin' },
                    { email: 'operator@compass.com', role: 'Operator' },
                    { email: 'controller@compass.com', role: 'Controller' },
                    { email: 'dgm@compass.com', role: 'DGM' },
                    { email: 'rc@compass.com', role: 'Regional Controller' },
                  ].map(h => (
                    <button
                      key={h.email}
                      type="button"
                      onClick={() => { 
                        setEmail(h.email); 
                        setPassword(DEMO_PASSWORD); 
                        setError(''); 
                        setShowHints(false); 
                        setSuccessMsg(''); 
                      }}
                      style={{
                        background: 'var(--ow)', border: '1px solid var(--ow2)', borderRadius: 7,
                        padding: '7px 12px', cursor: 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
                        color: 'var(--td)', fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ color: 'var(--ts)' }}>{h.email}</span>
                      <span style={{
                        background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g1)',
                        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      }}>{h.role}</span>
                    </button>
                  ))}
                  <p style={{ fontSize: 11, color: 'var(--ts)', textAlign: 'center', margin: '6px 0 0' }}>
                    All accounts use password: <strong>demo1234</strong>
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════
            VIEW: forgot — enter email
        ══════════════════════════════════════════════════ */}
        {view === 'forgot' && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--td)', marginBottom: 4 }}>Reset your password</div>
              <div style={{ fontSize: 13, color: 'var(--ts)' }}>Enter your account email and we'll send you a 6-digit reset code.</div>
            </div>

            <div className="login-field">
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@compassgroup.com"
                value={fpEmail}
                onChange={e => { setFpEmail(e.target.value); setFpError('') }}
                onKeyDown={e => e.key === 'Enter' && handleForgotSubmit()}
                autoFocus
              />
            </div>

            {fpError && <div className="login-error">{fpError}</div>}

            <button className="btn-login-submit" onClick={handleForgotSubmit} disabled={fpLoading}>
              {fpLoading ? 'Sending…' : 'Send Reset Code →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={backToLogin} style={{ background: 'none', border: 'none', color: 'var(--ts)', fontSize: 12, cursor: 'pointer' }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════
            VIEW: otp — enter 6-digit code
        ══════════════════════════════════════════════════ */}
        {view === 'otp' && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--td)', marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.5 }}>
                We sent a 6-digit code to <strong>{fpEmail}</strong>. Enter it below. The code expires in 15 minutes.
              </div>
            </div>

            <div className="login-field">
              <label>Reset code</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setFpError('') }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault(); // This stops the 401 Unauthorized login trigger
                    e.stopPropagation(); 
                    handleOtpNext();    // This triggers the 400 Bad Request if the code is wrong
                  }
                }}
                autoFocus
                style={{ letterSpacing: '0.2em', fontSize: 20, textAlign: 'center' }}
              />
            </div>

            {fpError && <div className="login-error">{fpError}</div>}

            <button className="btn-login-submit" onClick={handleOtpNext} disabled={fpLoading}>
              {fpLoading ? 'Verifying…' : 'Continue →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                onClick={async () => { 
                  setFpError(''); 
                  setFpLoading(true);
                  try {
                    await handleForgotSubmit(); 
                    setSuccessMsg('A new code has been sent.');
                  } catch {
                    setFpError('Failed to resend code. Please try again.');
                  } finally {
                    setFpLoading(false);
                  }
                }}
                disabled={fpLoading}
                style={{ background: 'none', border: 'none', color: 'var(--g7)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {fpLoading ? 'Sending...' : 'Resend code'}
              </button>
              <button onClick={backToLogin} style={{ background: 'none', border: 'none', color: 'var(--ts)', fontSize: 12, cursor: 'pointer' }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════
            VIEW: newpw — enter new password
        ══════════════════════════════════════════════════ */}
        {view === 'newpw' && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--td)', marginBottom: 4 }}>Set new password</div>
              <div style={{ fontSize: 13, color: 'var(--ts)' }}>Choose a new password for your account. Minimum 8 characters.</div>
            </div>

            <div className="login-field">
              <label>New password</label>
              <input
                type="password"
                placeholder="At least 8 characters"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setFpError('') }}
                onKeyDown={e => e.key === 'Enter' && handleResetSubmit()}
                autoFocus
              />
            </div>

            <div className="login-field">
              <label>Confirm new password</label>
              <input
                type="password"
                placeholder="Repeat your new password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setFpError('') }}
                onKeyDown={e => e.key === 'Enter' && handleResetSubmit()}
              />
            </div>

            {fpError && <div className="login-error">{fpError}</div>}

            <button className="btn-login-submit" onClick={handleResetSubmit} disabled={fpLoading}>
              {fpLoading ? 'Resetting…' : 'Reset Password →'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={backToLogin} style={{ background: 'none', border: 'none', color: 'var(--ts)', fontSize: 12, cursor: 'pointer' }}>
                ← Back to sign in
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
