import { apiClient } from './client'

export const getCurrentUser = () => apiClient.request<unknown>('/api/v1/auth/me/')
export const refreshToken = (refresh: string) => apiClient.request<{ access: string }>('/api/v1/auth/token/refresh/', { method: 'POST', body: { refresh } })
