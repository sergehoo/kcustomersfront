import { ROOM_PROGRESS, type RoomId } from './tour'

/**
 * Rooms of the visit, plus the ids older links still use (`/?scene=office`,
 * header and capability pages): `office` was the meeting table — now the
 * dining room — and `client` the client lounge — now the living room.
 */
type LegacySectionId = 'office' | 'client'
export type ExperienceSectionId = RoomId | LegacySectionId

const LEGACY: Record<LegacySectionId, RoomId> = { office: 'dining', client: 'living' }

/** Capability page reachable from a section, or `null` when the section is purely spatial. */
export type CapabilityId = 'appointment' | 'visitor' | 'verification' | 'complaint' | 'tracking' | 'contact' | 'client'

type SectionSeed = {
  id: RoomId
  /** Spatial name of the room. Shown in the progress badge and the spec panel. */
  label: string
  /** Editorial kicker. The section number is prepended automatically — never hardcode it. */
  kicker: string
  /** Says what is on screen; the KAYDAN service it hosts comes second. */
  title: string
  description: string
  route: string
  cta: string
  capability: CapabilityId | null
}

/**
 * Single source of truth for the visit. `number`, `ordinal`, `eyebrow` and the
 * `NN / TT` counter are all derived from the array order, and each room's
 * scroll anchor from the tour (tour.ts), so neither can drift.
 */
const SECTION_SEEDS: SectionSeed[] = [
  {
    id: 'exterior',
    label: 'EXTÉRIEUR',
    kicker: 'KAYDAN — DIGITAL CONCIERGE',
    title: 'KAYDAN\nCUSTOMER CARE',
    description: 'Votre relation avec KAYDAN, autrement. Une visite guidée de nos services, pièce par pièce.',
    route: '/rendez-vous',
    cta: 'Commencer la visite',
    capability: null,
  },
  {
    id: 'entrance',
    label: 'ENTRÉE',
    kicker: 'ENTRÉE & ARRIVÉE',
    title: 'UNE ARRIVÉE\nDANS L’AXE',
    description: 'Un escalier droit, un porche lumineux, une porte pivotante en chêne. Prenez rendez-vous, nous vous attendons.',
    route: '/rendez-vous',
    cta: 'Prendre rendez-vous',
    capability: 'appointment',
  },
  {
    id: 'visitor',
    label: 'HALL D’ACCUEIL',
    kicker: 'HALL D’ACCUEIL',
    title: 'VOTRE VISITE\nCOMMENCE ICI',
    description: 'Une console en chêne, une œuvre, une plante : l’accueil se fait simple. Badge visiteur et QR Code sont gérés par KAYDAN Shield.',
    route: '/visiteur',
    cta: 'Programmer une visite',
    capability: 'visitor',
  },
  {
    id: 'living',
    label: 'SALON',
    kicker: 'SALON',
    title: 'PRENDRE LE TEMPS\nDE VOUS ÉCOUTER',
    description: 'Canapé bouclé, fauteuils lounge et feu ouvert face aux baies. Votre espace client vous accompagne au quotidien.',
    route: '/espace-client',
    cta: 'Espace client',
    capability: 'client',
  },
  {
    id: 'dining',
    label: 'SALLE À MANGER',
    kicker: 'SALLE À MANGER',
    title: 'AUTOUR\nD’UNE TABLE',
    description: 'Une grande table sous une suspension linéaire, une œuvre sur la pierre. Chaque réclamation est instruite ainsi : ensemble.',
    route: '/reclamation',
    cta: 'Faire une réclamation',
    capability: 'complaint',
  },
  {
    id: 'kitchen',
    label: 'CUISINE',
    kicker: 'CUISINE',
    title: 'LE SOIN\nDU DÉTAIL',
    description: 'Un îlot noir et bois, des tabourets cuir, une robinetterie laiton. Vérifiez une visite en un instant.',
    route: '/visiteur/verification',
    cta: 'Vérifier une visite',
    capability: 'verification',
  },
  {
    id: 'circulation',
    label: 'ESCALIER',
    kicker: 'ESCALIER & CIRCULATION',
    title: 'D’UN ÉTAGE\nÀ L’AUTRE',
    description: 'Des marches en chêne suspendues, un garde-corps en verre. Suivez le cheminement de votre dossier, étape par étape.',
    route: '/suivi',
    cta: 'Suivre une demande',
    capability: 'tracking',
  },
  {
    id: 'suite',
    label: 'SUITE PARENTALE',
    kicker: 'SUITE PARENTALE',
    title: 'UN ESPACE INTIME\nPENSÉ POUR LE CONFORT',
    description: 'Lit à tête capitonnée, chevets laiton, fauteuil de lecture. Des services personnalisés, avec le même soin.',
    route: '/espace-client',
    cta: 'Espace client',
    capability: 'client',
  },
  {
    id: 'bathroom',
    label: 'SALLE DE BAIN',
    kicker: 'SALLE DE BAIN',
    title: 'MARBRE, LAITON\nET LUMIÈRE',
    description: 'Baignoire îlot, douche à l’italienne, double vasque. Le détail fait la différence, chez vous comme chez nous.',
    route: '/espace-client',
    cta: 'Espace client',
    capability: 'client',
  },
  {
    id: 'bedroom',
    label: 'CHAMBRE',
    kicker: 'CHAMBRE SECONDAIRE',
    title: 'SIMPLE\nET ÉLÉGANTE',
    description: 'Un lit, une œuvre, des voilages sur la baie. Chaque demande avance avec la même attention.',
    route: '/suivi',
    cta: 'Suivre une demande',
    capability: 'tracking',
  },
  {
    id: 'terrace',
    label: 'TERRASSE',
    kicker: 'TERRASSE',
    title: 'VIVRE\nDEHORS',
    description: 'Un salon en teck face à la piscine, la façade ouverte sur le séjour. La conversation continue dehors.',
    route: '/contact',
    cta: 'Nous contacter',
    capability: 'contact',
  },
  {
    id: 'pool',
    label: 'PISCINE',
    kicker: 'PISCINE',
    title: 'L’EAU,\nLA VILLA, LE CIEL',
    description: 'Le bassin, ses transats, la villa en arrière-plan. Nous restons à votre écoute.',
    route: '/contact',
    cta: 'Nous contacter',
    capability: 'contact',
  },
  {
    id: 'garden',
    label: 'JARDIN',
    kicker: 'JARDIN',
    title: 'UN PAYSAGE\nEN GRADINS',
    description: 'Gradins plantés d’agaves, palmiers, pelouse et éclairage discret. Prenez rendez-vous pour une visite réelle.',
    route: '/rendez-vous',
    cta: 'Prendre rendez-vous',
    capability: 'appointment',
  },
  {
    id: 'finale',
    label: 'VUE FINALE',
    kicker: 'KAYDAN',
    title: 'NOUS SOMMES À\nVOTRE ÉCOUTE',
    description: 'La villa, son jardin, sa piscine. La porte reste ouverte pour continuer la conversation.',
    route: '/contact',
    cta: 'Nous contacter',
    capability: 'contact',
  },
]

