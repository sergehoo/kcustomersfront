# Livraison

## Développement

```sh
cd customerfront
cp .env.example .env
npm install
npm run dev
```

## Production

```sh
cd customerfront
npm run build
docker compose -f ../docker-compose.yml -f docker-compose.customerfront.yml up -d --build customerfront
```

Le second fichier est un override : il doit être appliqué au même niveau que le `docker-compose.yml` réel du backend. Celui-ci n’est pas présent dans ce dépôt miroir, il n’a donc pas été modifié.

## Nginx et SPA

`nginx.conf` dirige tout chemin inconnu vers `index.html`. Les URL `/rendez-vous`, `/visiteur`, `/visiteur/verification`, `/reclamation`, `/contact`, `/suivi` et `/espace-client` restent ainsi accessibles après rafraîchissement.

## Traefik

Le fichier Compose prépare le routeur TLS `customer.kaydanshield.com` sur l’entrypoint existant `websecure`. Si l’instance Traefik utilise d’autres noms d’entrypoints, un resolver de certificats explicite, ou un réseau externe nommé, reprendre exactement ses conventions dans l’override avant déploiement.

## Variable d’environnement

| Variable | Valeur production | Usage |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.kaydanshield.com` | Base des appels API ; aucun secret |
