import { ArrowUpRight, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { KaydanLogo } from '../components/brand/KaydanLogo'
import { KAYDAN_CONTACT } from '../content/contact'

/**
 * The visit's last act: MyKaydan One, one account for every Kaydan service.
 * The spaces are named, not linked — the application is not open to the
 * public yet, and this is a landing, not a dashboard. Both calls to action
 * lead somewhere real: the MyKaydan One page and the official contact.
 */
const SPACES = [
  'Mes biens',
  'Suivi de chantier',
  'Paiements',
  'Documents',
  'Réclamations',
  'Assistance',
  'Home Services',
  'Gestion locative',
]

export function ExperienceOutro({ reveal, onRestart }: { reveal: number; onRestart: () => void }) {
  const hidden = reveal <= .001
  return <section
    className="experience-outro"
    aria-hidden={hidden}
    style={{ opacity: reveal, transform: `translateY(${(1 - reveal) * 40}px)`, pointerEvents: reveal > .5 ? 'auto' : 'none' }}
  >
    <div className="outro-panel">
      <div className="outro-lead">
        <p className="eyebrow">MYKAYDAN ONE</p>
        <h2>Un compte. Une expérience.<br />Tout l’univers Kaydan.</h2>
        <p className="outro-copy">Suivez vos biens, vos projets, vos paiements, vos documents et vos demandes. Accédez également aux services qui accompagnent votre logement, depuis un seul espace.</p>
        <div className="outro-actions">
          <Link to="/espace-client" className="primary-link" tabIndex={hidden ? -1 : 0}>Découvrir le projet MyKaydan One<ArrowUpRight size={17} /></Link>
          <Link to="/contact" className="ghost-link" tabIndex={hidden ? -1 : 0}>Nous contacter<ArrowUpRight size={16} /></Link>
        </div>
      </div>

      <div className="outro-index" aria-label="Les espaces MyKaydan One">
        <p className="outro-index-title">Mobile et web · un seul compte</p>
        <ul>
          {SPACES.map((space, index) => <li key={space}>
            <span className="outro-index-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="outro-index-label">{space}</span>
          </li>)}
        </ul>
      </div>
    </div>

    <div className="outro-footer">
      <KaydanLogo compact />
      <p>{KAYDAN_CONTACT.name} · {KAYDAN_CONTACT.address} · <a href={KAYDAN_CONTACT.phoneHref}>{KAYDAN_CONTACT.phone}</a> · <a href={`mailto:${KAYDAN_CONTACT.email}`}>{KAYDAN_CONTACT.email}</a></p>
      <button type="button" onClick={onRestart} className="outro-restart" tabIndex={hidden ? -1 : 0}>
        <ChevronUp size={15} aria-hidden="true" />Revoir la visite
      </button>
    </div>
  </section>
}
