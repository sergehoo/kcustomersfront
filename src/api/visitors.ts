import { apiClient } from './client'
import type { Visitor, VisitRequest } from '../types/api'

export const createVisitor = (body: unknown) => apiClient.request<Visitor>('/api/v1/visitors/visitors/', { method: 'POST', body })
export const createWalkIn = (body: unknown) => apiClient.request<VisitRequest>('/api/v1/visitors/requests/walk-in/', { method: 'POST', body })
export const getVisitRequest = (id: number) => apiClient.request<VisitRequest>(`/api/v1/visitors/requests/${id}/`)
