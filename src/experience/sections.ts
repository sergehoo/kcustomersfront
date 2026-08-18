export type ExperienceSectionId = 'exterior' | 'entrance' | 'visitor' | 'office' | 'circulation' | 'client' | 'terrace'

/** Capability page reachable from a section, or `null` when the section is purely spatial. */
export type CapabilityId = 'appointment' | 'visitor' | 'verification' | 'complaint' | 'tracking' | 'contact' | 'client'

type SectionSeed = {
  id: ExperienceSectionId
  /** Spatial name of the room. Shown in the progress badge and the spec panel. */
  label: string
  /** Editorial kicker. The section number is prepended automatically — never hardcode it. */
  kicker: string
  title: string
  description: string
  /** Scroll progress at which the camera reaches this room. Camera keyframes anchor to it. */
  progress: number
  route: string
  cta: string
  capability: CapabilityId | null
}

/**
 * Single source of truth for the visit. `number`, `ordinal`, `eyebrow` and the
 * `NN / TT` counter are all derived from the array order, so the numbering
 * cannot drift between the eyebrow, the badge and the progress rail.
 */
const SECTION_SEEDS: SectionSeed[] = [
  {
    id: 'exterior',
    label: 'EXTÉRIEUR',
    kicker: 'KAYDAN — DIGITAL CONCIERGE',
    title: 'KAYDAN\nCUSTOMER CARE',
    description: 'Votre relation avec KAYDAN, autrement. Une visite guidée de nos services, pièce par pièce.',
    progress: 0,
    route: '/rendez-vous',
    cta: 'Commencer la visite',
    capability: null,
  },
  {
    id: 'entrance',
    label: 'ENTRÉE',
    kicker: 'ENTRÉE & ARRIVÉE',
    title: 'PRÉPARER VOTRE\nPROCHAINE RENCONTRE',
    description: 'Une arrivée pensée pour être simple, claire et sereine.',
    progress: .14,
    route: '/rendez-vous',
    cta: 'Prendre rendez-vous',
    capability: 'appointment',
  },
  {
    id: 'visitor',
    label: 'HALL D’ACCUEIL',
    kicker: 'HALL D’ACCUEIL',
    title: 'VOTRE VISITE\nCOMMENCE ICI',
    description: 'Badge visiteur, QR Code et contrôle d’accès sont gérés par KAYDAN Shield.',
    progress: .30,
    route: '/visiteur',
    cta: 'Programmer une visite',
    capability: 'visitor',
  },
  {
    id: 'office',
    label: 'ESPACE DE TRAVAIL',
    kicker: 'ESPACE DE TRAVAIL',
    title: 'UNE ÉCOUTE QUI\nVOUS ACCOMPAGNE',
    description: 'Chaque demande est instruite par une équipe, autour d’une table.',
    progress: .44,
    route: '/reclamation',
    cta: 'Faire une réclamation',
    capability: 'complaint',
  },
  {
    id: 'circulation',
    label: 'CIRCULATION',
    kicker: 'ESCALIER & CIRCULATION',
    title: 'GARDEZ UN ŒIL SUR\nVOS DEMANDES',
    description: 'Suivez le cheminement de votre dossier, d’un étage à l’autre.',
    progress: .57,
    route: '/suivi',
    cta: 'Suivre une demande',
    capability: 'tracking',
  },
  {
    id: 'client',
    label: 'SALON CLIENT',
    kicker: 'SALON CLIENT',
    title: 'VOS SERVICES KAYDAN,\nRÉUNIS',
    description: 'Une table, une conversation, un accompagnement continu.',
    progress: .70,
    route: '/espace-client',
    cta: 'Espace client',
    capability: 'client',
  },
  {
    id: 'terrace',
    label: 'TERRASSE',
    kicker: 'TERRASSE & PISCINE',
    title: 'NOUS SOMMES À\nVOTRE ÉCOUTE',
    description: 'La porte reste ouverte pour continuer la conversation.',
    progress: .845,
    route: '/contact',
    cta: 'Nous contacter',
    capability: 'contact',
  },
]

export type ExperienceSection = SectionSeed & {
  /** 1-based position in the visit. */
  number: number
  /** Zero-padded `number`, used by every piece of chrome. */
  ordinal: string
  /** `NN — KICKER`, except for the hero which carries the brand line alone. */
  eyebrow: string
}

export const EXPERIENCE_SECTIONS: ExperienceSection[] = SECTION_SEEDS.map((seed, index) => {
  const number = index + 1
  const ordinal = String(number).padStart(2, '0')
  return { ...seed, number, ordinal, eyebrow: index === 0 ? seed.kicker : `${ordinal} — ${seed.kicker}` }
})

export const SECTION_COUNT = EXPERIENCE_SECTIONS.length
export const SECTION_TOTAL = String(SECTION_COUNT).padStart(2, '0')

/** Progress at which the closing sequence starts taking over the frame. */
export const OUTRO_PROGRESS = .93

/** Scroll distance between a section's anchor and the next one (1 for the last). */
export function spanOf(id: ExperienceSectionId): number {
  const index = EXPERIENCE_SECTIONS.findIndex((section) => section.id === id)
  const next = EXPERIENCE_SECTIONS[index + 1]?.progress ?? 1
  return Math.max(.001, next - EXPERIENCE_SECTIONS[index].progress)
}

/**
 * Where `moveTo` should actually land. Exactly on the anchor the editorial copy
 * is still at the very start of its reveal, so a nav jump would arrive on an
 * empty frame; landing a small way inside the room puts the copy at full
 * opacity while the camera has barely left the keyframe.
 */
export function landingProgressOf(id: ExperienceSectionId): number {
  const section = sectionById(id)
  return section.number === 1 ? 0 : section.progress + .12 * spanOf(id)
}

export function sectionAt(progress: number): ExperienceSection {
  return EXPERIENCE_SECTIONS.reduce((current, section) => (section.progress <= progress ? section : current), EXPERIENCE_SECTIONS[0])
}

export function sectionById(id: ExperienceSectionId): ExperienceSection {
  return EXPERIENCE_SECTIONS.find((section) => section.id === id) ?? EXPERIENCE_SECTIONS[0]
}

export function progressOf(id: ExperienceSectionId): number {
  return sectionById(id).progress
}
