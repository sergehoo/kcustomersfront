import { ROOM_PROGRESS, type RoomId } from './tour'

/**
 * Rooms of the visit, plus the ids older links still use (`/?scene=office`,
 * header and capability pages): `office` was the meeting table — now the
 * dining room — and `client` the client lounge — now the living room.
 */
type LegacySectionId = 'office' | 'client'
export type ExperienceSectionId = RoomId | LegacySectionId

const LEGACY: Record<LegacySectionId, RoomId> = { office: 'dining', client: 'living' }

/** A call to action that leads somewhere real — a page, or a published site. */
export type SectionAction = { label: string; route: string; external?: boolean }

type SectionSeed = {
  id: RoomId
  /** Spatial name of the room. Shown in the progress badge and the spec panel. */
  label: string
  /** Editorial kicker. The section number is prepended automatically — never hardcode it. */
  kicker: string
  /** Says what the camera shows; the Kaydan business it carries comes with it. */
  title: string
  /** Hero only: the strong line under the title. */
  subtitle?: string
  description: string
  /** Only where a real destination exists — never a link to nowhere. */
  action?: SectionAction
  /** Hero only: the second call to action. */
  secondary?: SectionAction
}

/**
 * The portal, once it is open to the public. Until then « Accéder à MyKaydan »
 * leads to the MyKaydan One page, which says honestly that it is coming.
 */
export const MYKAYDAN_PORTAL_URL: string | null = null
export const MYKAYDAN_ACCESS: SectionAction = MYKAYDAN_PORTAL_URL
  ? { label: 'Accéder à MyKaydan', route: MYKAYDAN_PORTAL_URL, external: true }
  : { label: 'Accéder à MyKaydan', route: '/espace-client' }

export const ARTEMIS_URL = 'https://artemisconstruction-ci.com/'

/**
 * The visit tells the Kaydan story in five acts over the rooms the camera
 * already walks — the text follows the shots, never the other way round:
 *   Découvrir (extérieur, entrée, hall) → Construire (escalier) →
 *   Habiter (salon, salle à manger, cuisine, suite, salle de bain, chambre —
 *   Kaydan Home Services) → Vivre (terrasse, piscine, jardin) →
 *   Connecter (MyKaydan One).
 * `number`, `ordinal`, `eyebrow` and the `NN / TT` counter are derived from
 * the array order, and each room's scroll anchor from the tour (tour.ts).
 */
const SECTION_SEEDS: SectionSeed[] = [
  {
    id: 'exterior',
    label: 'EXTÉRIEUR',
    kicker: 'KAYDAN GROUPE',
    title: 'Bienvenue sur\nMyKaydan',
    subtitle: 'Votre portail d’accès à l’univers Kaydan.',
    description: 'Découvrez autrement notre vision de l’immobilier, de la construction, de l’aménagement et des services qui accompagnent votre bien tout au long de son cycle de vie.',
    // Starts the visit (ExperienceCopy moves the camera); the href is the deep
    // link to the first room, for middle-click and no-JS.
    action: { label: 'Découvrir l’expérience', route: '/?scene=entrance' },
    secondary: MYKAYDAN_ACCESS,
  },
  {
    id: 'entrance',
    label: 'ENTRÉE',
    kicker: 'INGÉNIERIE ARCHITECTURALE',
    title: 'Découvrez notre\ningénierie architecturale',
    description: 'De la conception des volumes à l’expérience des espaces, Kaydan imagine des projets immobiliers pensés dans leurs moindres détails.',
    action: { label: 'Rencontrer un conseiller', route: '/rendez-vous' },
  },
  {
    id: 'visitor',
    label: 'HALL',
    kicker: 'KAYDAN REAL ESTATE',
    title: 'Imaginer des espaces\nqui créent de la valeur',
    description: 'De la conception à la valorisation du patrimoine immobilier, Kaydan accompagne chaque projet avec une vision globale.',
  },
  {
    id: 'living',
    label: 'SALON',
    kicker: 'QUALITÉ DES RÉALISATIONS',
    title: 'La qualité de\nnos réalisations',
    description: 'Des espaces conçus pour durer, valoriser votre patrimoine et offrir une expérience de vie à la hauteur de vos attentes.',
  },
  {
    id: 'dining',
    label: 'SALLE À MANGER',
    kicker: 'KAYDAN HOME SERVICES',
    title: 'Donnez vie\nà votre intérieur',
    description: 'Mobilier, décoration, équipements et installation : un intérieur pensé jusque dans les moindres détails.',
  },
  {
    id: 'kitchen',
    label: 'CUISINE',
    kicker: 'DÉTAILS & MATÉRIAUX',
    title: 'L’équipement\nintégré au projet',
    description: 'Îlot, rangements, robinetterie : des matériaux choisis et une fonctionnalité pensée pour le quotidien.',
  },
  {
    id: 'circulation',
    label: 'ESCALIER',
    kicker: 'ARTEMIS CONSTRUCTION',
    title: 'Notre savoir-faire\ndans la construction',
    description: 'Une exigence portée dans l’exécution, les matériaux, les finitions et le rendu de chaque détail.',
    action: { label: 'Découvrir Artemis', route: ARTEMIS_URL, external: true },
  },
  {
    id: 'suite',
    label: 'SUITE PARENTALE',
    kicker: 'CONFORT & QUALITÉ DE VIE',
    title: 'Le confort jusque\ndans les détails',
    description: 'Un espace intime pensé pour le repos : la lumière, les matières, le silence.',
  },
  {
    id: 'bathroom',
    label: 'SALLE DE BAIN',
    kicker: 'FINITIONS',
    title: 'Des finitions à la hauteur\nde l’architecture',
    description: 'Marbre, laiton, baignoire îlot : chaque finition prolonge le projet.',
  },
  {
    id: 'bedroom',
    label: 'CHAMBRE',
    kicker: 'KAYDAN HOME SERVICES',
    title: 'Un logement prêt\nà vivre',
    description: 'Kaydan ne livre pas seulement un bâtiment : votre logement peut être équipé et installé avant la remise des clés.',
  },
  {
    id: 'terrace',
    label: 'TERRASSE',
    kicker: 'ART DE VIVRE',
    title: 'Vivre pleinement\nchaque espace',
    description: 'Un salon extérieur face à l’eau, le séjour grand ouvert : la qualité de vie se prolonge dehors.',
  },
  {
    id: 'pool',
    label: 'PISCINE',
    kicker: 'VALORISATION DU BIEN',
    title: 'Un bien qui\nprend de la valeur',
    description: 'Après la remise des clés, vous pouvez confier votre bien à Kaydan et suivre sa gestion locative depuis MyKaydan.',
  },
  {
    id: 'garden',
    label: 'JARDIN',
    kicker: 'ART DE VIVRE',
    title: 'Un paysage pensé\navec l’architecture',
    description: 'Gradins plantés, palmiers, éclairage : l’extérieur participe à la valeur du projet.',
  },
  {
    id: 'finale',
    label: 'MYKAYDAN ONE',
    kicker: 'MYKAYDAN ONE',
    title: 'De la découverte\nà la gestion de votre bien',
    description: 'Découvrir, réserver, suivre le chantier, payer, équiper, recevoir ses clés, confier son bien : un seul parcours, un seul compte.',
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
