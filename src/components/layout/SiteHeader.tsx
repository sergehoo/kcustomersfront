import { CalendarDays, Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, NavLink } from 'react-router-dom'
import { useState, type MouseEvent } from 'react'
import type { ExperienceSectionId } from '../../experience/sections'

const links: { label: string; href: string; scene?: ExperienceSectionId }[] = [
  { label: 'Accueil', href: '/', scene: 'exterior' }, { label: 'Services', href: '/', scene: 'entrance' }, { label: 'Rendez-vous', href: '/rendez-vous', scene: 'entrance' }, { label: 'Visiteur', href: '/visiteur', scene: 'visitor' },
  { label: 'Réclamation', href: '/reclamation', scene: 'complaint' }, { label: 'Suivi', href: '/suivi', scene: 'tracking' }, { label: 'Contact', href: '/contact', scene: 'contact' },
]

export function SiteHeader({ onExperienceNavigate, activeScene }: { onExperienceNavigate?: (id: ExperienceSectionId) => void; activeScene?: ExperienceSectionId }) {
  const [open, setOpen] = useState(false)
  const navigate = (event: MouseEvent<HTMLAnchorElement>, scene?: ExperienceSectionId) => { if (scene && onExperienceNavigate) { event.preventDefault(); onExperienceNavigate(scene); setOpen(false) } }
  return <header className="site-header">
    <Link to="/" className="brand" aria-label="KAYDAN Customer Care — accueil"><span>KAYDAN</span><small>CUSTOMER CARE</small></Link>
    <nav className="desktop-nav" aria-label="Navigation principale">
      {links.map(({ label, href, scene }) => <NavLink key={label} to={href} onClick={(event) => navigate(event, scene)} className={({ isActive }) => activeScene ? scene === activeScene ? 'active' : '' : isActive ? 'active' : ''}>{label}</NavLink>)}
    </nav>
    <Link className="header-cta" to="/rendez-vous" onClick={(event) => navigate(event, 'entrance')}>Prendre rendez-vous <CalendarDays size={16} strokeWidth={1.5} /></Link>
    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open}>
      {open ? <X /> : <Menu />}
    </button>
    <AnimatePresence>{open && <motion.nav className="mobile-nav" aria-label="Navigation mobile" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      {links.map(({ label, href, scene }) => <NavLink key={label} to={href} onClick={(event) => navigate(event, scene)}>{label}</NavLink>)}
      <Link to="/rendez-vous" onClick={(event) => navigate(event, 'entrance')}>Prendre rendez-vous</Link>
    </motion.nav>}</AnimatePresence>
  </header>
}
