import { api } from './client'
import type { ApiLocation } from './types'

export function listLocations(): Promise<ApiLocation[]> {
  return api.get<ApiLocation[]>('/locations')
}
