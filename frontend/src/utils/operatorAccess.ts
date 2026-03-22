export type AccessType = 'operator' | 'controller'

export interface AccessGrant {
  userId:    string
  userName:  string
  role:      string
  note:      string
  grantedAt: string   // ISO timestamp
  grantId?:  string   // API grant ID (for update/revoke)
}

// Keep legacy alias so existing imports still compile
export type OperatorGrant = AccessGrant

function storageKey(type: AccessType) {
  return `compass_${type}_grants`
}

export function readGrants(type: AccessType = 'operator'): Record<string, AccessGrant> {
  try { return JSON.parse(localStorage.getItem(storageKey(type)) ?? '{}') } catch { return {} }
}

export function writeGrants(grants: Record<string, AccessGrant>, type: AccessType = 'operator'): void {
  localStorage.setItem(storageKey(type), JSON.stringify(grants))
}

export function hasAccess(userId: string, type: AccessType): boolean {
  return userId in readGrants(type)
}

// Legacy alias kept for App.tsx import
export function hasOperatorAccess(userId: string): boolean {
  return hasAccess(userId, 'operator')
}
