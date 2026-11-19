import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SiteHeader } from './SiteHeader'

export function PageShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="page-shell">
    <SiteHeader />
    <main className="capability-main">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Retour à l’expérience</Link>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </main>
  </div>
}
