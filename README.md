# Mission : association

Vidéo en motion design (1920×1080, 30 i/s, 1 min 27) qui présente l'offre d'emploi
**Avocat(e) associé(e) salarié(e)** de *Victimes & Préjudices Avocats* à la manière
de *Mission Impossible* : mèche allumée, message chiffré, dossier d'agent et compte à rebours…
mais ce message-là ne s'autodétruit pas : le cabinet répond à chaque candidature.

**Vidéo finale :** [`output/mission-association.mp4`](output/mission-association.mp4)

## Déroulé

Le montage est calé sur la musique (140 BPM) : chaque scène commence sur un temps fort.

| Temps | Scène | Contenu de l'offre |
|---|---|---|
| 0:00 | Mise à feu | La mèche traverse l'écran pendant l'intro, « Victimes & Préjudices Avocats présente » |
| 0:07 | Transmission | Canal sécurisé, déchiffrement… « Bonjour, Maître. » |
| 0:14 | 01 · Le cabinet | Sur le « drop » : cabinet dédié aux victimes, Grenoble et Annecy sur une carte des Alpes, 5 domaines |
| 0:24 | Votre mission | « Votre mission, si vous l'acceptez… » → impact du titre Avocat(e) associé(e) salarié(e), perspective rapide d'association |
| 0:35 | 02 · Vos missions | Les 8 missions, chacune en plein écran puis rangée dans la grille (une toutes les 3 pulsations) |
| 0:48 | 03 · Profil | Fiche agent (CAPA, 5 ans, spécialisation), compétences, qualités, tampon « Recherché(e) » |
| 0:59 | Candidater | CV + lettre de motivation → recrutement@victimesetprejudices.fr |
| 1:04 | Compte à rebours | « Ce message s'autodétruira dans 5… 1 » — à zéro, la mèche s'éteint, la phrase est barrée puis corrigée : « Ce message ne s'autodétruira pas. » et « Nous répondons à chaque candidature. » |
| 1:14 | Signature | Ouverture en iris sur la carte finale : « Mission acceptée ? », adresse, citation d'Hervé Gerbi |

Charte respectée : couleurs du site (ardoise, rouge, orange, vert, crème), polices
Poppins et Open Sans uniquement, logo d'origine.

## Musique

`assets/spy-agent-mission-music.mp3` (sound4stock, « Spy Agent Mission Music »), utilisée
en entier sans coupe. Repères mesurés : 140 BPM, montée jusqu'au « drop » à 14,44 s,
phrases de 8 mesures (28,15 · 41,87 · 55,58 · 69,29 s), dernier accent à 82,37 s.
La musique est décalée de 30 ms dans le mixage pour que ses attaques tombent exactement
sur la grille de la chronologie.
Vérifiez que la licence du morceau couvre l'usage prévu (site, réseaux sociaux).

## Fabrication

Tout est généré par du code, sans logiciel de montage :

- `video/` — l'animation en HTML/CSS/JS. Chaque image est calculée à partir du temps
  (`window.seek(t)`), ce qui rend le rendu parfaitement reproductible.
  - `timeline.js` — chronologie partagée par l'image et le son (scènes, impacts, mèches…)
  - `scenes.js` — le scénario et les animations de chaque scène
  - `fx.js` — effets au canvas : mèches et étincelles, fumée, glitchs, flashs
- `scripts/soundtrack.py` — mixage : la musique, plus des bruitages synthétisés (mèche,
  frappe, impacts, tic-tac, extinction de la mèche) calés sur la chronologie ; sonie −14 LUFS
- `scripts/render.mjs` — capture image par image avec Chromium (Playwright) et encodage
  H.264/AAC avec ffmpeg

### Régénérer la vidéo

Prérequis : Node 18+, Python 3 avec `numpy` et `scipy`, ffmpeg, et Chromium pour Playwright
(`npx playwright install chromium` après `npm install`).

```bash
npm install
python3 scripts/soundtrack.py          # → output/soundtrack.wav
node scripts/render.mjs                # → output/mission-association.mp4
```

Options utiles :

```bash
node scripts/render.mjs --stills=22.6,48.5     # captures PNG dans output/stills/
node scripts/render.mjs --from=64 --to=76      # extrait → output/extrait-64-76.mp4
```

### Aperçu dans le navigateur

Servir le dossier puis ouvrir `video/index.html` (clic ou Espace pour lancer,
flèches pour avancer ou reculer de 2 s, `?t=42` pour démarrer à 42 s) :

```bash
npx serve .
```

Pour modifier un texte, éditer `video/index.html`. Pour un texte tapé à la machine
(lignes du terminal, « Bonjour, Maître. », « Votre mission, », « Vous ? », l'adresse e-mail,
textes du bandeau), mettre aussi à jour son nombre de caractères dans `video/timeline.js`
(rubrique `type`) : il règle la frappe et les bruits de clavier, et la console signale
tout écart. Le libellé « annulée » du bandeau se trouve dans `video/scenes.js`.

Pour un minutage, éditer `video/timeline.js` : l'image et les bruitages suivent. Garder les
repères sur la grille de la musique : temps n = 0,7228 + n × 0,42857 s.
