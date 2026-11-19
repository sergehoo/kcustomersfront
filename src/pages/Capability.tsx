import { ArrowUpRight, CalendarDays, CheckCircle2, Clock, FileWarning, LockKeyhole, Mail, MapPin, Phone, QrCode, ScanLine } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentForm } from '../components/capability/AppointmentForm'
import { ApiBoundary } from '../components/feedback/ApiBoundary'
import { PageShell } from '../components/layout/PageShell'
import { SCENE_QUERY_KEY } from '../components/layout/SiteHeader'
import type { ExperienceSectionId } from '../experience/sections'
import { KAYDAN_CONTACT } from '../content/contact'

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
  /** Why it is not live yet, in plain words: never a technical status, never a promise. */
  status: string
  statusLabel: string
}

const PAGES: Record<Capability, CapabilityContent> = {
  appointment: {
    eyebrow: 'MYKAYDAN · RENDEZ-VOUS',
    title: 'Rencontrer un conseiller',
    icon: CalendarDays,
    scene: 'entrance',
    lead: 'Découvrir nos programmes avec un conseiller Kaydan : un échange pour comprendre votre projet et vous accompagner jusqu’à la réservation.',
    steps: [
      { title: 'Vous découvrez les programmes', body: 'Programmes, typologies et simulation de financement.' },
      { title: 'Vous laissez votre demande', body: 'Votre projet, vos disponibilités, vos coordonnées.' },
      { title: 'Un conseiller vous recontacte', body: 'Pour préciser votre projet et organiser une rencontre.' },
      { title: 'Vous réservez votre bien', body: 'Et suivez la suite de votre projet dans MyKaydan.' },
    ],
    benefits: ['Un conseiller dédié', 'Un projet suivi de bout en bout', 'Un seul compte, du premier contact à la remise des clés'],
    statusLabel: 'Ouverture prochaine',
    status: 'La prise de rendez-vous en ligne ouvrira avec MyKaydan One. D’ici là, nos équipes vous répondent par téléphone et par e-mail.',
  },
  visitor: {
    eyebrow: 'ACCUEIL',
    title: 'Préparer votre visite',
    icon: QrCode,
    scene: 'visitor',
    lead: 'Un accès préparé avant votre arrivée sur nos sites, pour un accueil simple et rapide.',
    steps: [
      { title: 'Votre visite est enregistrée', body: 'Motif, date et interlocuteur sont associés à votre venue.' },
      { title: 'Vous recevez votre accès', body: 'Un QR Code personnel, présentable depuis votre téléphone.' },
      { title: 'Vous êtes accueilli', body: 'Le code est contrôlé à l’entrée, sans formalité supplémentaire.' },
    ],
    benefits: ['Accès prêt avant l’arrivée', 'Aucune ressaisie à l’accueil', 'Une visite préparée'],
    statusLabel: 'Ouverture prochaine',
    status: 'Ce service sera accessible depuis MyKaydan One. Aucune donnée personnelle n’est collectée sur cette page.',
  },
  verification: {
    eyebrow: 'ACCUEIL',
    title: 'Vérifier un accès visiteur',
    icon: ScanLine,
    scene: 'visitor',
    lead: 'Contrôler en un scan qu’un accès présenté est valide.',
    steps: [
      { title: 'Le QR Code est scanné', body: 'À l’entrée du site.' },
      { title: 'L’accès est vérifié', body: 'Il est rapproché de la visite prévue.' },
      { title: 'Le résultat s’affiche', body: 'Valide, expiré ou annulé — sans ambiguïté.' },
    ],
    benefits: ['Contrôle en quelques secondes', 'Statuts explicites', 'Accueil fluide'],
    statusLabel: 'Ouverture prochaine',
    status: 'La vérification des accès sera proposée avec MyKaydan One. Elle n’est pas encore disponible en ligne.',
  },
  complaint: {
    eyebrow: 'MYKAYDAN ONE · RÉCLAMATIONS',
    title: 'Faire une réclamation',
    icon: FileWarning,
    scene: 'dining',
    lead: 'Déposer une réclamation depuis votre espace et la suivre de bout en bout, avec un interlocuteur identifié.',
    steps: [
      { title: 'Vous décrivez la situation', body: 'Objet, contexte et photos si besoin.' },
      { title: 'Une référence vous est donnée', body: 'Votre demande est enregistrée immédiatement.' },
      { title: 'Une équipe la traite', body: 'Chaque étape est visible dans votre espace.' },
      { title: 'Vous êtes informé', body: 'Une notification à chaque changement de statut.' },
    ],
    benefits: ['Référence immédiate', 'Interlocuteur identifié', 'Historique consultable'],
    statusLabel: 'Ouverture prochaine',
    status: 'Les réclamations en ligne ouvriront avec MyKaydan One. D’ici là, votre conseiller Kaydan reste votre contact direct.',
  },
  tracking: {
    eyebrow: 'MYKAYDAN ONE · SUIVI',
    title: 'Suivre votre projet',
    icon: CheckCircle2,
    scene: 'circulation',
    lead: 'L’avancement de votre chantier, vos échéances et vos demandes, réunis dans votre espace.',
    steps: [
      { title: 'Vous suivez les travaux', body: 'Photos, vidéos et avancement par corps d’état.' },
      { title: 'Vous soldez vos échéances', body: 'Paiement en ligne et reçu immédiat.' },
      { title: 'Vous équipez votre logement', body: 'Avec Kaydan Home Services, avant la remise des clés.' },
      { title: 'Vous recevez vos clés', body: 'Et pouvez confier votre bien à Kaydan.' },
    ],
    benefits: ['Avancement toujours à jour', 'Aucune relance nécessaire', 'Documents classés et consultables'],
    statusLabel: 'Ouverture prochaine',
    status: 'Le suivi de projet en ligne ouvrira avec MyKaydan One. D’ici là, votre conseiller Kaydan vous tient informé.',
  },
  contact: {
    eyebrow: 'GROUPE KAYDAN',
    title: 'Nous contacter',
    icon: Mail,
    scene: 'terrace',
    lead: 'Une question sur un programme, un projet en cours ou nos services : nos équipes vous répondent.',
    steps: [],
    benefits: [],
    statusLabel: '',
    status: '',
  },
  client: {
    eyebrow: 'MYKAYDAN ONE',
    title: 'Un compte. Une expérience. Tout l’univers Kaydan.',
    icon: LockKeyhole,
    scene: 'finale',
    lead: 'Suivre son bien, payer, échanger avec Kaydan et confier la gestion de son logement : tout se fera depuis un seul compte, sur mobile et sur le web.',
    steps: [
      { title: 'Je découvre et je choisis', body: 'Les programmes, un conseiller, la réservation de mon bien.' },
      { title: 'Je suis mon chantier', body: 'L’avancement des travaux, mes échéances, mes documents.' },
      { title: 'J’équipe mon logement', body: 'Avec Kaydan Home Services, livré et installé avant les clés.' },
      { title: 'Je reçois mes clés', body: 'Et je peux confier mon bien à Kaydan en gestion locative.' },
      { title: 'Je continue à le suivre', body: 'Loyers, charges et reversements, dans le même espace.' },
    ],
    benefits: ['Mes biens', 'Suivi de chantier', 'Paiements', 'Factures et documents', 'Réclamations', 'Alertes', 'Assistance et assistant IA', 'Home Services', 'Gestion locative'],
    statusLabel: 'En préparation',
    status: 'MyKaydan One est en cours de déploiement. L’accès ouvrira aux clients Kaydan à son lancement ; d’ici là, votre conseiller reste votre interlocuteur.',
  },
}

