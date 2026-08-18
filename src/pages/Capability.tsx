import { ArrowUpRight, CalendarDays, CheckCircle2, FileWarning, LockKeyhole, Mail, QrCode, ScanLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentForm } from '../components/capability/AppointmentForm'
import { ApiBoundary } from '../components/feedback/ApiBoundary'
import { PageShell } from '../components/layout/PageShell'
import { SCENE_QUERY_KEY } from '../components/layout/SiteHeader'
import type { ExperienceSectionId } from '../experience/sections'

export type Capability = 'appointment' | 'visitor' | 'verification' | 'complaint' | 'tracking' | 'contact' | 'client'

type CapabilityContent = {
  eyebrow: string
  title: string
  icon: LucideIcon
  lead: string
  /** Room of the landing visit this capability belongs to, for the return link. */
  scene: ExperienceSectionId
  /** What the journey will look like once connected. */
  steps: { title: string; body: string }[]
  benefits: string[]
  /** Why it is not live yet. Taken from API_AUDIT.md — never softened, never invented. */
  status: string
  statusLabel: string
}

const PAGES: Record<Capability, CapabilityContent> = {
  appointment: {
    eyebrow: 'ENTRÉE & ARRIVÉE',
    title: 'Prendre rendez-vous',
    icon: CalendarDays,
    scene: 'entrance',
    lead: 'Choisir un créneau, un site et un interlocuteur, sans appel ni relance. Votre venue est préparée avant que vous n’arriviez.',
    steps: [
      { title: 'Vous décrivez votre besoin', body: 'Objet de la visite, site concerné et disponibilités souhaitées.' },
      { title: 'KAYDAN confirme un créneau', body: 'Le site et l’interlocuteur sont rapprochés de votre demande, puis confirmés.' },
      { title: 'Votre venue est préparée', body: 'La demande de visite est enregistrée côté KAYDAN Shield avant votre arrivée.' },
      { title: 'Vous êtes attendu', body: 'L’accueil dispose de votre dossier : plus de temps perdu à la réception.' },
    ],
    benefits: ['Aucun appel nécessaire', 'Créneau confirmé par écrit', 'Accueil préparé à l’avance'],
    statusLabel: 'Endpoint public requis',
    status: 'KAYDAN Shield expose bien la création d’une demande de visite, les sites, les employés et les motifs de visite — mais uniquement pour des sessions authentifiées. Aucun endpoint public, ni endpoint de disponibilités ou de créneaux, n’est déclaré. L’ouverture d’un accès client dédié est le prérequis à l’activation de ce formulaire.',
  },
  visitor: {
    eyebrow: 'HALL D’ACCUEIL',
    title: 'Votre visite, en toute sérénité',
    icon: QrCode,
    scene: 'visitor',
    lead: 'Un badge visiteur nominatif et son QR Code, prêts avant votre arrivée, pour un passage à l’accueil de quelques secondes.',
    steps: [
      { title: 'Votre visite est enregistrée', body: 'Identité, motif et hôte sont associés à la demande de visite.' },
      { title: 'Un badge est généré', body: 'KAYDAN Shield produit le badge visiteur et son QR Code.' },
      { title: 'Vous le recevez', body: 'Le badge vous parvient en PDF, présentable depuis votre téléphone.' },
      { title: 'Vous passez l’accueil', body: 'Le QR Code est contrôlé à l’entrée, sans ressaisie.' },
    ],
    benefits: ['Badge prêt avant l’arrivée', 'Aucune ressaisie à l’accueil', 'Traçabilité complète de la visite'],
    statusLabel: 'Authentification requise',
    status: 'Les visites inopinées, visiteurs, demandes de visite, badges QR et PDF existent dans l’API KAYDAN Shield, mais tous ces endpoints exigent un JWT ou un cookie de session. Cette page ne collecte donc aucune donnée personnelle tant qu’un accès client public et limité n’est pas fourni.',
  },
  verification: {
    eyebrow: 'CONTRÔLE D’ACCÈS',
    title: 'Vérifier un badge visiteur',
    icon: ScanLine,
    scene: 'visitor',
    lead: 'Contrôler en un scan qu’un badge présenté est valide, et distinguer immédiatement un badge expiré d’un badge annulé.',
    steps: [
      { title: 'Le badge est scanné', body: 'Le QR Code du visiteur est lu à l’entrée.' },
      { title: 'Le statut est vérifié', body: 'Le jeton est confronté à la demande de visite correspondante.' },
      { title: 'Le résultat est affiché', body: 'Validé, expiré, annulé ou inconnu — sans ambiguïté possible.' },
    ],
    benefits: ['Contrôle en quelques secondes', 'Statuts explicites', 'Aucune décision laissée à l’interprétation'],
    statusLabel: 'Endpoint public requis',
    status: 'La spécification décrit des QR tokens internes et des QR Codes de badge en image, mais aucun endpoint public de vérification ni de statut (validé, expiré, annulé, inconnu) n’est déclaré. Une vérification publique ne peut pas être implémentée de façon sûre en l’état.',
  },
  complaint: {
    eyebrow: 'ESPACE DE TRAVAIL',
    title: 'Faire une réclamation',
    icon: FileWarning,
    scene: 'office',
    lead: 'Déposer une réclamation et savoir, à chaque instant, qui la traite et où elle en est.',
    steps: [
      { title: 'Vous décrivez la situation', body: 'Objet, contexte et pièces jointes éventuelles.' },
      { title: 'Un dossier est ouvert', body: 'Une référence unique vous est communiquée immédiatement.' },
      { title: 'Une équipe l’instruit', body: 'La réclamation est affectée et son avancement est journalisé.' },
      { title: 'Vous suivez la résolution', body: 'Chaque changement de statut vous est notifié.' },
    ],
    benefits: ['Référence de dossier immédiate', 'Interlocuteur identifié', 'Historique consultable'],
    statusLabel: 'API manquante',
    status: 'Aucune ressource de réclamation client, de dossier ou de soumission publique n’est présente dans l’OpenAPI auditée. Le parcours ci-dessus décrit la cible ; sa mise en service dépend de la création de ces ressources côté KAYDAN Shield.',
  },
  tracking: {
    eyebrow: 'CIRCULATION',
    title: 'Suivre une demande',
    icon: CheckCircle2,
    scene: 'circulation',
    lead: 'Retrouver l’état réel d’une demande à partir de sa référence, sans relancer personne.',
    steps: [
      { title: 'Vous saisissez votre référence', body: 'Le numéro de dossier communiqué au dépôt.' },
      { title: 'Le statut est récupéré', body: 'L’état affiché est celui du backend, jamais une estimation.' },
      { title: 'La chronologie s’affiche', body: 'Dépôt, affectation, instruction, résolution.' },
    ],
    benefits: ['Statut toujours à jour', 'Aucune relance nécessaire', 'Chronologie complète'],
    statusLabel: 'API manquante',
    status: 'L’OpenAPI ne déclare ni suivi client public, ni recherche de dossier, ni chronologie de réclamation. Afficher un statut ici reviendrait à inventer une information : la page reste donc explicite tant que l’API n’existe pas.',
  },
  contact: {
    eyebrow: 'TERRASSE & PISCINE',
    title: 'Restons en contact',
    icon: Mail,
    scene: 'terrace',
    lead: 'Un point d’entrée unique pour joindre KAYDAN, cohérent avec le reste de votre relation client.',
    steps: [
      { title: 'Vous choisissez un sujet', body: 'Commercial, technique, réclamation ou autre.' },
      { title: 'Votre message est routé', body: 'Il rejoint directement l’équipe concernée.' },
      { title: 'Vous obtenez une réponse', body: 'Avec un délai annoncé et un interlocuteur nommé.' },
    ],
    benefits: ['Un seul point d’entrée', 'Routage vers la bonne équipe', 'Délai de réponse annoncé'],
    statusLabel: 'API manquante',
    status: 'Aucun endpoint de contact public ni informations de contact publiques ne sont déclarés dans l’OpenAPI. Aucun formulaire ne peut donc être envoyé ici sans créer un faux parcours. Vos coordonnées KAYDAN habituelles restent le canal valide.',
  },
  client: {
    eyebrow: 'SALON CLIENT',
    title: 'Votre espace KAYDAN',
    icon: LockKeyhole,
    scene: 'client',
    lead: 'Vos demandes, vos visites et vos documents réunis derrière une authentification qui vous est propre.',
    steps: [
      { title: 'Vous vous authentifiez', body: 'Avec des identifiants client dédiés, distincts des comptes internes.' },
      { title: 'Vos dossiers sont réunis', body: 'Rendez-vous, visites, réclamations et suivis au même endroit.' },
      { title: 'Vous agissez', body: 'Déposer, suivre, télécharger — depuis un seul espace.' },
    ],
    benefits: ['Un seul accès pour tout', 'Documents téléchargeables', 'Historique conservé'],
    statusLabel: 'Parcours d’authentification requis',
    status: 'L’API expose /api/v1/auth/login/ et /api/v1/auth/me/, mais ne documente ni le corps de connexion, ni un parcours d’authentification client public distinct des comptes internes. L’intégration est suspendue tant que ce périmètre n’est pas défini.',
  },
}

