# KAYDAN Customer Care — audit immersif V2

Date : 16 août 2026

## Verdict

La landing n'est plus un visualiseur de maquette : elle utilise un Canvas persistant, une seule villa connectée et un travelling continu piloté par le scroll. La caméra part de l'extérieur, monte les marches, franchit l'entrée, parcourt les espaces meublés et ressort vers la piscine et la terrasse.

Le critère « V-Ray archviz, réalisme ≥ 8/10 » n'est toutefois pas encore atteint. Le blocage restant est principalement artistique : végétation source sombre, détails intérieurs irréguliers, absence de lightmaps et matériaux moins précis que les références. Le code et l'éclairage temps réel ne peuvent pas créer les UV, coutures, niches, voilages et détails absents de l'asset source.

## Look development

Deux cibles photoréalistes cohérentes ont été produites à partir des références utilisateur. Elles servent exclusivement de référence artistique et ne sont ni des backgrounds, ni des textures de substitution :

- `public/lookdev/kaydan-exterior-entry-target.png`
- `public/lookdev/kaydan-living-target.png`

Direction retenue : travertin clair, enduit ivoire, chêne chaud, menuiseries anthracite, verre architectural, textiles taupe, lumière naturelle chaude et décoration basse.

## Asset actif

| Variante | Avant | Après | Meshes | Matériaux | Textures | Résolutions |
|---|---:|---:|---:|---:|---:|---|
| Prototype procédural historique | 239 Ko | non utilisé dans `/` | 69 | 12 | 0 | — |
| Villa desktop | 253 Mo source | 26 641 768 octets | 147 | 62 | 100 | 81 × 1024², autres 256–1024 |
| Villa mobile | 253 Mo source | 22 098 444 octets | 147 | 62 | 100 | 84 × 512², autres 256–512 |

Le modèle actif est `public/models/exterior/kaydan-coastal-villa-web.glb`. La variante mobile est `public/models/exterior/kaydan-coastal-villa-mobile.glb`. La source est *Modern Coastal Hillside Villa* de Visthétique, sous CC BY 4.0 ; le crédit reste visible dans l'expérience.

L'optimisation est reproductible avec `npm run optimize:exterior` : déduplication, pruning, WebP et Meshopt. La géométrie architecturale, le mobilier, la cuisine et la robinetterie nécessaires au parcours ont été conservés.

## Échelle et continuité

- échelle GLB active : `0.15` ;
- porte mesurée : environ 2,1 m ;
- hauteur caméra : 1,65 m à l'extérieur, puis niveau humain adapté aux plateformes de la villa ;
- FOV desktop : 48–52° ; mobile : 53–57° ;
- aucun échange de modèle à 18,5 % ;
- aucun fade entre pièces ;
- un seul Canvas et un seul graphe de scène pendant toute la visite.

## Caméra

`CameraPath.ts` définit deux splines `CatmullRomCurve3` synchronisées : position et cible. La distance parcourue est remappée pour raccourcir les zones d'occlusion sans téléportation. `CameraRig.tsx` ajoute inertie, easing, micro-sway et parallax souris très faible. Le mobile possède une variante de trajectoire et un FOV distinct.

Parcours : façade → approche → marches → entrée → salle à manger/salon → corridor → espace intérieur → patio/piscine → terrasse finale.

Le mode `/?debug3d=true` affiche les deux courbes, la position, la cible, la progression, le chapitre et le FPS.

## Matériaux et lumière

- HDRI : `public/assets/hdr/blouberg-sunrise-1-1k.hdr` ; source et licence dans `public/assets/materials/LICENSES.md` ;
- tone mapping ACES et exposition adaptée progressivement extérieur/intérieur ;
- soleil directionnel, hémisphère, éclairages pratiques et ombres desktop 2048 ;
- verre physique : transmission 0,76, IOR 1,48, épaisseur 0,09, roughness 0,08 ;
- réglages ciblés eau, textile, pierre et végétation ;
- animation lente des maps d'eau ;
- anisotropie 8 desktop / 2 mobile.

Il n'y a pas de lightmap baked ni de SSAO ajouté dans cette passe. Le post-traitement a été volontairement limité afin de ne pas masquer la faiblesse des assets et de préserver le mobile.

## Captures de contrôle

Les 11 checkpoints sont dans `audit/checkpoints-v2-final/`.

| Progression | Composition observée | Défaut restant |
|---:|---|---|
| 0 % | façade entière, premier plan végétal, architecture lisible | végétation trop sombre, matériaux encore CG |
| 10 % | approche et montée vers l'entrée | premier plan dense mais profondeur convaincante |
| 20 % | passage rapproché des marches | trop de béton dans le cadre |
| 30 % | entrée physique dans le volume | zone peu décorée |
| 40 % | salon/salle à manger meublé, pierre et vitrage | meilleur intérieur, lumière encore plate |
| 50 % | pilier et baie en occlusion naturelle | image de transition, pauvre comme arrêt fixe |
| 60 % | corridor et foyer | mobilier et décoration insuffisants |
| 70 % | espace lounge/piscine | composition perfectible |
| 80 % | eau et continuité extérieur/intérieur | architecture moins présente |
| 90 % | vue terrasse, piscine et mobilier extérieur | horizon trop uniforme |
| 100 % | arrivée près de la table extérieure | végétation et lumière finale à enrichir |

## Scores honnêtes

| Catégorie | Score actuel |
|---|---:|
| Géométrie | 6/10 |
| Matériaux | 5/10 |
| Éclairage | 5/10 |
| Composition | 6/10 |
| Réalisme | 5/10 |
| Immersion en mouvement | 7/10 |

La continuité et l'échelle sont validées. La phase V2 n'est pas déclarée « V-Ray quality » : aucune note artificiellement élevée n'est attribuée.

## Production asset nécessaire pour atteindre 8/10

Blender n'est pas installé dans l'environnement courant. La prochaine passe archviz nécessite une vraie production DCC, en priorité :

1. corriger ou remplacer la végétation et son atlas alpha ;
2. reprendre les UV des grandes surfaces proches de la caméra ;
3. ajouter plinthes, joints, menuiseries, voilages, poignées et luminaires ;
4. remplacer les assises/textiles les plus faibles par des assets archviz ;
5. préparer UV2 et baker une lightmap intérieure dans Blender/Cycles ;
6. exporter une version GLB/KTX2 validée visuellement ;
7. réajuster les points 20 %, 50 %, 70 % et 80 % sur l'asset final.

Les GLB additionnels présents dans `public/models/` ont été inspectés mais non assemblés aveuglément : leurs échelles, licences ou enveloppes spatiales ne permettent pas de garantir une villa cohérente sans travail Blender.

## Tests réalisés

- 101 positions successives du scroll de 0 à 100 % dans le navigateur ; Canvas WebGL resté actif ;
- 11 captures desktop aux progressions demandées ;
- contrôle du mode debug 3D ;
- contrôle console : aucune erreur React, réseau, GLTF ou WebGL ;
- contrôle réel aux viewports 375×812, 390×844, 768×1024, 1024×768 et 1440×900 : Canvas actif et aucun débordement horizontal ;
- `npm run lint` ;
- `npm run build` ;
- routes métier laissées intactes.

Les avertissements `THREE.Clock` proviennent de la version actuelle de la stack R3F/Three. Ils ne cassent pas le rendu. La configuration d'ombres utilise désormais PCF plutôt que l'ancien mode PCFSoft déprécié.
