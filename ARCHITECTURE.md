# Architecture 3D — KAYDAN Customer Care

## Stack

- `three` : rendu WebGL, matériaux PBR, éclairage, géométries et caméra.
- `@react-three/fiber` : intégration du canvas et de la boucle de rendu dans React.
- `@react-three/drei` : environnement HDRI, DPR adaptatif, moniteur de performance.
- `react-hook-form` + `zod` : contrat du futur formulaire de rendez-vous (chargé uniquement sur `/rendez-vous`).

La landing est une scène WebGL réelle. Le canvas est fixé au viewport et le DOM ne contient que l'interface éditoriale, la navigation, les CTA et la séquence de fin.

## Fichiers

```text
src/experience/
  CustomerCareExperience.tsx  canvas, chargement, overlay éditorial et qualité mobile
  ExperienceOutro.tsx         séquence de fin : conclusion, CTA, index des services, footer
  Scene.tsx                   composition du monde WebGL et adaptation performance
  CameraPath.ts               keyframes caméra ancrées aux sections + splines Catmull–Rom
  CameraRig.tsx               amortissement position/quaternion, FOV, exposition, sondes de dev
  ExteriorVilla.tsx           chargement du GLB de production et réglages matériaux
  Lighting.tsx                lumière naturelle et architecturale progressive
  sections.ts                 source de vérité unique : ordre, numérotation, contenu, routes
  useExperienceScroll.ts      scroll → progression → section, `moveTo`, deep link `?scene=`
  StaticFallback.tsx          fallback uniquement en cas d'absence de WebGL
```

## Source de vérité des sections

`sections.ts` déclare un tableau ordonné. `number`, `ordinal`, `eyebrow` et le compteur `NN / TT` sont **dérivés de l'index** : il n'est pas possible d'écrire un numéro à la main, donc l'eyebrow, le badge de progression et le compteur ne peuvent plus diverger.

| # | Section | Espace cadré | Route |
|---:|---|---|---|
| 01 | EXTÉRIEUR | Allée, façade, escalier d'entrée, garage | — |
| 02 | ENTRÉE | Montée des marches jusqu'à la porte | `/rendez-vous` |
| 03 | HALL D'ACCUEIL | Comptoir d'accueil, robinetterie laiton, ouverture sur l'horizon | `/visiteur` |
| 04 | ESPACE DE TRAVAIL | Table de réunion six places, mur en pierre, suspension | `/reclamation` |
| 05 | CIRCULATION | Escalier suspendu et garde-corps verre | `/suivi` |
| 06 | SALON CLIENT | Table extérieure, cuisine d'été, intérieur lisible au travers du vitrage | `/espace-client` |
| 07 | TERRASSE | Façade sud, deux niveaux de vitrage, bains de soleil, piscine | `/contact` |

Au-delà de `OUTRO_PROGRESS` (0.93), la caméra s'élève en plan large et la séquence de fin prend le cadre.

## Caméra

`CameraPath.ts` déclare des **keyframes** dont l'ancrage `at` est soit une progression brute, soit un identifiant de section — dans ce cas la valeur est lue depuis `sections.ts`. La progression du scroll est remappée segment par segment vers le paramètre de courbe, avec un `smoothstep` par segment. `CatmullRomCurve3.getPoint(i / n)` renvoyant exactement le point de contrôle `i`, **le cadrage d'une section est garanti** ; il n'existe plus de table de timing séparée susceptible de dériver par rapport aux ancres.

Repères mesurés dans le GLB (`npm run inspect:glb`) :

| Niveau | Y |
|---|---:|
| Allée / voie d'accès | 0.70 |
| Rez-de-chaussée | 3.79 |
| Étage | 6.86 |
| Sous-face du plafond RDC | 7.57 |

La hauteur d'œil est donc **~2.35 à l'extérieur et ~5.42 à l'intérieur**. L'ancien parcours était fixé à `y = 4.84`, soit un mètre au-dessus de la dalle : toutes les vues intérieures cadraient le carrelage. C'est la cause corrigée.

