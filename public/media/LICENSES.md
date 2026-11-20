# Médias de la visite

| Fichier servi | Source | Préparation |
| --- | --- | --- |
| `kaydan-presentation.mp4` (20 Mo) | « Video presentation KAYDAN.mp4 », film de présentation fourni par Kaydan (1280 × 720, 56 Mo) | H.264 768 × 432, 25 i/s, ~420 kb/s, image clé toutes les 2 s, son AAC 80 kb/s normalisé à −18 LUFS, `faststart` |
| `kaydan-presentation-poster.webp` (19 Ko) | image du même film à 40 s | affichée sur l'écran tant que le salon n'a pas été visité |

Le film est joué sur la télévision du salon (`src/experience/Television.tsx`),
à partir de 40 s. Il n'est téléchargé qu'à l'entrée dans le salon, et seulement
à partir de l'endroit lu : les 40 premières secondes ne sont jamais chargées.

Droits : contenu propre à Kaydan (dirigeants et chantiers filmés). À confirmer
par Kaydan que sa diffusion publique sur le site est validée.
