import { api, setToken } from './client'
import type { AuthUser, LoginResponse } from './types'

const REFRESH_KEY = 'ccs_refresh_token'

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', { email, password })
  setToken(res.access_token)
  localStorage.setItem(REFRESH_KEY, res.refresh_token)
  return res
}

export async function me(): Promise<AuthUser> {
  return api.get<AuthUser>('/auth/me')
}

export async function refresh(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) throw new Error('No refresh token')
  const res = await api.post<{ access_token: string; token_type: string; expires_in: number }>(
    '/auth/refresh',
    { refresh_token: refreshToken },
  )
  setToken(res.access_token)
  return res.access_token
}

export function logout(): void {
  setToken(null)
  localStorage.removeItem(REFRESH_KEY)
}

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email })
}

export async function verifyOtp(email: string, otp: string): Promise<void> {
  await api.post('/auth/verify-otp', { email, otp })
}

export async function resetPassword(email: string, otp: string, new_password: string): Promise<void> {
  await api.post('/auth/reset-password', { email, otp, new_password })
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await api.post('/auth/change-password', { current_password, new_password })
}
