import { Volume2, VolumeX } from 'lucide-react'
import './sound-toggle.css'

/**
 * Sound on / muted. Always there, never in the way: the visit is complete
 * without sound, and nothing plays until the visitor has asked for it.
 */
export function SoundToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button
    type="button"
    className={`sound-toggle${on ? ' is-on' : ''}`}
    onClick={onToggle}
    aria-pressed={on}
    aria-label={on ? 'Couper le son de la visite' : 'Activer le son de la visite'}
    title={on ? 'Son activé' : 'Son coupé'}
  >
    {on ? <Volume2 size={15} strokeWidth={1.6} aria-hidden="true" /> : <VolumeX size={15} strokeWidth={1.6} aria-hidden="true" />}
    <span>{on ? 'Son' : 'Muet'}</span>
  </button>
}
