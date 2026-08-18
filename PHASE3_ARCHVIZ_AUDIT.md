# KAYDAN Customer Care — audit Archviz Phase 3

Date de validation : 16 août 2026

## Verdict

Le pipeline Blender → GLB → optimisation → React Three Fiber est désormais
réel, reproductible et utilisé par défaut sur `/`. Le travelling reste un seul
Canvas et les routes/API existantes n'ont pas été modifiées.

Le seuil visuel demandé (`REALISM >= 8` et `IMMERSION >= 8`) n'est toutefois
pas atteint. L'amélioration est nette par rapport au GLB procédural de 239 Ko,
mais la géométrie source ne contient pas de chambre ni de salle de bain reliées
au parcours et plusieurs props, notamment les transats, restent en dessous du
niveau V-Ray/Corona attendu. Ce document ne présente donc pas la Phase 3 comme
une validation photoréaliste finale.

## Source de production

- Blender : 5.2.0 LTS.
- Fichier maître : `blender/kaydan-villa-production.blend`.
- Fichier avec bakes de contrôle : `blender/kaydan-villa-baked.blend`.
- Script maître : `blender/scripts/build_kaydan_production.py`.
- Villa détaillée importée : `public/models/modern_coastal_hillside_villa.glb`.
- Sofa premium extrait de `public/models/simple_modern_living_room.glb`.
- Caméras calculées depuis `src/experience/CameraPath.ts` afin que Blender et
  le navigateur partagent la même chorégraphie.

## Organisation Blender

Treize collections sont produites :

`ARCHITECTURE`, `EXTERIOR`, `TERRACE`, `LIVING_ROOM`, `BEDROOM`, `BATHROOM`,
`STAIRS`, `SECOND_LIVING`, `CUSTOMER_CARE`, `FURNITURE`, `VEGETATION`,
`LIGHTING`, `DECORATION`.

Le fichier contient 283 objets et 103 meshes statiques préparés avec un second
canal UV nommé `LIGHTMAP_UV`. Les collections `BEDROOM` et `BATHROOM` existent
dans la structure de production, mais la villa source ne fournit pas encore de
pièces connectées crédibles à y classer.

## Exports et poids

| Artefact | Taille |
| --- | ---: |
| GLB procédural historique | 244 816 octets (~239 Ko) |
| Source villa détaillée | 265 801 384 octets |
| GLB de production Blender | 71 913 144 octets |
| GLB web optimisé | 24 356 224 octets |
| GLB mobile optimisé | 20 222 184 octets |
| Fichier Blender maître | 59 650 925 octets |
| Fichier Blender avec bakes | 57 564 086 octets |

Le GLB web contient 269 nœuds, 141 meshes, 58 matériaux et 93 textures. Le GLB
mobile conserve la même structure mais réduit les images.

## Textures et résolutions

- Web : 82 textures 1024×1024, 1 texture 1024×512, 6 textures 512×256 ou
  512×512, 1 texture 256×512 et 3 textures 256×256.
- Mobile : 84 textures 512×512, 6 textures 512×256 ou 256×512 et 3 textures
  256×256.
- Images embarquées : environ 5,74 Mo sur web et 1,60 Mo sur mobile.
- Lightmaps de contrôle : 6 PNG 1024×1024 pour le terrain, le mur pierre,
  l'enduit, le béton, le chemin et le travertin.

Les lightmaps sont générées avec Cycles en direct + indirect et UV2. À 24
échantillons, elles restent trop bruitées pour la production : elles sont
livrées avec `public/assets/lightmaps/manifest.json`, mais volontairement non
branchées dans Three.js. Les activer aurait figé du bruit et réduit la qualité.

## Look development

Matériaux Blender revus :

- enduit ivoire PBR ;
- travertin / pierre claire PBR ;
- bois chaud PBR ;
- conservation des murs pierre et chemins source lorsque leur remplacement
  dégradait le rendu ;
- réglages temps réel du verre (transmission, épaisseur, IOR, rugosité), de
  l'eau, de la végétation et des textiles ;
- retrait des masses végétales noires et des fauteuils mal positionnés.

