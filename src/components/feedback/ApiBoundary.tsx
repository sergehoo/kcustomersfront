import { Clock3 } from 'lucide-react'

export function ApiBoundary({ children, note }: { children: React.ReactNode; note: string }) {
  return <section className="api-boundary" role="status">
    <Clock3 size={22} aria-hidden="true" /><div><strong>Bientôt dans MyKaydan One</strong><p>{note}</p>{children}</div>
  </section>
}