### Sondes de développement

Uniquement en `import.meta.env.DEV` :

- `?cam=x,y,z,tx,ty,tz[,fov]` — épingle la caméra sur un cadrage candidat.
- `window.__setCam('x,y,z,tx,ty,tz,fov')` — même chose sans rechargement.
- `window.__snapCam()` — supprime l'amortissement pour une frame, afin qu'une capture QA lise le cadrage réel et non une position transitoire.
- `?debug3d=true` — trajectoire, cible, FPS et section courante.

## Overlay éditorial

Toutes les valeurs d'apparition (`opacity`, `transform`, révélation par ligne) sont **écrites par React à chaque frame** à partir de la progression. Aucune animation CSS n'est autorisée sur ces nœuds : une `animation … both` terminée l'emporte sur les styles inline dans la cascade, ce qui figeait auparavant chaque titre à `opacity: 1` et ne laissait passer que le flou. Les titres se révèlent ligne par ligne derrière un masque `overflow: hidden` — la typographie elle-même n'est jamais floutée.

## Navigation

`SiteHeader` distingue explicitement deux types de destination :

- `type: 'scene'` — déplace la caméra sur la landing ; depuis une sous-page, produit un lien `/?scene=<id>` que `useExperienceScroll` consomme au montage avant de nettoyer l'URL.
- `type: 'route'` — ouvre toujours une vraie page, y compris depuis la landing.

Le CTA « Prendre rendez-vous » est un lien de route dans tous les cas : il n'a jamais vocation à ne faire que bouger la caméra.

## Assets et pipeline

Seules deux variantes sont servies :

| Fichier | Poids | Triangles |
|---|---:|---:|
| `kaydan-villa-production-web.glb` | 13.4 Mo | 339 k |
| `kaydan-villa-production-mobile.glb` | 8.9 Mo | 297 k |

L'export Blender (`kaydan-villa-production.glb`, 69 Mo), les modèles inutilisés et les références look-dev vivent dans **`assets-source/`**, hors de `public/` et non versionnés : Vite ne les copie donc jamais dans `dist`. Régénération :

```bash
npm run optimize:production
```

Le poids venait de la géométrie, pas des textures (5.5 Mo de WebP pour 882 k triangles). La passe applique `dedup` → `instance` → `prune` → `weld` → `simplify` → `textureCompress` → `meshopt` (niveau `high`), et supprime un canapé orphelin de 20 m laissé à 41 m d'altitude derrière la villa.

`index.html` injecte un `<link rel="preload">` vers la bonne variante avant l'exécution du bundle, pour que le téléchargement du GLB parte en parallèle de `three.js`.

## Performance et mobile

- Shell et expérience WebGL chargés séparément ; Three/R3F sont dans des chunks dédiés.
- Les pages capability (et avec elles `react-hook-form` + `zod`) sont en `lazy` : la landing ne paie pas un formulaire qu'elle n'affiche pas.
- `AdaptiveDpr` et `PerformanceMonitor` abaissent la qualité en cas de chute de performance.
- Desktop : DPR plafonné à 1.6, ombres 2048², antialiasing.
- Mobile : DPR plafonné à 1.2, ombres désactivées, antialiasing coupé, modèle allégé, FOV élargi de 6° et trajectoire légèrement reculée.
- Paysage mobile (`max-height: 520px`) : typographie réduite et chrome secondaire masqué, pour que le CTA reste dans le viewport.
- Pas de sourcemaps en production (`vite build --sourcemap` pour les réactiver ponctuellement).

## Accessibilité

Les CTA et la navigation restent du DOM sémantique. Les jalons de visite portent des libellés ARIA. Le chrome masqué par la séquence de fin passe en `visibility: hidden`, ce qui le retire réellement du parcours clavier et du hit-testing. `prefers-reduced-motion` neutralise la révélation par ligne, la transition du menu mobile et le défilement animé de `moveTo`.
