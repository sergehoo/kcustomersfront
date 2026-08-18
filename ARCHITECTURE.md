# Architecture 3D — KAYDAN Customer Care

## Stack

- `three` : rendu WebGL, matériaux PBR, éclairage, géométries et caméra.
- `@react-three/fiber` : intégration du canvas et de la boucle de rendu dans React.
- `@react-three/drei` : géométries arrondies, DPR adaptatif et moniteur de performance.
- `framer-motion` reste réservé aux interfaces classiques ; il ne pilote plus la scène ni la caméra.

La landing est une scène WebGL réelle. Le canvas est fixé au viewport et le DOM ne contient que l’interface éditoriale, la navigation, les CTA et les indicateurs de progression.

## Fichiers

```text
src/experience/
  CustomerCareExperience.tsx  canvas, chargement, overlay et qualité mobile
  Scene.tsx                   composition du monde WebGL et adaptation performance
  CameraPath.ts               trajectoires Catmull–Rom position / point visé
  CameraRig.tsx               interpolation position, quaternion, micro-sway et parallax souris
  VillaModel.tsx              chargement du modèle optimisé `kaydan-villa.glb`
  Lighting.tsx                lumière naturelle et architecturale progressive
  sections.ts                 source unique de progression, contenu et destinations
  useExperienceScroll.ts      scroll → progression → section / navigation caméra
  StaticFallback.tsx          fallback uniquement en cas d’absence WebGL
```

## Visite et trajectoire caméra

| Progression | Lieu | Destination Customer Care |
|---:|---|---|
| 0.00 | Extérieur, piscine et façade | Accueil |
| 0.13 | Entrée / hall | Découverte |
| 0.29 | Salon et espace rendez-vous | `/rendez-vous` |
| 0.46 | Réception | `/visiteur` |
| 0.64 | Bureau Customer Care | `/reclamation` |
| 0.79 | Atelier client | `/suivi` |
| 0.93 | Terrasse | `/contact` |

`useExperienceScroll()` transforme la hauteur de visite en une progression continue de 0 à 1. `CameraRig` échantillonne deux courbes Catmull–Rom distinctes : une pour la position de caméra et une pour le point regardé. La position est amortie par interpolation, tandis que l’orientation utilise `Quaternion.slerp`. La souris influence très légèrement le point visé ; elle ne peut donc pas déstabiliser la trajectoire.

Le header et les jalons latéraux appellent la même abstraction `moveTo(section)` : ils font défiler vers la progression cible et déplacent ainsi la vraie caméra dans le canvas, au lieu de changer de page sur l’accueil.

## Maison procédurale et assets

Il n’existait aucun GLB/GLTF dans le dépôt. `npm run generate:villa` produit désormais [kaydan-villa.glb](public/models/kaydan-villa.glb), puis le déduplique, soude et quantifie. Le modèle regroupe une terrasse, salon avec îlot-bar, chambre, salle de bain, escalier, salon secondaire et terrasse finale ; il comprend sols pierre claire, plâtre ivoire, claustras chêne, vitrage, métal, mobilier et végétation. Il est chargé à l’exécution par `useGLTF` et non reconstruit en JSX.

Les photographies `public/img/` sont exclusivement des références de look-dev. Elles ne sont ni affichées comme arrière-plan, ni mappées sur le modèle. Le look-dev charge des maps PBR CC0 (pierre, chêne, textile bouclé et enduit) ainsi qu’un HDRI 1K : leurs sources et licences sont documentées dans [public/assets/materials/LICENSES.md](public/assets/materials/LICENSES.md).

## Performance et mobile

- Shell et expérience WebGL chargés séparément ; Three/R3F sont dans des chunks dédiés.
- `AdaptiveDpr` et `PerformanceMonitor` abaissent la qualité en cas de chute de performance.
- Desktop : DPR plafonné à 1.65, ombres directionnelles 2048² et antialiasing.
- Mobile : DPR plafonné à 1.25, ombres désactivées, éclairage d’ombre 512² et antialiasing coupé.
- Pas de textures lourdes, HDR distant, modèle géant ni dépendance de post-processing.
- Le fallback n’est utilisé qu’après détection explicite de WebGL indisponible.

## Accessibilité

Les CTA et la navigation restent du DOM sémantique. Les points de visite ont des labels ARIA et les liens restent accessibles au clavier. Les animations décoratives CSS sont neutralisées sous `prefers-reduced-motion`; une prochaine itération peut ajouter un basculement explicite vers la navigation sans mouvement de caméra pour les utilisateurs qui le souhaitent.
