import { apiClient } from './client'

export const getVisitorBadgePdf = (visitRequestId: number) => apiClient.downloadBlob(`/api/v1/visitors/requests/${visitRequestId}/badge.pdf`)
export const getVisitorBadgeQrImage = (visitRequestId: number) => `${apiClient.baseUrl}/api/v1/visitors/requests/${visitRequestId}/badge-qr.png`
