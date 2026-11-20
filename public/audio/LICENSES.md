# Audio de la visite

La musique et le film de la télévision sont des fichiers. Tout le reste du
paysage sonore — vent, feuillages, oiseaux, envol, insectes nocturnes, fond de
pièce, eau de la piscine — est synthétisé dans le navigateur par
`src/experience/audio/engine.ts` : aucun enregistrement, aucune licence à suivre.
Le son de la télévision du salon est celui du film de présentation Kaydan
(`public/media/`, voir son propre fichier de licences).

| Fichier servi | Source | Préparation |
| --- | --- | --- |
| `music-day.mp3` (1,4 Mo) | `desifreemusic-luxury-cinematic-background-music-584147.mp3`, fourni par Kaydan | boucle de 96 s, fondu de raccord de 6 s, normalisée à −17 LUFS, MP3 112 kb/s |
| `music-night.mp3` (1,2 Mo) | `atlasaudio-ambient-cinematic-510518.mp3`, fourni par Kaydan | boucle de 88 s, même traitement |

D'après le nom des fichiers, les deux morceaux proviennent de Pixabay
(auteurs « DesiFreeMusic » et « AtlasAudio »), dont la licence de contenu
autorise l'usage commercial sans attribution. **À confirmer par Kaydan avant
mise en ligne** : la licence n'a pas été vérifiée ici.

Chaque fichier contient 0,4 s de la fin de sa propre boucle avant le début et
0,4 s de son début après la fin : les points de bouclage (0,4 s → 0,4 s +
durée) tombent ainsi à l'intérieur du son, quel que soit le remplissage que le
décodeur MP3 ajoute.
