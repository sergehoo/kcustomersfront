import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KAYDAN_CONTACT } from '../../content/contact'

/**
 * The contract the future endpoint will receive. It is defined here — rather
 * than when the backend lands — so the shape is reviewable now and the fields
 * below stay in sync with it.
 *
 * No `onSubmit` is wired on purpose: no public appointment service exists yet
 * (see API_AUDIT.md), and pretending a request succeeded would be worse than
 * saying it is not open yet.
 */
export const appointmentSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Adresse e-mail invalide'),
  phone: z.string().min(6, 'Téléphone requis'),
  company: z.string().optional(),
  purpose: z.string().min(1, 'Objet requis'),
  date: z.string().min(1, 'Date requise'),
  time: z.string().min(1, 'Heure requise'),
  message: z.string().max(1000).optional(),
})

export type AppointmentPayload = z.infer<typeof appointmentSchema>

type FieldSpec = {
  name: keyof AppointmentPayload
  label: string
  type?: string
  span?: 'full'
  options?: string[]
  rows?: number
}

const FIELDS: FieldSpec[] = [
  { name: 'firstName', label: 'Prénom' },
  { name: 'lastName', label: 'Nom' },
  { name: 'email', label: 'E-mail', type: 'email' },
  { name: 'phone', label: 'Téléphone', type: 'tel' },
  { name: 'company', label: 'Société (facultatif)', span: 'full' },
  { name: 'purpose', label: 'Objet de la visite', options: ['Découvrir un programme', 'Suivi de mon projet', 'Home Services', 'Autre'] },
  { name: 'date', label: 'Date souhaitée', type: 'date' },
  { name: 'time', label: 'Heure souhaitée', type: 'time' },
  { name: 'message', label: 'Message', span: 'full', rows: 4 },
]

export function AppointmentForm() {
  const { register, formState } = useForm<AppointmentPayload>({
    resolver: zodResolver(appointmentSchema),
    mode: 'onBlur',
  })

  return <section className="capability-form" aria-labelledby="appointment-form-title">
    <div className="capability-form-head">
      <h2 id="appointment-form-title">Le formulaire de demande</h2>
      <p>Ce formulaire sera actif à l’ouverture de MyKaydan One. D’ici là, aucune donnée n’est collectée ni transmise.</p>
    </div>

    <form className="capability-fields" noValidate aria-describedby="appointment-form-status">
      <fieldset disabled>
        <legend className="sr-only">Demande de rendez-vous</legend>
        {FIELDS.map((field) => <div key={field.name} className={`field ${field.span === 'full' ? 'field--full' : ''}`}>
          <label htmlFor={`appointment-${field.name}`}>{field.label}</label>
          {field.options
            ? <select id={`appointment-${field.name}`} {...register(field.name)}>
                <option value="">Sélectionner…</option>
                {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            : field.rows
              ? <textarea id={`appointment-${field.name}`} rows={field.rows} {...register(field.name)} />
              : <input id={`appointment-${field.name}`} type={field.type ?? 'text'} {...register(field.name)} />}
          {formState.errors[field.name] && <small role="alert">{formState.errors[field.name]?.message}</small>}
        </div>)}
      </fieldset>

      <p className="capability-form-status" id="appointment-form-status">
        <strong>Envoi bientôt disponible.</strong> La prise de rendez-vous en ligne ouvrira avec MyKaydan One. En attendant, contactez-nous au {KAYDAN_CONTACT.phone} ou à {KAYDAN_CONTACT.email}.
      </p>
    </form>
  </section>
}
