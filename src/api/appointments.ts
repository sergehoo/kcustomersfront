import { apiClient } from './client'
import type { Employee, Paginated, VisitPurpose, VisitRequest } from '../types/api'

export const listHosts = () => apiClient.request<Paginated<Employee>>('/api/v1/employees/employees/')
export const listPurposes = () => apiClient.request<Paginated<VisitPurpose>>('/api/v1/visitors/purposes/')
export const createVisitRequest = (body: unknown) => apiClient.request<VisitRequest>('/api/v1/visitors/requests/', { method: 'POST', body })
