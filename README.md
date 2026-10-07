# Mission : association

Vidéo en motion design (1920×1080, 30 i/s, 1 min 22) qui présente l'offre d'emploi
**Avocat(e) associé(e) salarié(e)** de *Victimes & Préjudices Avocats* à la manière
de *Mission Impossible* : mèche allumée, message chiffré, dossier d'agent, compte à rebours
et autodestruction.

**Vidéo finale :** [`output/mission-association.mp4`](output/mission-association.mp4)

## Déroulé

| Temps | Scène | Contenu de l'offre |
|---|---|---|
| 0:00 | Mise à feu | La mèche traverse l'écran, « Victimes & Préjudices Avocats présente » |
| 0:05 | Transmission | Canal sécurisé, déchiffrement… « Bonjour, Maître. » |
| 0:11 | 01 · Le cabinet | Cabinet dédié aux victimes, Grenoble et Annecy sur une carte des Alpes, 5 domaines |
| 0:20 | Votre mission | « Votre mission, si vous l'acceptez… » → Avocat(e) associé(e) salarié(e), CDI, perspective rapide d'association |
| 0:29 | 02 · Vos missions | Les 8 missions, chacune présentée en plein écran puis rangée dans la grille |
| 0:41 | 03 · Profil | Fiche agent (CAPA, 5 ans, spécialisation), compétences, qualités, tampon « Recherché(e) » |
| 0:51 | 04 · Ce que nous offrons | Parcours vers l'association, 218 jours, PEE & PER, atouts |
| 1:00 | 05 · Protocole | Les 4 étapes du recrutement, reliées par une mèche |
| 1:05 | Candidater | CV + lettre de motivation → recrutement@victimesetprejudices.fr |
| 1:10 | Autodestruction | « Ce message s'autodétruira dans 5 secondes » |
| 1:15 | Signature | L'écran brûle et révèle la carte finale : « Mission acceptée ? », adresse, citation d'Hervé Gerbi |

Charte respectée : couleurs du site (ardoise, rouge, orange, vert, crème), polices
Poppins et Open Sans uniquement, logo d'origine.

## Fabrication

Tout est généré par du code, sans logiciel de montage :

- `video/` — l'animation en HTML/CSS/JS. Chaque image est calculée à partir du temps
  (`window.seek(t)`), ce qui rend le rendu parfaitement reproductible.
  - `timeline.js` — chronologie partagée par l'image et le son (scènes, impacts, mèches…)
  - `scenes.js` — le scénario et les animations de chaque scène
  - `fx.js` — effets au canvas : mèches et étincelles, glitchs, flashs, combustion, grain
- `scripts/soundtrack.py` — bande-son **originale** synthétisée (groove en 5/4, cuivres,
  bruitages), normalisée à −16 LUFS
- `scripts/render.mjs` — capture image par image avec Chromium (Playwright) et encodage
  H.264/AAC avec ffmpeg

### Régénérer la vidéo

Prérequis : Node 18+, Python 3 avec `numpy` et `scipy`, ffmpeg.

```bash
npm install
python3 scripts/soundtrack.py          # → output/soundtrack.wav
node scripts/render.mjs                # → output/mission-association.mp4
```

Options utiles :

```bash
node scripts/render.mjs --stills=22.6,48.5     # captures PNG dans output/stills/
node scripts/render.mjs --from=60 --to=75      # extrait
```

### Aperçu dans le navigateur

Servir le dossier puis ouvrir `video/index.html` (clic ou Espace pour lancer,
flèches pour avancer ou reculer de 2 s, `?t=42` pour démarrer à 42 s) :

```bash
npx serve .
```

Pour modifier un texte, éditer `video/index.html` ; pour un minutage, `video/timeline.js`
(l'image et le son suivent).
