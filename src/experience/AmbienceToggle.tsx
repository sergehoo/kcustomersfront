import { Moon, Sun } from 'lucide-react'
import type { AmbienceMode } from './ambience'
import './ambience-toggle.css'

/**
 * Day / night switch. The visit opens in the mode of the visitor's own clock;
 * this lets them see the villa the other way round. Only intensities change
 * underneath, so a switch is instant and never recompiles the scene.
 */
export function AmbienceToggle({ mode, automatic, onToggle }: { mode: AmbienceMode; automatic: boolean; onToggle: () => void }) {
  const night = mode === 'night'
  return <button
    type="button"
    className="ambience-toggle"
    onClick={onToggle}
    aria-pressed={night}
    aria-label={night ? 'Passer la visite en mode jour' : 'Passer la visite en mode nuit'}
    title={automatic ? 'Mode réglé sur votre heure locale' : 'Mode choisi manuellement'}
  >
    <span className={`ambience-toggle-option ${night ? '' : 'is-active'}`}><Sun size={14} strokeWidth={1.6} aria-hidden="true" />Jour</span>
    <span className={`ambience-toggle-option ${night ? 'is-active' : ''}`}><Moon size={14} strokeWidth={1.6} aria-hidden="true" />Nuit</span>
    {automatic && <span className="ambience-toggle-auto" aria-hidden="true">Heure locale</span>}
  </button>
}