Éclairage : HDRI `blouberg-sunrise-1-1k.hdr`, soleil directionnel chaud,
hemisphere light, quatre sources intérieures, ombres 2048 sur desktop et 512
sur mobile, tone mapping ACES et adaptation d'exposition extérieur/intérieur.

## Assets et licences

- Villa : Visthétique, CC BY 4.0.
- Simple Modern Living Room / sofa : dylanheyes, CC BY 4.0.
- Potted Plant, Calathea Orbifolia, Modern Ceiling Lamp et HDRI Blouberg
  Sunrise : Poly Haven, CC0.
- Matériaux PBR : sources et licences documentées dans
  `public/assets/materials/LICENSES.md`.
- Modèles : attributions documentées dans `public/models/LICENSES.md`.

## Caméra

Le rail est une paire de splines `CatmullRomCurve3` : position et cible. Le
scroll pilote une progression normalisée avec timing cinématique non linéaire,
damping position/quaternion, FOV 48–52° sur desktop, micro-sway et parallax
souris subtil.

Corrections Phase 3 :

- maintien de l'approche avant les contremarches à 20 % ;
- franchissement continu de l'entrée ;
- ralentissement dans les espaces intérieurs ;
- passage du couloir sans téléportation ;
- maintien de la caméra au-dessus de la plage de piscine à 70–80 % ;
- travelling final vers la terrasse.

## Rendus et checkpoints

Rendus Cycles 960×540 :

- `blender/renders/exterior.png`
- `blender/renders/entrance.png`
- `blender/renders/living.png`
- `blender/renders/bedroom.png`
- `blender/renders/bathroom.png`
- `blender/renders/second_living.png`
- `blender/renders/terrace.png`

Les noms `bedroom` et `bathroom` sont des checkpoints de rail historiques :
ils cadrent les espaces disponibles les plus proches, pas de véritables pièces
achevées. Les 11 captures WebGL finales (0 à 100 %, par pas de 10 %) sont dans
`audit/checkpoints-phase3-final/`.

## Validation

- `npm run build` : réussi.
- `npm run lint` : réussi.
- GLB production chargé par défaut ; `?legacy3d=true` conserve le filet de
  sécurité.
- Travelling testé sur 101 positions successives : un Canvas persistant, fin
  de rail atteinte, aucune erreur React, Three.js ou WebGL détectée.
- Routes `/rendez-vous`, `/visiteur`, `/reclamation`, `/suivi`, `/contact` :
  chargement réussi, aucun lien `#`, aucune régression de routage constatée.
- Test interactif réalisé à 1280 px dans le navigateur intégré.
- Variantes desktop/mobile, DPR, ombres, textures et camera path mobile sont
  présentes. La capture automatisée exacte 375/390/768/1024/1440 n'a pas pu
  être terminée, l'autorisation d'exécution Chrome ayant été refusée par la
  limite d'usage de l'environnement ; elle reste donc à valider visuellement.

## Score visuel honnête

| Critère | Score /10 |
| --- | ---: |
| Géométrie | 6.0 |
| Matériaux | 6.5 |
| Éclairage | 6.2 |
| Mobilier | 5.8 |
| Végétation | 6.3 |
| Verre | 6.2 |
| Composition | 7.0 |
| Réalisme | 6.2 |
| Immersion | 7.2 |

## Écarts bloquants vers 8/10

1. Produire ou intégrer dans Blender une vraie chambre et une vraie salle de
   bain connectées physiquement au rail.
2. Remplacer les transats, l'escalier et certains éléments de cuisine par des
   assets Archviz plus crédibles et correctement posés au sol.
3. Refaire le mobilier principal avec textiles, coutures et volumes de coussins
   de qualité subdivision.
4. Refaire les UV des grandes surfaces par ensembles architecturaux, puis
   rebaker à 128–256 échantillons avec débruitage avant branchement runtime.
5. Ajouter des menuiseries, plinthes, joints, rails et luminaires visibles dans
   les plans proches.
6. Valider les cinq largeurs demandées sur appareils/GPU réels et mesurer les
   FPS, plutôt que d'annoncer un chiffre non mesuré.

La prochaine étape n'est plus un réglage React : c'est une passe de production
d'assets Blender ciblée sur les espaces et props manquants.
