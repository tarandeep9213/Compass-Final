import { api } from './client'
import type {
  ApiLocation,
  ApiUser,
  ApiAccessGrant,
  AdminConfig,
  LocationOverride,
  Paginated,
  CreateUserBody,
  UpdateUserBody,
  ImportRow,
  ImportResponse,
} from './types'

// ── Locations ─────────────────────────────────────────────────────────────────

export function listLocations(active?: boolean): Promise<Paginated<ApiLocation>> {
  const qs = active !== undefined ? `?active=${active}` : ''
  return api.get<Paginated<ApiLocation>>(`/admin/locations${qs}`)
}

export interface CreateLocationBody {
  id?: string
  cost_center?: string
  name: string
  city: string
  expected_cash: number
  tolerance_pct?: number
  sla_hours?: number
}

export function createLocation(body: CreateLocationBody): Promise<ApiLocation> {
  return api.post<ApiLocation>('/admin/locations', body)
}

export function updateLocation(id: string, body: Partial<CreateLocationBody>): Promise<ApiLocation> {
  return api.put<ApiLocation>(`/admin/locations/${id}`, body)
}

export function deactivateLocation(id: string): Promise<{ id: string; active: false }> {
  return api.delete<{ id: string; active: false }>(`/admin/locations/${id}`)
}

export function reactivateLocation(id: string): Promise<{ id: string; active: true }> {
  return api.post<{ id: string; active: true }>(`/admin/locations/${id}/reactivate`, {})
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface ListUsersParams {
  role?: string
  active?: boolean
  location_id?: string
  page?: number
  page_size?: number
}

export function listUsers(params: ListUsersParams = {}): Promise<Paginated<ApiUser>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<Paginated<ApiUser>>(`/admin/users${qs ? `?${qs}` : ''}`)
}

export function createUser(body: CreateUserBody): Promise<ApiUser> {
  return api.post<ApiUser>('/admin/users', body)
}

export function updateUser(id: string, body: UpdateUserBody): Promise<ApiUser> {
  return api.put<ApiUser>(`/admin/users/${id}`, body)
}

export function deactivateUser(id: string): Promise<{ id: string; active: false }> {
  return api.delete<{ id: string; active: false }>(`/admin/users/${id}`)
}

export function purgeNonAdminUsers(): Promise<{ deleted: number }> {
  return api.post<{ deleted: number }>('/admin/purge-users', {})
}

export function resetAll(): Promise<{ users_deleted: number; locations_deleted: number }> {
  return api.post<{ users_deleted: number; locations_deleted: number }>('/admin/reset-all', {})
}

export function reactivateUser(id: string): Promise<{ id: string; active: true }> {
  return api.post<{ id: string; active: true }>(`/admin/users/${id}/reactivate`, {})
}

// ── Config ────────────────────────────────────────────────────────────────────

export function getConfig(): Promise<AdminConfig> {
  return api.get<AdminConfig>('/admin/config')
}

export function updateConfig(body: Partial<AdminConfig['global']>): Promise<AdminConfig> {
  return api.put<AdminConfig>('/admin/config', body)
}

export function setLocationOverride(
  locationId: string,
  tolerance_pct: number,
): Promise<LocationOverride> {
  return api.put<LocationOverride>(`/admin/config/locations/${locationId}`, { tolerance_pct })
}

export function removeLocationOverride(locationId: string): Promise<void> {
  return api.delete<void>(`/admin/config/locations/${locationId}`)
}

// ── Access Grants ─────────────────────────────────────────────────────────────

export function listAccessGrants(): Promise<{ items: ApiAccessGrant[] }> {
  return api.get<{ items: ApiAccessGrant[] }>('/admin/access-grants')
}

export function grantAccess(
  user_id: string,
  access_type: 'operator' | 'controller',
  note: string,
): Promise<ApiAccessGrant> {
  return api.post<ApiAccessGrant>('/admin/access-grants', { user_id, access_type, note })
}

export function updateGrantNote(id: string, note: string): Promise<ApiAccessGrant> {
  return api.put<ApiAccessGrant>(`/admin/access-grants/${id}`, { note })
}

export function revokeAccess(id: string): Promise<void> {
  return api.delete<void>(`/admin/access-grants/${id}`)
}

// ── Roster Import ─────────────────────────────────────────────────────────────

export function importRoster(rows: ImportRow[]): Promise<ImportResponse> {
  return api.post<ImportResponse>('/admin/import', { rows })
}
