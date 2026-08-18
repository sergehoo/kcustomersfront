import { ShieldAlert } from 'lucide-react'

export function ApiBoundary({ children, note }: { children: React.ReactNode; note: string }) {
  return <section className="api-boundary" role="status">
    <ShieldAlert size={22} aria-hidden="true" /><div><strong>Disponibilité API requise</strong><p>{note}</p>{children}</div>
  </section>
}