function ContactCard() {
  return <section className="contact-card" aria-label="Coordonnées du Groupe Kaydan">
    <dl>
      <div><dt><MapPin size={16} aria-hidden="true" />Adresse</dt><dd>{KAYDAN_CONTACT.address}</dd></div>
      <div><dt><Phone size={16} aria-hidden="true" />Téléphone</dt><dd><a href={KAYDAN_CONTACT.phoneHref}>{KAYDAN_CONTACT.phone}</a></dd></div>
      <div><dt><Mail size={16} aria-hidden="true" />E-mail</dt><dd><a href={`mailto:${KAYDAN_CONTACT.email}`}>{KAYDAN_CONTACT.email}</a></dd></div>
      <div><dt><Clock size={16} aria-hidden="true" />Horaires</dt><dd>{KAYDAN_CONTACT.hours}</dd></div>
    </dl>
    <a className="subtle-link" href={KAYDAN_CONTACT.website} target="_blank" rel="noreferrer">kaydangroupe.com <ArrowUpRight size={15} /></a>
  </section>
}

export function CapabilityPage({ capability }: { capability: Capability }) {
  const page = PAGES[capability]
  const Icon = page.icon
  if (capability === 'contact') return <PageShell eyebrow={page.eyebrow} title={page.title}>
    <div className="capability-lead">
      <Icon size={30} aria-hidden="true" />
      <p>{page.lead}</p>
    </div>
    <ContactCard />
    <nav className="capability-next" aria-label="Poursuivre">
      <Link to={`/?${SCENE_QUERY_KEY}=${page.scene}`} className="ghost-link">Revenir à l’expérience<ArrowUpRight size={15} /></Link>
    </nav>
  </PageShell>
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
      <h2>{capability === 'client' ? 'Vos espaces' : 'Ce que cela vous apporte'}</h2>
      <ul>{page.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
    </section>

    {capability === 'appointment' && <AppointmentForm />}

    <ApiBoundary note={page.status}>
      <div className="api-meta"><LockKeyhole size={15} /><span>{page.statusLabel}</span></div>
    </ApiBoundary>

    <nav className="capability-next" aria-label="Poursuivre">
      <Link to={`/?${SCENE_QUERY_KEY}=${page.scene}`} className="ghost-link">
        Revenir à l’expérience<ArrowUpRight size={15} />
      </Link>
      <Link to="/contact" className="subtle-link">Une question maintenant ? <ArrowUpRight size={15} /></Link>
    </nav>
  </PageShell>
}
