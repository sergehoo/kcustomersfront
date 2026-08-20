import { ArrowUpRight, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { KaydanLogo } from '../components/brand/KaydanLogo'
import { EXPERIENCE_SECTIONS } from './sections'

/** Capability shortcuts, minus the hero which has no page of its own. */
const DESTINATIONS = EXPERIENCE_SECTIONS.filter((section) => section.capability !== null)

export function ExperienceOutro({ reveal, onRestart }: { reveal: number; onRestart: () => void }) {
  const hidden = reveal <= .001
  return <section
    className="experience-outro"
    aria-hidden={hidden}
    style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 40}px)`, pointerEvents: reveal > .5 ? 'auto' : 'none' }}
  >
    <div className="outro-panel">
      <div className="outro-lead">
        <p className="eyebrow">FIN DE LA VISITE</p>
        <h2>Votre projet<br />commence ici.</h2>
        <p className="outro-copy">Vous avez parcouru la maison KAYDAN. Choisissez la porte par laquelle vous souhaitez continuer&nbsp;: nous prenons le relais.</p>
        <div className="outro-actions">
          <Link to="/rendez-vous" className="primary-link">Prendre rendez-vous<ArrowUpRight size={17} /></Link>
          <Link to="/contact" className="ghost-link">Nous contacter<ArrowUpRight size={16} /></Link>
        </div>
      </div>

      <nav className="outro-index" aria-label="Toutes les destinations KAYDAN">
        <p className="outro-index-title">Les services</p>
        <ul>
          {DESTINATIONS.map((section) => <li key={section.id}>
            <Link to={section.route}>
              <span className="outro-index-number">{section.ordinal}</span>
              <span className="outro-index-label">{section.cta}</span>
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </li>)}
        </ul>
      </nav>
    </div>

    <div className="outro-footer">
      <KaydanLogo compact />
      <p>Les coordonnées directes de votre agence sont publiées sur la page contact.</p>
      <button type="button" onClick={onRestart} className="outro-restart">
        <ChevronUp size={15} aria-hidden="true" />Revoir la visite
      </button>
    </div>
  </section>
}
