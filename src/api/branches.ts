import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'
import type { Company, Paginated, Site } from '../types/api'

/** OpenAPI exposes companies/sites, not a separate `branches` resource. Both require JWT or session cookie. */
export const listBranches = () => apiClient.request<Paginated<Company>>('/api/v1/core/companies/')
export const listSites = () => apiClient.request<Paginated<Site>>('/api/v1/sites/sites/')

export function useBranches(enabled = false) {
  return useQuery({ queryKey: ['branches'], queryFn: listBranches, enabled })
}
