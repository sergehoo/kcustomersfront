import { ArrowUpRight, CalendarDays, CheckCircle2, FileWarning, LockKeyhole, Mail, QrCode, ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { PageShell } from '../components/layout/PageShell'
import { ApiBoundary } from '../components/feedback/ApiBoundary'

type Capability = 'appointment' | 'visitor' | 'verification' | 'complaint' | 'tracking' | 'contact' | 'client'

const pages: Record<Capability, { eyebrow: string; title: string; icon: LucideIcon; lead: string; api: string; available: boolean; cta?: string }> = {
  appointment: { eyebrow: 'LE BUREAU', title: 'Prendre rendez-vous', icon: CalendarDays, lead: 'KAYDAN Shield expose la création d’une demande de visite, les sites, les employés et les motifs de visite. Ces ressources sont réservées aux sessions authentifiées.', api: 'Aucun endpoint public ni endpoint de disponibilités/créneaux n’est déclaré. Une passerelle d’authentification client ou des endpoints publics dédiés sont requis avant de présenter ce formulaire.', available: false },
  visitor: { eyebrow: 'LA RÉCEPTION', title: 'Votre visite, en toute sérénité.', icon: QrCode, lead: 'Les visites inopinées, visiteurs, demandes de visite, badges QR et PDF existent dans l’API KAYDAN Shield.', api: 'Tous ces endpoints exigent JWT ou cookie de session. Cette page ne collecte donc aucune donnée personnelle tant qu’un accès client public et limité n’est pas fourni.', available: false },
  verification: { eyebrow: 'LE CONTRÔLE D’ACCÈS', title: 'Vérifier un badge visiteur', icon: ScanLine, lead: 'La spécification décrit des QR tokens internes et des QR Code de badge en image.', api: 'Aucun endpoint public de vérification d’un badge/QR ni statut validé, expiré, annulé ou inconnu n’est déclaré. La vérification publique ne peut pas être implémentée de façon sûre.', available: false },
  complaint: { eyebrow: 'LE SERVICE CLIENT', title: 'Faire une réclamation', icon: FileWarning, lead: 'Votre écoute mérite un parcours clair, sécurisé et traçable.', api: 'API MANQUANTE : aucune ressource de réclamation client, de dossier ou de soumission publique n’est présente dans l’OpenAPI auditée.', available: false },
  tracking: { eyebrow: 'L’ESPACE CLIENT', title: 'Suivre une demande', icon: CheckCircle2, lead: 'Les statuts affichés doivent toujours être ceux du backend.', api: 'API MANQUANTE : l’OpenAPI ne déclare pas de suivi client public, de recherche de dossier ni de timeline de réclamation.', available: false },
  contact: { eyebrow: 'LA TERRASSE', title: 'Restons en contact', icon: Mail, lead: 'Nous préparons un espace de contact cohérent avec votre relation KAYDAN.', api: 'API MANQUANTE : aucun endpoint de contact public ni informations de contact publiques ne sont déclarés. Aucun formulaire ne peut être envoyé sans créer de faux parcours.', available: false },
  client: { eyebrow: 'L’ESPACE CLIENT', title: 'Votre espace KAYDAN', icon: LockKeyhole, lead: 'Un espace protégé doit reposer sur une authentification et des autorisations spécifiques.', api: 'L’API expose /api/v1/auth/login/ et /api/v1/auth/me/, mais ne documente ni le corps de connexion, ni un parcours d’authentification client public distinct. Intégration suspendue.', available: false },
}

export function CapabilityPage({ capability }: { capability: Capability }) {
  const page = pages[capability]; const Icon = page.icon
  return <PageShell eyebrow={page.eyebrow} title={page.title}>
    <div className="capability-grid"><div className="capability-intro"><Icon size={31} aria-hidden="true" /><p>{page.lead}</p><Link to="/" className="subtle-link">Explorer les services <ArrowUpRight size={16} /></Link></div>
      <ApiBoundary note={page.api}><div className="api-meta"><LockKeyhole size={15} /><span>Authentification requise ou API non exposée publiquement</span></div></ApiBoundary></div>
  </PageShell>
}
