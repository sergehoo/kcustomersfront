# Audit OpenAPI — KAYDAN Customer Care

Audit réalisé le 15 août 2026 depuis `https://api.kaydanshield.com/api/schema/` (OpenAPI 3.0.3, titre **KAYDAN SHIELD API**, version 1.0.0).

## Décision d’intégration

La spécification déclare deux mécanismes de sécurité : `jwtAuth` (Bearer JWT) et `cookieAuth` (`sessionid`). Tous les endpoints fonctionnels ci-dessous exigent l’un d’eux, à l’exception de `POST /api/v1/auth/login/`, qui est documenté sans sécurité mais sans corps de requête ni schéma de réponse. Aucun endpoint Customer Care public n’est exposé.

Le frontend ne transmet donc aucune information personnelle et ne lance aucune requête métier sans session autorisée. Les adaptateurs API de `src/api/` reprennent uniquement les chemins et formats explicitement déclarés.

## Matrice Customer Care

| Feature | Endpoint | Method | Auth | Request | Response / statut | Frontend |
|---|---|---:|---|---|---|---|
| Authentification | `/api/v1/auth/login/` | POST | Non documentée | Non documenté | 200, corps non documenté | Non intégré : contrat incomplet |
| Rafraîchir session | `/api/v1/auth/token/refresh/` | POST | Global | `{ refresh: string }` | 200 `{ access: string }` | Adaptateur, pas de stockage de token |
| Utilisateur courant | `/api/v1/auth/me/` | GET | JWT/cookie | — | 200, corps non documenté | Adaptateur |
| Filiales (ressource la plus proche) | `/api/v1/core/companies/` | GET | JWT/cookie | `is_active, limit, offset, ordering, search, sector, tenant` | 200 `Paginated[Company]` | `useBranches()`, désactivé sans session |
| Sites | `/api/v1/sites/sites/` | GET | JWT/cookie | `company, status, type, search, tenant, limit, offset, ordering` | 200 `Paginated[Site]` | Adaptateur |
| Collaborateurs à rencontrer | `/api/v1/employees/employees/` | GET | JWT/cookie | `company, department, status, search, tenant, limit, offset, ordering` | 200 `Paginated[Employee]` | Adaptateur |
| Motifs de visite | `/api/v1/visitors/purposes/` | GET | JWT/cookie | `is_active, search, limit, offset, ordering` | 200 `Paginated[VisitPurpose]` | Adaptateur |
| Catégories de visite | `/api/v1/visitors/categories/` | GET | JWT/cookie | `is_active, print_template, search, limit, offset, ordering` | 200 `Paginated[VisitorCategory]` | À activer après session |
| Créer visiteur | `/api/v1/visitors/visitors/` | POST | JWT/cookie | `VisitorRequest` | 201 `Visitor` | Adaptateur, formulaire bloqué par auth |
| Créer demande de visite / rendez-vous | `/api/v1/visitors/requests/` | POST | JWT/cookie | `VisitRequestRequest` | 201 `VisitRequest` | Adaptateur, formulaire bloqué par auth |
| Visiteur inopiné | `/api/v1/visitors/requests/walk-in/` | POST | JWT/cookie | `VisitRequestRequest` | 200, schéma non documenté | Adaptateur, formulaire bloqué par auth |
| Détail/suivi d’une visite | `/api/v1/visitors/requests/{id}/` | GET | JWT/cookie | `id` entier | 200 `VisitRequest` | Adaptateur, pas de recherche publique |
| Badge visiteur PDF | `/api/v1/visitors/requests/{id}/badge.pdf` | GET | JWT/cookie | `id` entier | 200 fichier PDF (média non précisé) | `Blob` + nom Content-Disposition prêt |
| QR du badge visiteur | `/api/v1/visitors/requests/{id}/badge-qr.png` | GET | JWT/cookie | `id` entier | 200 image PNG (média non précisé) | URL exacte prête |
| Pass visiteur historique | `/api/v1/visitors/passes/` | GET | JWT/cookie | `type, visit_request, search, limit, offset, ordering` | 200 `Paginated[VisitorPass]` | Non exposé au public |
| QR tokens | `/api/v1/access/qr-tokens/` | GET | JWT/cookie | `single_use, visit_request, search, limit, offset, ordering` | 200 `Paginated[QRToken]` | Non exposé au public |
| Journal de visites | `/api/v1/visitors/logs/` | GET | JWT/cookie | `visit_request, search, limit, offset, ordering` | 200 pagination | Non exposé au public |
| Notifications | `/api/v1/notifications/` | GET | JWT/cookie | `channel, level, recipient, status, tenant, unread, search, limit, offset, ordering` | 200 `Paginated[Notification]` | Non exposé au public |
| Tickets maintenance | `/api/v1/devices/maintenance/tickets/` | GET/POST | JWT/cookie | Non documenté | 200, corps non documenté | Hors périmètre : ce ne sont pas des réclamations client |

