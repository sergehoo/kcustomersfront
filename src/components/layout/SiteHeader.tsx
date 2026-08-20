import { CalendarDays, Menu, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useState, type MouseEvent } from 'react'
import { KaydanLogo } from '../brand/KaydanLogo'
import type { ExperienceSectionId } from '../../experience/sections'

/**
 * Two kinds of destination, kept explicitly apart:
 * - `scene` moves the camera inside the landing visit (and deep-links to it from a sub-page);
 * - `route` always opens a real page, on the landing as well as anywhere else.
 * Every entry used to carry a scene, so the whole header — CTA included — was
 * swallowed by `preventDefault()` and no page was ever reachable from `/`.
 */
type HeaderLink =
  | { label: string; type: 'scene'; scene: ExperienceSectionId }
  | { label: string; type: 'route'; route: string; scene?: ExperienceSectionId }

const LINKS: HeaderLink[] = [
  { label: 'Accueil', type: 'scene', scene: 'exterior' },
  { label: 'La visite', type: 'scene', scene: 'entrance' },
  { label: 'Visiteur', type: 'route', route: '/visiteur', scene: 'visitor' },
  { label: 'Réclamation', type: 'route', route: '/reclamation', scene: 'office' },
  { label: 'Suivi', type: 'route', route: '/suivi', scene: 'circulation' },
  { label: 'Espace client', type: 'route', route: '/espace-client', scene: 'client' },
  { label: 'Contact', type: 'route', route: '/contact', scene: 'terrace' },
]

export const SCENE_QUERY_KEY = 'scene'

export function SiteHeader({ onExperienceNavigate, activeScene }: {
  /** Provided only by the landing page — its presence is what makes scene links local. */
  onExperienceNavigate?: (id: ExperienceSectionId) => void
  activeScene?: ExperienceSectionId
}) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  const hrefFor = (link: HeaderLink) => {
    if (link.type === 'route') return link.route
    // On the landing the href is only a fallback for middle-click / no-JS; elsewhere it deep-links.
    return onExperienceNavigate ? '/' : `/?${SCENE_QUERY_KEY}=${link.scene}`
  }

  const onClick = (event: MouseEvent<HTMLAnchorElement>, link: HeaderLink) => {
    setOpen(false)
    if (link.type !== 'scene' || !onExperienceNavigate) return
    event.preventDefault()
    onExperienceNavigate(link.scene)
  }

  const isActive = (link: HeaderLink) => {
    if (link.type === 'route') return pathname === link.route
    return Boolean(activeScene) && link.scene === activeScene
  }

  return <header className="site-header">
    <Link to="/" className="brand" aria-label="KAYDAN Customer Care — accueil"><KaydanLogo /></Link>

    <nav className="desktop-nav" aria-label="Navigation principale">
      {LINKS.map((link) => <NavLink
        key={link.label}
        to={hrefFor(link)}
        onClick={(event) => onClick(event, link)}
        className={isActive(link) ? 'active' : ''}
        aria-current={isActive(link) ? (link.type === 'route' ? 'page' : 'step') : undefined}
      >{link.label}</NavLink>)}
    </nav>

    {/* Always a real navigation: booking is a page, never a camera move. */}
    <Link className="header-cta" to="/rendez-vous" onClick={() => setOpen(false)}>
      Prendre rendez-vous <CalendarDays size={16} strokeWidth={1.5} />
    </Link>

    <button className="menu-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={open}>
      {open ? <X /> : <Menu />}
    </button>

    {/* CSS transition rather than framer-motion: a 44 kB gzip dependency on the
        landing's critical path bought one dropdown fade. */}
    <nav className={`mobile-nav ${open ? 'mobile-nav--open' : ''}`} aria-label="Navigation mobile" hidden={!open}>
      {LINKS.map((link) => <NavLink
        key={link.label}
        to={hrefFor(link)}
        onClick={(event) => onClick(event, link)}
        className={isActive(link) ? 'active' : ''}
      >{link.label}</NavLink>)}
      <Link to="/rendez-vous" onClick={() => setOpen(false)}>Prendre rendez-vous</Link>
    </nav>
  </header>
}
