# Audit visuel — KAYDAN Customer Care

Date de l’audit : 15 août 2026  
Viewport inspecté : 1440 × 900  
Rendu : application Vite réelle, Canvas WebGL actif, captures effectuées dans le navigateur intégré.

## Verdict

Le pipeline technique fonctionne, mais le rendu est rejeté comme visualisation architecturale finale. Le GLB actuel est un prototype spatial procédural de 240 Ko : 310 nœuds, 69 meshes, 12 matériaux et aucune texture embarquée. Les quatre jeux PBR externes améliorent les surfaces mais ne compensent pas l’absence de géométrie et de mobilier détaillés.

Le projet contient désormais trois assets détaillés actifs et licenciés dans `public/models/external/` : fauteuil contemporain, suspension et Calathea. Un quatrième asset végétal a été importé mais rejeté du rendu après comparaison visuelle, sa silhouette restant trop conique. L’architecture principale et les canapés restent ceux du prototype `public/models/kaydan-villa.glb`.

## Matrice de comparaison

| Référence | Scène actuelle | Différences observées | Cause | Correction requise |
| --- | --- | --- | --- | --- |
| Façade contemporaine `50ca…jpg` | `audit/screenshots/00-exterior.png` | Villa invisible, image presque blanche, aucune façade identifiable, aucune profondeur extérieure | Caméra devant une enveloppe arrière sans véritable façade ; architecture procédurale ; exposition trop haute | Remplacer l’enveloppe par un modèle architectural détaillé avec façade, menuiseries, terrasse et paysage ; recalibrer exposition et checkpoint |
| Terrasse ouverte `11…jpg` | `audit/screenshots/01-entrance.png` | Surface blanche dominante, mobilier et garde-corps absents, composition sans point d’intérêt | Premier waypoint ne cadre pas une terrasse réellement meublée | Importer terrasse/pergola/outdoor détaillés ; cadrer foreground, midground et horizon |
| Salon/bar `30…jpg` | `audit/screenshots/02-appointment.png` | Caméra face à un mur et une vitre ; salon non lisible | Path non aligné sur les pièces et absence d’un salon archviz complet | Nouveau waypoint salon + mobilier détaillé, tapis, bar, luminaires et décoration |
| Salon pierre `21…jpg` | `audit/screenshots/03-visitor.png` | Canapés et fauteuils cubiques, arbre conique, mur gris uniforme, matériaux sans microdétail visible | Mobilier généré à partir de primitives ; végétation simplifiée ; aucune décoration | Remplacer par assets de mobilier, végétation et mur pierre photogrammétrique/modélisé |
| Espace rencontre | `audit/screenshots/04-complaint.png` | Pièce lisible mais composition générique ; suspensions sphériques ; verre laiteux ; pas de profondeur réaliste | Géométrie prototype et réutilisation des mêmes objets | Asset de salon secondaire, luminaires détaillés, rideaux, accessoires et vitrage architectural |
| Chambre `25…jpg` | `audit/screenshots/05-tracking.png` | Caméra face à une grande surface uniforme ; chambre non visible | Checkpoint caméra désynchronisé ; architecture cloisonnée sans circulation crédible | Modèle chambre complet et waypoint dédié avec passage de porte sans clipping |
| Salle de bain `23…jpg` | Aucun checkpoint UI dédié | Baignoire procédurale non présentée par la narration | Parcours limité à 7 sections et absence de salle de bain détaillée | Asset salle de bain complet, éclairage indirect, miroir, robinetterie et checkpoint dédié |
| Escalier / circulation | Aucun checkpoint UI dédié | Escalier simplifié, aucun hall double hauteur convaincant | Prototype spatial et parcours incomplet | Asset d’escalier/hall avec garde-corps, marches, limons, verre et éclairage |
| Terrasse finale `19…jpg` / `28…jpg` | `audit/screenshots/07-final-scroll.png` | Scène entièrement vide et surexposée ; seul le ciel est visible | Dernier point caméra placé au-delà du décor, sans point d’intérêt cadré | Bug critique : replacer le waypoint sur la terrasse ; importer mobilier lounge, végétation et horizon |

## Analyse transversale