`Paginated[T]` représente l’enveloppe standard documentée : `count`, `next`, `previous`, `results`.

## Contrats de requête utiles

### `VisitorRequest` — POST `/api/v1/visitors/visitors/`

Requis : `first_name`, `last_name`. Optionnels : `date_of_birth`, `nationality`, `id_type`, `id_number`, `phone`, `email`, `company`, `job_title`, `photo` (binaire multipart), `notes`, `created_by`, `updated_by`.

### `VisitRequestRequest` — POST `/api/v1/visitors/requests/` ou `/walk-in/`

Requis : `visitor` (entier), `site` (entier). Optionnels : `purpose_other`, `mode`, `status`, `scheduled_at`, `expected_duration_minutes`, `expected_departure_at`, `notes`, `building`, `party_size`, `vehicle_plate`, `expected_documents`, `confidentiality`, `access_level`, `approval_mode`, `host_employee`, `purpose`, `category`, `company`, `allowed_zones`, `created_by`, `updated_by`.

La réponse `VisitRequest` fournit notamment : `visitor_name`, `site_name`, `host_name`, `status`/`status_label`, `mode`/`mode_label`, `scheduled_at`, `badge_pdf_url`, `badge_uid`, `allowed_transitions`, ainsi que les métadonnées d’approbation et de passage. Le frontend ne reconstitue jamais le QR ou le badge à partir de ces données.

### Formats et erreurs déclarés

Les écritures acceptent `application/json`, `application/x-www-form-urlencoded` et `multipart/form-data` quand un schéma de requête est exposé. Les réponses nominales sont 200/201/204 selon l’opération. La spécification ne détaille pas, endpoint par endpoint, les schémas d’erreur 400, 401, 403, 404, 409, 422, 429 ou 500. Le client centralise ces réponses en `ApiError`, avec timeout à 15 s, et ne tente qu’un unique retry de lecture pour les erreurs transitoires.

## Endpoints examinés mais non utilisables pour le portail public

| Domaine | Ressources examinées | Conclusion |
|---|---|---|
| Utilisateurs | `/api/v1/auth/users/`, `/roles/`, `/role-assignments/`, `/api-keys/`, `/login-attempts/` | Administration interne, JWT/cookie requis |
| Entreprises | `/api/v1/core/companies/{id}/`, `/logo/`, `/tenants/`, `/addresses/` | Gestion interne, JWT/cookie requis |
| Employés | `/employees/{id}/`, `departments/`, `positions/`, `contracts/`, `schedules/`, `authorizations/` | Gestion RH et sécurité, JWT/cookie requis |
| Visiteurs | `invitations/`, `approval-levels/`, `id-documents/`, `watchlist/`, `watchlists/`, `visitors/{id}/visits/` | Gestion opérationnelle, JWT/cookie requis |
| Visite — actions | `requests/{id}/approve/`, `reject/`, `cancel/`, `check-in/`, `check-out/`, `issue-badge/`, `return-badge/`, `regenerate-badge-qr/`, `scan-check-in/`, `dashboard/` | Actions d’agent/sécurité, JWT/cookie requis |
| Badges matériels | `/api/v1/devices/badges/` et actions, `/badges/{id}/pdf/` | Badge NFC/RFID interne ; à ne pas confondre avec le QR temporaire visiteur |
| Fichiers | `/media/{path}` | Serveur de média générique ; pas un contrat public de téléchargement de document client |

## APIs manquantes pour le cahier des charges

1. Création publique d’un rendez-vous, ou mécanisme d’authentification client documenté et à privilèges limités.
2. Liste publique des filiales/sites, des types de rendez-vous et des collaborateurs disponibles.
3. Créneaux/disponibilités en temps réel.
4. Récupération publique, sécurisée et limitée d’un badge visiteur/PDF/QR par référence non devinable.
5. Vérification publique d’un QR avec états `valide`, `expiré`, `annulé`, `inconnu`, sans divulgation de données personnelles.
6. Réclamations client : création, numéro de dossier, pièces jointes, statuts/timeline et suivi public sécurisé.
7. Contact public ou publication d’informations de contact vérifiées.
8. Contrat de connexion documenté (corps de `login`, réponse, cookies, durée, CORS/CSRF) pour un espace client.

## Sources

- Swagger UI : `https://api.kaydanshield.com/api/docs/#/`
- Spécification utilisée : `https://api.kaydanshield.com/api/schema/`