export function CapabilityPage({ capability }: { capability: Capability }) {
  const page = PAGES[capability]
  const Icon = page.icon
  return <PageShell eyebrow={page.eyebrow} title={page.title}>
    <div className="capability-lead">
      <Icon size={30} aria-hidden="true" />
      <p>{page.lead}</p>
      <p className="capability-soon"><span aria-hidden="true" />Bientôt disponible</p>
    </div>

    <section className="capability-steps" aria-label="Déroulé du parcours">
      <h2>Comment cela se passera</h2>
      <ol>
        {page.steps.map((step, index) => <li key={step.title}>
          <span className="capability-step-number">{String(index + 1).padStart(2, '0')}</span>
          <strong>{step.title}</strong>
          <p>{step.body}</p>
        </li>)}
      </ol>
    </section>

    <section className="capability-benefits" aria-label="Bénéfices">
      <h2>Ce que cela vous apporte</h2>
      <ul>{page.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
    </section>

    {capability === 'appointment' && <AppointmentForm />}

    <ApiBoundary note={page.status}>
      <div className="api-meta"><LockKeyhole size={15} /><span>{page.statusLabel}</span></div>
    </ApiBoundary>

    <nav className="capability-next" aria-label="Poursuivre">
      <Link to={`/?${SCENE_QUERY_KEY}=${page.scene}`} className="ghost-link">
        Revenir à cette pièce de la visite<ArrowUpRight size={15} />
      </Link>
      <Link to="/contact" className="subtle-link">Une question maintenant ? <ArrowUpRight size={15} /></Link>
    </nav>
  </PageShell>
}
