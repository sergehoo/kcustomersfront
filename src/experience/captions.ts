/**
 * One short line on a few focus shots, keyed `room/shot` (tour.ts). The rooms'
 * copy (sections.ts) tells the act; these name what the camera is looking at —
 * the furniture becomes Kaydan Home Services, the stair Artemis Construction —
 * and stay silent on most shots so the house can speak for itself.
 */
export type ShotCaption = {
  eyebrow?: string
  text?: string
  /** A short sequence instead of a sentence (the end-of-project journey). */
  steps?: string[]
}

export const SHOT_CAPTIONS: Record<string, ShotCaption> = {
  'exterior/facade': { eyebrow: 'KAYDAN REAL ESTATE', text: 'Des volumes dessinés pour la lumière, la vue et l’usage.' },
  'entrance/door': { text: 'Bienvenue dans l’univers Kaydan.' },
  'living/overview': { text: 'Des espaces pensés pour vivre.' },
  'living/sofa': { eyebrow: 'KAYDAN HOME SERVICES', text: 'Un mobilier choisi pour conjuguer confort, élégance et fonctionnalité.' },
  'living/details': { eyebrow: 'KAYDAN HOME SERVICES', text: 'Luminaires, rideaux, objets : la décoration pensée avec l’architecture.' },
  'dining/table': { eyebrow: 'KAYDAN HOME SERVICES', text: 'Fourni, livré et installé : un intérieur prêt à recevoir.' },
  'kitchen/faucet': { text: 'Des matériaux et des finitions choisis un à un.' },
  'circulation/treads': { eyebrow: 'ARTEMIS CONSTRUCTION', text: 'Bâtiment, génie civil, VRD, réalisation des travaux : construire avec exigence.' },
  'suite/bed': { eyebrow: 'KAYDAN HOME SERVICES', text: 'Literie, luminaires, voilages : le confort jusque dans les détails.' },
  'bathroom/vanity': { text: 'Des finitions à la hauteur de l’architecture.' },
  'bedroom/bed': { eyebrow: 'FIN DE PROJET AVEC MYKAYDAN', steps: ['Suivre les travaux', 'Solder ses échéances', 'Équiper son logement', 'Livré et installé'] },
}
