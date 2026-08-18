# Assets 3D requis — KAYDAN Villa

Le modèle procédural actuel reste uniquement un prototype spatial. Aucun asset manquant ne doit être remplacé silencieusement par une primitive.

Licences acceptables : CC0, licence commerciale explicite avec redistribution dans un build web, ou asset produit spécifiquement pour KAYDAN. Les assets avec licence éditoriale, non commerciale ou ambiguë sont refusés.

## État d’acquisition

- Acquis et intégré : fauteuil contemporain, suspension minimaliste, Calathea tropicale — Poly Haven CC0, GLB autonomes avec textures 1K.
- Acquis mais rejeté du rendu : plante en pot Poly Haven, silhouette insuffisamment naturelle pour les plans caméra.
- Toujours bloquants : architecture complète/façade, canapé modulaire premium, chambre, salle de bain, escalier détaillé, cuisine/bar, mobilier outdoor et paysage.
- Les recherches ont identifié des sofas Sketchfab sous CC Attribution, mais leur téléchargement nécessite une authentification et aucune intégration n’a été effectuée sans accès/licence récupérable de façon reproductible.

| Asset nécessaire | Format recommandé | Budget approximatif | Textures nécessaires | Résolution | Licence acceptable | Emplacement prévu | Mots-clés de recherche |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| Villa contemporaine complète, architecture ouverte | GLB 2.0, objets nommés et séparés par pièce | 180k–350k triangles | BaseColor, Normal, Roughness, AO ; lightmap UV2 si baked | 2K surfaces majeures, 1K secondaires | CC0/commerciale explicite/sur mesure | `public/models/villa/kaydan-villa-architecture.glb` | `modern luxury villa archviz glb interior exterior open plan` |
| Façade, baies et menuiseries aluminium | GLB modulaire | 30k–70k | Métal, verre, joints, normal/roughness | 1K–2K | idem | `public/models/villa/glazing-and-frames.glb` | `architectural sliding glass doors aluminium frames glb` |
| Terrasse et pergola bois/béton | GLB modulaire | 25k–60k | Bois extérieur, béton, métal, AO | 1K–2K | idem | `public/models/villa/terrace-pergola.glb` | `luxury villa pergola wood slats terrace glb` |
| Salon principal premium complet | GLB séparé par meuble | 120k–220k | Tissu, cuir, bois, métal, rug ; normal/roughness/AO | 2K canapé/tapis, 1K accessoires | idem | `public/models/furniture/main-living-room.glb` | `archviz deep modular sofa lounge furniture glb` |
| Salon secondaire / espace rencontre | GLB séparé par meuble | 80k–160k | Textile, bois massif, métal, rug | 2K héros, 1K reste | idem | `public/models/furniture/meeting-lounge.glb` | `luxury lounge armchair solid wood coffee table glb` |
| Mobilier terrasse lounge tressé | GLB avec LOD | 80k–150k | Tressage, tissu outdoor, bois, métal | 2K héros, 1K LOD | idem | `public/models/furniture/outdoor-lounge.glb` | `woven outdoor lounge chair luxury patio glb` |
| Chambre king size complète | GLB séparé lit/accessoires | 100k–190k | Draps, coussins, tissu, bois, tapis | 2K lit, 1K accessoires | idem | `public/models/furniture/bedroom-suite.glb` | `luxury king bed realistic bedding pillows archviz glb` |
| Salle de bain complète | GLB séparé baignoire/robinetterie/miroir | 70k–140k | Céramique, pierre, chrome, verre, roughness | 1K–2K | idem | `public/models/furniture/bathroom-suite.glb` | `freestanding bathtub faucet bathroom archviz glb` |
| Hall et escalier double hauteur | GLB modulaire | 50k–110k | Pierre, plâtre, verre, métal, bois | 2K architecture, 1K métal/verre | idem | `public/models/villa/stair-hall.glb` | `modern floating staircase glass railing archviz glb` |
| Cuisine et bar premium | GLB séparé modules/tabourets | 100k–180k | Bois, pierre, métal, façade laquée | 2K îlot, 1K modules | idem | `public/models/furniture/kitchen-bar.glb` | `luxury modern kitchen island bar stools archviz glb` |
| Rideaux et voilages | GLB avec géométrie de plis | 25k–60k | Opacity/transmission, normal, roughness | 1K–2K | idem | `public/models/decor/curtains.glb` | `sheer curtains realistic folds glb archviz` |
| Luminaires intérieurs | GLB + meshes émissifs distincts | 30k–80k total | Métal, verre, emission | 1K | idem | `public/models/lighting/architectural-lights.glb` | `designer pendant lamp recessed linear light glb` |
| Décoration et accessoires | GLB groupé avec variantes | 50k–120k total | Céramique, livres, art, métal, bois | 512–1K | idem | `public/models/decor/interior-accessories.glb` | `archviz interior decor books vase sculpture glb` |
| Végétation tropicale/méditerranéenne | GLB avec LOD et feuilles alpha | 80k–180k visibles, instanciés | BaseColor, Normal, Roughness, Alpha | 1K–2K atlas | idem | `public/models/vegetation/tropical-pack.glb` | `tropical mediterranean plants optimized glb LOD` |
| Paysage et horizon côtier | GLB léger + HDRI distinct pour lumière | 40k–100k | Sol, rochers, végétation distante | 1K–2K | idem | `public/models/environment/coastal-context.glb` | `mediterranean coastal landscape optimized glb` |

## Contraintes d’intégration

- Fournir une échelle réelle en mètres et des pivots cohérents.
- Séparer architecture, mobilier, végétation et luminaires pour le chargement progressif.
- Prévoir UV0 pour les matériaux et UV1/UV2 pour AO ou lightmaps.
- Éviter les textures embarquées en doublon ; centraliser les maps partagées.
- Produire une version desktop et des LOD mobile avant l’intégration finale.
- Optimiser avec Meshopt ou Draco après validation visuelle, puis KTX2/Basis pour les textures compatibles.
- Conserver les fichiers sources Blender dans un dépôt d’assets ou stockage versionné distinct ; le frontend ne reçoit que les GLB optimisés et leurs licences.