| Domaine | État observé | Niveau requis |
| --- | --- | --- |
| Géométrie | Volumes simples, silhouettes rectangulaires, peu de détails de construction | Architecture avec épaisseurs, joints, menuiseries, niches, rails, plinthes et détails visibles aux plans rapprochés |
| Mobilier | Canapés, fauteuils, tables et luminaires issus de primitives | Mobilier archviz avec couture, plis, capitonnage, piètement et accessoires |
| Matériaux | 4 familles PBR 1K présentes, mais géométrie/UV et éclairage ne les valorisent pas | Bibliothèque PBR cohérente 1K/2K par catégorie, UV dédiés et variation d’échelle |
| Verre | Transmission activée mais aspect laiteux/gris | Vitrage à épaisseur réelle, menuiseries, reflets HDRI contrôlés et double face maîtrisée |
| Lumière | HDRI et soleil présents, exposition trop claire sur plusieurs vues | Hiérarchie daylight/intérieur, sources émissives, ombres de contact et contraste archviz |
| Ombres | Ombres présentes sur certains volumes, faibles ou absentes sur les grandes surfaces | Ombres stables, douces, sans acne, avec contact au sol |
| Profondeur | Très peu de foreground et scènes souvent cadrées frontalement | Passage près d’une plante, d’un claustra, d’un canapé et à travers des ouvertures réelles |
| Environnement | Ciel clair et sol uniforme | Paysage/horizon, végétation LOD et contexte extérieur cohérent |
| Caméra | 7 étapes UI pour 9 espaces demandés ; plusieurs points face aux murs ; fin vide | Waypoints explicites position/cible/FOV, alignés aux pièces et testés visuellement |
| Performance | Assets légers, mais qualité insuffisante ; avertissements d’ombres répétés | Budget progressif avec LOD, Meshopt/Draco, KTX2 et mesures FPS réelles |

## Captures de l’audit

- `audit/screenshots/00-exterior.png`
- `audit/screenshots/01-entrance.png`
- `audit/screenshots/02-appointment.png`
- `audit/screenshots/03-visitor.png`
- `audit/screenshots/04-complaint.png`
- `audit/screenshots/05-tracking.png`
- `audit/screenshots/06-terrace.png`
- `audit/screenshots/07-final-scroll.png`

Ces captures documentent l’état rejeté et ne constituent pas une validation finale.

## Itérations caméra et éclairage

Une première correction a remplacé la progression uniforme sur la courbe par des waypoints explicitement liés aux progressions éditoriales. Chaque waypoint possède désormais une position, une cible et un FOV. L’exposition ACES a été ramenée de `1.08` à `0.82`, l’intensité d’environnement à `0.58` et les lumières d’appoint ont été réduites.

Résultat contrôlé :

- `after-00-exterior.png` : l’extérieur reste vide ; l’exposition seule n’était pas la cause.
- `after-07-final.png` : la première nouvelle position finale intersectait une feuille de palmier procédurale.
- `after-00-exterior-v3.png` : la caméra évite le ciel vide mais ne trouve qu’un mur plein, faute de façade modélisée.
- `after-07-final-v3.png` : la collision est supprimée, mais le cadrage ne trouve encore que ciel/sol et un panneau vitré, faute de composition extérieure exploitable.
- `mobile-390.png` : l’interface reste utilisable à 390 px, mais la scène présente les mêmes défauts structurels.

Conclusion : aucune nouvelle itération de coordonnées ne peut créer les surfaces, pièces et objets absents du GLB. La prochaine étape légitime est l’acquisition ou la production des assets répertoriés dans `ASSETS_3D_REQUIRED.md`, puis la reconstruction du path sur le modèle final.

## Look development — itération avec assets réels

### Défaut caméra critique corrigé

Le rig interpolait précédemment vers le quaternion d’un `Object3D`. Un objet Three.js oriente son axe +Z vers sa cible, tandis qu’une caméra regarde sur son axe −Z. La caméra regardait donc systématiquement à l’opposé des targets configurées. Le rig utilise maintenant une caméra de référence pour produire le quaternion de visée correct.

Effets vérifiés dans le navigateur :

- le salon est visible au lieu d’un mur arrière ;
- la caméra traverse l’intérieur dans le bon sens ;
- la terrasse finale est cadrée au lieu d’afficher uniquement le ciel ;
- chambre, couloir, salle de bain, escalier et salon secondaire disposent de points de passage dédiés ;
- les checkpoints évitent désormais l’arrière de la tête de lit, la baignoire en très gros plan et le garde-corps.

### Assets intégrés

