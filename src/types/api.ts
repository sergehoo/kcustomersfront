export type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] }

export type Company = { id: number; name: string; code: string; logo_url: string; is_active: boolean }
export type Site = { id: number; name: string; code: string; company_name: string; address_label: string; status?: string }
export type Employee = { id: number; full_name: string; email?: string; company_name: string; job_title: string }
export type VisitPurpose = { id: number; name?: string; label?: string; is_active?: boolean }
export type VisitorCategory = { id: number; name?: string; label?: string; color?: string; is_active?: boolean }
export type Visitor = { id: number; full_name: string; first_name: string; last_name: string; company?: string; email?: string; phone?: string }
export type VisitRequest = {
  id: number; visitor_name: string; visitor_company: string; site_name: string; host_name: string
  status: string; status_label: string; mode: string; mode_label: string; scheduled_at: string | null
  badge_pdf_url: string; badge_uid: string; allowed_transitions: string[]
}