export type ExperienceSection = SectionSeed & {
  /** Scroll progress at which the camera arrives on this room's overview. */
  progress: number
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
  return {
    ...seed,
    progress: index === 0 ? 0 : ROOM_PROGRESS[seed.id],
    number,
    ordinal,
    eyebrow: index === 0 ? seed.kicker : `${ordinal} — ${seed.kicker}`,
  }
})

export const SECTION_COUNT = EXPERIENCE_SECTIONS.length
export const SECTION_TOTAL = String(SECTION_COUNT).padStart(2, '0')

/**
 * Progress at which the closing sequence starts taking over the frame: once
 * the final shot has landed and been held a while, never before.
 */
export const OUTRO_PROGRESS = ROOM_PROGRESS.finale + (1 - ROOM_PROGRESS.finale) * .5

/** A current room id for any id, including the legacy ones. */
export function resolveSectionId(id: string): RoomId | null {
  if (id in LEGACY) return LEGACY[id as LegacySectionId]
  return EXPERIENCE_SECTIONS.some((section) => section.id === id) ? (id as RoomId) : null
}

/** Scroll distance between a section's anchor and the next one (1 for the last). */
export function spanOf(id: ExperienceSectionId): number {
  const section = sectionById(id)
  const index = section.number - 1
  const next = EXPERIENCE_SECTIONS[index + 1]?.progress ?? 1
  return Math.max(.001, next - section.progress)
}

/**
 * Where `moveTo` should actually land: a little way into the room's overview
 * hold, so the copy is at full opacity while the camera is still on the shot.
 */
export function landingProgressOf(id: ExperienceSectionId): number {
  const section = sectionById(id)
  return section.number === 1 ? 0 : section.progress + .1 * spanOf(id)
}

export function sectionAt(progress: number): ExperienceSection {
  return EXPERIENCE_SECTIONS.reduce((current, section) => (section.progress <= progress ? section : current), EXPERIENCE_SECTIONS[0])
}

export function sectionById(id: ExperienceSectionId): ExperienceSection {
  const room = resolveSectionId(id)
  return EXPERIENCE_SECTIONS.find((section) => section.id === room) ?? EXPERIENCE_SECTIONS[0]
}

export function progressOf(id: ExperienceSectionId): number {
  return sectionById(id).progress
}
