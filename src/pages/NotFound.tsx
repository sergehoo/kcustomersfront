import { Link } from 'react-router-dom'
import { PageShell } from '../components/layout/PageShell'

export function NotFoundPage() { return <PageShell eyebrow="KAYDAN CUSTOMER CARE" title="Cette pièce n’existe pas."><p className="page-copy">Retrouvez le chemin vers l’expérience KAYDAN.</p><Link className="primary-link" to="/">Revenir à l’accueil</Link></PageShell> }
