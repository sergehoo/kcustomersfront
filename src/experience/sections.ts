export type ExperienceSectionId = 'exterior' | 'entrance' | 'visitor' | 'complaint' | 'tracking' | 'client' | 'contact'

export type ExperienceSection = {
  id: ExperienceSectionId
  label: string
  progress: number
  eyebrow: string
  title: string
  description: string
  href: string
  cta: string
}

export const EXPERIENCE_SECTIONS: ExperienceSection[] = [
  { id: 'exterior', label: 'EXTÉRIEUR', progress: 0, eyebrow: 'KAYDAN — DIGITAL CONCIERGE', title: 'KAYDAN\nCUSTOMER CARE', description: 'Votre relation avec KAYDAN, autrement.', href: '/rendez-vous', cta: 'Découvrir' },
  { id: 'entrance', label: 'ENTRÉE / SALON', progress: .15, eyebrow: '01 — ENTRÉE / SALON', title: 'PRÉPARER VOTRE\nPROCHAINE RENCONTRE', description: 'Une arrivée pensée pour être simple, claire et sereine.', href: '/rendez-vous', cta: 'Prendre rendez-vous' },
  { id: 'visitor', label: 'ESPACE VISITEUR', progress: .3, eyebrow: '02 — ESPACE VISITEUR', title: 'VOTRE VISITE\nCOMMENCE ICI', description: 'Le badge visiteur et son QR Code sont gérés par KAYDAN Shield.', href: '/visiteur', cta: 'Programmer une visite' },
  { id: 'complaint', label: 'BUREAU', progress: .43, eyebrow: '03 — LE BUREAU', title: 'UNE ÉCOUTE QUI\nVOUS ACCOMPAGNE', description: 'Chaque demande mérite une attention précise.', href: '/reclamation', cta: 'Faire une réclamation' },
  { id: 'tracking', label: 'COULOIR / ESCALIER', progress: .57, eyebrow: '04 — CIRCULATION', title: 'GARDEZ UN ŒIL SUR\nVOS DEMANDES', description: 'Retrouvez les informations liées à votre parcours KAYDAN.', href: '/suivi', cta: 'Suivre une demande' },
  { id: 'client', label: 'ESPACE CLIENT', progress: .7, eyebrow: '05 — ESPACE PRIVÉ', title: 'VOS SERVICES KAYDAN,\nRÉUNIS', description: 'Un espace protégé pour continuer votre relation avec KAYDAN.', href: '/espace-client', cta: 'Espace client' },
  { id: 'contact', label: 'TERRASSE', progress: .84, eyebrow: '06 — LA TERRASSE', title: 'NOUS SOMMES À\nVOTRE ÉCOUTE', description: 'La porte reste ouverte pour continuer la conversation.', href: '/contact', cta: 'Nous contacter' },
]

export function sectionAt(progress: number) {
  return EXPERIENCE_SECTIONS.reduce((current, section) => section.progress <= progress ? section : current, EXPERIENCE_SECTIONS[0])
}