| Asset | Source | Géométrie source | Textures actives | Poids GLB | Statut visuel |
| --- | --- | ---: | ---: | ---: | --- |
| Modern Arm Chair 01 | Poly Haven CC0 | 8 916 triangles | 6 maps 1K embarquées ; couleur textile remplacée par taupe, normal/roughness conservées | 2,6 Mo | Actif, plusieurs placements |
| Modern Ceiling Lamp 01 | Poly Haven CC0 | 5 602 triangles | 3 maps 1K embarquées ; globe converti en matériau physique/émissif | 424 Ko | Actif |
| Calathea Orbifolia 01 | Poly Haven CC0 | 16 688 triangles | 3 maps 1K embarquées | 1,8 Mo | Actif, placements réduits sur mobile |
| Potted Plant 01 | Poly Haven CC0 | 96 030 triangles | 6 maps 1K + alpha 1K | 6,0 Mo + 72 Ko | Importé mais retiré du rendu actif : silhouette non conforme |

Le modèle architectural reste à 240 Ko. Le budget GLB actif ajouté est d’environ 4,8 Mo ; les instances réutilisent les mêmes géométries et textures en mémoire.

### Nettoyage du prototype

Les palmiers coniques, les suspensions sphériques et les fauteuils de substitution visibles ont été masqués au runtime. Le chargeur GLTF normalisant les noms et ajoutant des suffixes aux doublons, le filtre cible les préfixes normalisés. Les deux canapés simplifiés de la terrasse finale ont aussi été retirés et remplacés par quatre fauteuils GLB détaillés autour de la table.

### Captures de contrôle

- `audit/screenshots/lookdev-v10-living.png`
- `audit/screenshots/lookdev-v10-final-taupe.png`
- `audit/screenshots/lookdev-v4-bedroom.png`
- `audit/screenshots/lookdev-v4-bathroom.png`
- `audit/screenshots/lookdev-v8-stairs-filtered.png`

Les séries `lookdev-v2-*` à `lookdev-v9-*` documentent les défauts intermédiaires et les corrections successives.

### Validation technique

- `npm run build` : réussi ; avertissement de chunks Three.js supérieurs à 500 Ko maintenu.
- `npm run lint` : réussi, aucune erreur.
- Navigation scroll/caméra : contrôlée dans le navigateur sur tous les checkpoints.
- Console : aucune erreur React, GLTF, texture ou WebGL sur le dernier chargement. Les avertissements de dépréciation `THREE.Clock` et `PCFSoftShadowMap` proviennent de la stack R3F/Three actuelle et restent à traiter lors d’une mise à niveau.

### Verdict actualisé

L’expérience est fonctionnellement beaucoup plus proche d’une visite : le scroll déplace une vraie caméra dans des espaces désormais cadrés et des assets détaillés commencent à remplacer les placeholders. Elle ne satisfait toujours pas la définition de “visualisation architecturale premium” : il manque principalement une façade exploitable, un vrai modèle architectural intérieur, des canapés/lits/baignoire haut de gamme, un paysage/horizon et une lumière intérieure baked ou équivalente.

## Façade réelle — intégration du modèle fourni

Le fichier utilisateur `modern_coastal_hillside_villa.glb` remplace désormais le prototype sur le premier écran. Sa façade associe pierre claire, volumes contemporains, baies vitrées, perron paysager et véhicule, ce qui reprend les caractéristiques structurantes de la référence `50ca749440c414a1384665df3ce15e73.jpg` sans utiliser cette image comme arrière-plan.

### Préparation web

- Original : 253 Mo, environ 948 000 triangles, 210 meshes, 63 matériaux et 105 textures.
- Variante desktop : `public/models/exterior/kaydan-coastal-villa-web.glb`, 17 Mo.
- Variante mobile : `public/models/exterior/kaydan-coastal-villa-mobile.glb`, 14 Mo.
- Traitement reproductible : suppression des groupes intérieurs hors champ, déduplication, textures WebP 1024 px / 512 px et compression Meshopt.
- Licence : CC BY 4.0, Visthétique ; attribution visible sur la scène et documentée dans `public/models/LICENSES.md`.

### Caméra validée

Le début de la visite suit maintenant quatre états continus : vue d’ensemble de la façade, approche par l’allée, cadrage du perron, puis passage au hall intérieur. Les végétaux de premier plan qui provoquaient du clipping ont été masqués uniquement sur cette variante d’introduction. Le scroll continue de piloter la position, la cible et le FOV de la caméra WebGL.

Captures finales :

- `audit/screenshots/00-exterior-reference-view.png`
- `audit/screenshots/00-exterior-approach-final.png`
- `audit/screenshots/01-front-steps-final.png`
- `audit/screenshots/02-interior-handoff-final.png`

La console ne contient aucune erreur React, GLB, réseau ou WebGL. Les avertissements `THREE.Clock` et `PCFSoftShadowMap` sont des dépréciations provenant des versions actuelles de Three.js/R3F.
