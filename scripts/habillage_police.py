"""Habillage sonore (bruitages, sans musique) de « La police, sujet de débat ? ».

Tous les effets sont synthétisés (numpy/scipy), donc libres de droits. Les fichiers produits ont
EXACTEMENT le même nombre d'échantillons que la voix d'origine : ils se recalent à l'image près.
Les effets ponctuels tombent dans les respirations du texte ; les ambiances (foule, rue) sont
baissées automatiquement quand la voix parle.

    python3 scripts/habillage_police.py chemin/voix.mp3 dossier_sortie

Sorties :
  La_police_habillage_mix.wav   voix + bruitages, prêt à réimporter
  La_police_habillage_mix.mp3   idem en MP3 (écoute rapide seulement)
  La_police_effets_seuls.wav    bruitages seuls, à caler à 0:00 sous la voix
  La_police_reperes.csv         liste des effets avec leur temps (marqueurs de montage)
"""
import csv
import pathlib
import subprocess
import sys

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

tmp = out / "_voix.wav"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
                "-c:a", "pcm_f32le", str(tmp)], check=True)
voice, SR = sf.read(tmp, dtype="float64")
tmp.unlink()
if voice.ndim == 1:
    voice = np.stack([voice, voice], axis=1)
N = len(voice)
DUR = N / SR
rng = np.random.default_rng(1789)

hits = np.zeros((N, 2))   # effets ponctuels (dans les respirations, non baissés)
beds = np.zeros((N, 2))   # ambiances (baissées sous la voix)
verb_send = np.zeros((N, 2))
reperes = []


# ———————————————————— outils ————————————————————
def tarr(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def filt(x, kind, f, order=2):
    wn = [f[0] / (SR / 2), f[1] / (SR / 2)] if kind == "band" else f / (SR / 2)
    return signal.sosfilt(signal.butter(order, wn, btype=kind, output="sos"), x, axis=0)


def env(d, a=0.005, r=0.05):
    n = int(d * SR)
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def norm(x):
    return x / (np.abs(x).max() + 1e-12)


def place(sig, t, gain, pan=0.0, verb=0.0, bus="hit", nom=None):
    """Pose un son mono (panoramique) ou stéréo à l'instant t. gain en dB par rapport à 0 dBFS crête."""
    b = hits if bus == "hit" else beds
    i = int(round(t * SR))
    if i >= N:
        return
    sig = sig[: N - i]
    if sig.ndim == 1:
        th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(th), sig * np.sin(th)], axis=1) * np.sqrt(2)
    g = 10 ** (gain / 20)
    b[i: i + len(sig)] += sig * g
    if verb:
        verb_send[i: i + len(sig)] += sig * g * verb
    if nom:
        reperes.append((t, nom))


def sweep_noise(d, f0, f1, q=0.5, blocks=40):
    """Bruit filtré passe-bande dont la fréquence centrale glisse de f0 à f1."""
    nz = noise(d + 0.1)
    n = int(d * SR)
    y = np.zeros(n)
    edges = np.linspace(0, n, blocks + 1).astype(int)
    for k in range(blocks):
        fc = f0 * (f1 / f0) ** (k / (blocks - 1))
        lo, hi = max(fc * (1 - q), 30), min(fc * (1 + q), SR / 2 - 100)
        a, b = edges[k], edges[k + 1]
        seg = filt(nz[max(a - 800, 0): b], "band", (lo, hi))
        y[a:b] = seg[-(b - a):]
    return y


def resonances(d, modes, damp):
    """Somme de modes (fréquence, amplitude) amortis : métal, verre…"""
    t = tarr(d)
    return sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / (damp * 1000 / f) ** 0.5 / 4)
               for f, a in modes)


# ———————————————————— banque d'effets ————————————————————
def whoosh(d=0.8, f0=300, f1=3000, pan_move=True):
    x = sweep_noise(d, f0, f1, 0.6)
    t = tarr(d)
    e = np.sin(np.pi * t / d) ** 2
    x = norm(x * e)
    if pan_move:
        p = np.linspace(-0.8, 0.8, len(x))
        th = (p + 1) * np.pi / 4
        return np.stack([x * np.cos(th), x * np.sin(th)], axis=1) * np.sqrt(2)
    return x


def impact(d=2.5, f0=80, f1=38, body=0.6):
    """Coup sourd de bande-annonce : sub qui descend + claquement filtré."""
    t = tarr(d)
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / 0.12)) / SR
    sub = np.sin(ph) * np.exp(-t / 0.7)
    crack = filt(noise(d), "band", (150, 2500)) * np.exp(-t / 0.05)
    return norm((sub + body * norm(crack)) * env(d, 0.001, 0.3))


def siren(d=6.0, approach=True, dist=1.0):
    """Deux-tons français (« pin-pon ») qui passe : effet Doppler, distance, panoramique."""
    t = tarr(d)
    base = np.where((t % 1.1) < 0.55, 435.0, 580.0)
    base = filt(base, "low", 18, 1)
    # vitesse radiale : s'approche puis s'éloigne
    u = (t - d * 0.5) / (d * 0.22)
    doppler = 1 + 0.035 * (-np.tanh(u)) if approach else np.ones_like(t)
    f = base * doppler
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = 0.7 * signal.sawtooth(ph, 0.5) + 0.3 * signal.square(ph)
    proximity = 1 / (1 + u ** 2)  # 1 au passage
    x = filt(x, "band", (300, 3500))
    far = filt(x, "low", 900)
    x = (far * (1 - proximity) + x * proximity) * (0.25 + 0.75 * proximity) / dist
    x *= env(d, 0.8, 1.2)
    p = np.tanh(u) * 0.8
    th = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(th), x * np.sin(th)], axis=1) * np.sqrt(2) / np.abs(x).max()


def rue(d):
    """Ambiance de ville : grondement de circulation lointain."""
    x = filt(noise(d), "low", 400) + 0.2 * filt(noise(d), "band", (600, 2500))
    t = tarr(d)
    mod = 0.7 + 0.3 * np.sin(2 * np.pi * 0.11 * t + 1) * np.sin(2 * np.pi * 0.07 * t)
    l = norm(x * mod)
    r = norm(np.roll(l, int(0.013 * SR)) * 0.9 + 0.1 * filt(noise(d), "low", 400))
    return np.stack([l, r], axis=1) * env(d, 1.0, 1.5)[:, None]


def radio(d_static=0.35, beep=True):
    """Radio police : souffle d'ouverture, « bip » de fin de transmission."""
    s = filt(noise(d_static), "band", (400, 3200), 4) * env(d_static, 0.003, 0.04)
    s = np.tanh(3 * s / np.abs(s).max())
    parts = [norm(s) * 0.8]
    if beep:
        t = tarr(0.14)
        b = np.sin(2 * np.pi * np.where(t < 0.07, 1200, 1600) * t) * env(0.14, 0.003, 0.01)
        parts += [np.zeros(int(0.05 * SR)), b * 0.5]
    return np.concatenate(parts)


def foule(d):
    """Rumeur de manifestation : brouhaha de voix + scansion lointaine."""
    t = tarr(d)
    x = np.zeros(len(t))
    for _ in range(36):
        f0 = rng.uniform(110, 260)
        vib = 1 + 0.08 * np.sin(2 * np.pi * rng.uniform(2, 5) * t + rng.uniform(0, 6))
        ph = 2 * np.pi * np.cumsum(f0 * vib) / SR
        v = signal.sawtooth(ph)
        syll = np.clip(np.sin(2 * np.pi * rng.uniform(2.5, 5.5) * t + rng.uniform(0, 6)), 0, 1) ** 2
        f1 = rng.uniform(500, 900)
        v = filt(v, "band", (f1 * 0.7, f1 * 1.4)) + 0.5 * filt(v, "band", (1600, 2600))
        x += v * syll * rng.uniform(0.4, 1)
    # scansion « on-est-là » : accents toutes les 0,5 s
    chant = 0.6 + 0.4 * (np.sin(2 * np.pi * 2 * t) > 0.3)
    x = filt(x * chant, "low", 2200) + 0.4 * filt(noise(d), "band", (300, 1500))
    x = norm(x)
    return np.stack([x, np.roll(x, int(0.021 * SR))], axis=1) * env(d, 1.2, 1.2)[:, None]


def sifflet(d=0.7):
    """Sifflet de maintien de l'ordre (roulement de la bille)."""
    t = tarr(d)
    f = 2900 * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))
    trill = 0.6 + 0.4 * np.sin(2 * np.pi * 38 * t)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * trill + 0.15 * filt(noise(d), "band", (2500, 3500))
    return norm(x * env(d, 0.01, 0.08))


def culasse():
    """« Clic-clac » métallique : arme manipulée."""
    def clic(d=0.12, scale=1.0):
        t = tarr(d)
        tr = filt(noise(d), "band", (1800, 7000)) * np.exp(-t / 0.004)
        ring = resonances(d, [(3100 * scale, 1), (4700 * scale, 0.7), (6900 * scale, 0.5)], 2)
        return norm(norm(tr) + 0.6 * ring * np.exp(-t / 0.03))
    gap = np.zeros(int(0.17 * SR))
    slide = norm(sweep_noise(0.09, 2500, 5000, 0.4)) * 0.4 * env(0.09, 0.01, 0.02)
    return np.concatenate([clic(), slide, gap, clic(0.15, 0.85)])


def tampon():
    """Coup de tampon sur une feuille : validation."""
    d = 0.5
    t = tarr(d)
    thud = np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.05)
    slap = filt(noise(d), "band", (700, 4500)) * np.exp(-t / 0.018)
    wood = resonances(d, [(420, 1), (980, 0.5)], 1) * np.exp(-t / 0.04)
    return norm(thud + 0.8 * norm(slap) + 0.3 * norm(wood)) * env(d, 0.0005, 0.1)


def pages(n=3):
    """Pages de code qu'on feuillette."""
    seq = []
    for _ in range(n):
        d = rng.uniform(0.22, 0.32)
        x = sweep_noise(d, 1500, 5000, 0.7, 20)
        crackle = (rng.random(int(d * SR)) < 0.004) * rng.standard_normal(int(d * SR)) * 3
        x = (x + filt(crackle, "high", 2000)) * np.sin(np.pi * tarr(d) / d) ** 1.5
        seq += [norm(x), np.zeros(int(rng.uniform(0.05, 0.12) * SR))]
    return np.concatenate(seq)


def machine_a_ecrire(n=7, ding=True):
    seq = []
    for k in range(n):
        d = 0.06
        t = tarr(d)
        x = filt(noise(d), "band", (1200, 6000)) * np.exp(-t / 0.006)
        x += 0.5 * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.01)
        seq += [norm(x) * rng.uniform(0.6, 1), np.zeros(int(rng.uniform(0.05, 0.11) * SR))]
    if ding:
        t = tarr(1.2)
        bell = resonances(1.2, [(2350, 1), (5900, 0.4), (8700, 0.15)], 6) * np.exp(-t / 0.35)
        seq += [np.zeros(int(0.06 * SR)), norm(bell) * 0.6]
    return np.concatenate(seq)


def balance():
    """Les plateaux d'une balance qui s'équilibrent : deux tintements métalliques."""
    def tint(f, d=1.4):
        t = tarr(d)
        return norm(resonances(d, [(f, 1), (f * 2.76, 0.4), (f * 5.4, 0.2)], 4) * np.exp(-t / 0.4))
    a, b = tint(1650), tint(1760)
    out_ = np.zeros(int(1.9 * SR))
    out_[: len(a)] += a
    i = int(0.38 * SR)
    out_[i: i + len(b)] += b[: len(out_) - i] * 0.8
    return out_ * env(len(out_) / SR, 0.001, 0.3)


def coeur(n=3, bpm=58):
    seq = np.zeros(int((n * 60 / bpm + 0.5) * SR))
    for k in range(n):
        for off, g in [(0, 1), (0.24, 0.6)]:
            d = 0.25
            t = tarr(d)
            b = np.sin(2 * np.pi * np.cumsum(55 + 25 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.07)
            i = int((k * 60 / bpm + off) * SR)
            seq[i: i + len(b)] += b * g
    return norm(seq)


def acouphene(d=3.0, f=5200):
    """Sifflement d'oreille, très discret : évoque le choc (l'histoire de Maud)."""
    t = tarr(d)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 1.004 * t)
    e = np.minimum(t / 0.05, 1) * np.exp(-t / (d / 3))
    return norm(x * e) * env(d, 0.01, 0.5)


def micro_on():
    """Mise en route d'un podcast : déclic de micro + petit carillon « à l'antenne »."""
    d = 0.08
    t = tarr(d)
    clic = filt(noise(d), "band", (800, 5000)) * np.exp(-t / 0.006) + np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.02)
    tt = tarr(1.2)
    ch = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.35) * (tt >= o) for f, o in [(880, 0), (1318.5, 0.12)])
    seq = np.zeros(int(1.4 * SR))
    seq[: len(clic)] += norm(clic)
    i = int(0.12 * SR)
    seq[i: i + len(ch)] += norm(ch)[: len(seq) - i] * 0.35
    return seq


# ———————————————————— placement (temps calés sur le SRT et les respirations) ————————————————————
# Ouverture : rue + sirène qui passe, coup sourd sous « La police »
place(rue(9.0), 0.0, -30, bus="bed", nom="Ambiance rue (jusqu'à 9 s)")
place(siren(5.5), 0.0, -29, verb=0.5, bus="bed", nom="Sirène de police qui passe (deux-tons)")
place(impact(2.5), 0.02, -15, verb=0.3, nom="Coup sourd d'ouverture")
place(whoosh(0.7, 500, 4000), 2.25, -24, nom="Transition « Si je pose la question »")

# « l'actualité parle beaucoup de la police » → radio police
place(radio(), 8.05, -22, pan=0.4, verb=0.2, nom="Radio police (souffle + bip)")

# « cette fameuse loi sur l'utilisation des armes »
place(pages(2), 9.7, -20, pan=-0.3, nom="Pages de loi feuilletées")
place(culasse(), 11.62, -19, pan=0.35, verb=0.25, nom="Arme : clic-clac de culasse")
place(impact(2.0, 70, 35, 0.3), 15.2, -18, verb=0.4, nom="Coup sourd « le permis de tuer »")

# maintien de l'ordre, manifestations des lycéens
place(foule(6.5), 16.4, -24, verb=0.4, bus="bed", nom="Rumeur de manifestation (16,4 → 22,9 s)")
place(sifflet(0.45), 18.78, -27, pan=-0.6, verb=0.6, nom="Sifflet")
place(sifflet(0.8), 20.52, -25, pan=0.5, verb=0.6, nom="Sifflet")
place(radio(0.25, beep=False), 22.62, -25, pan=-0.4, nom="Radio police")

# « Tout cela est codifié dans le code de la sécurité intérieure »
place(whoosh(0.5, 800, 5000), 25.45, -26, nom="Transition")
place(machine_a_ecrire(6), 28.75, -20, pan=0.3, verb=0.2, nom="Machine à écrire + « ding »")
place(pages(2), 33.0, -22, pan=-0.3, nom="Pages")

# Les trois critères : un coup de tampon chacun, dans le silence juste avant
for tc, nom in [(37.0, "Tampon : 1er critère, nécessité"),
                (44.2, "Tampon : 2e critère, proportionnalité"),
                (54.4, "Tampon : 3e critère, discernement")]:
    place(whoosh(0.35, 1500, 6000, False), tc - 0.3, -30)
    place(tampon(), tc, -16, verb=0.25, nom=nom)
place(balance(), 48.2, -26, verb=0.4, nom="Balance qui s'équilibre (proportionnalité)")
place(radio(), 57.72, -26, pan=0.4, nom="Radio police (« les policiers, les gendarmes »)")

# « Donc, vous le voyez, tout cela est extrêmement codifié »
place(whoosh(0.6, 400, 3500), 65.6, -25, nom="Transition « Donc, vous le voyez »")
place(tampon(), 68.95, -17, verb=0.2, nom="Tampon « codifié »")

# « Il n'empêche que parfois… des erreurs… graves »
place(impact(3.0, 60, 32, 0.2), 77.75, -19, verb=0.5, nom="Bascule sombre « Il n'empêche que parfois »")
place(coeur(4), 79.0, -24, nom="Battements de cœur")
place(impact(2.0, 55, 30, 0.15), 85.35, -20, verb=0.5, nom="Coup grave « qui sont graves »")

# Le podcast, l'histoire de Maud
place(micro_on(), 86.0, -24, verb=0.3, nom="Déclic micro + carillon (podcast)")
place(acouphene(3.2), 92.0, -33, nom="Sifflement d'oreille, très discret (Maud perd un œil)")

# « Alors, la police, on en débat ? »
place(siren(4.0), 94.75, -24, verb=0.6, bus="bed", nom="Sirène lointaine")
place(whoosh(0.9, 300, 4500), 94.9, -24, nom="Transition finale")
place(impact(1.2, 75, 40, 0.5), 98.24, -16, verb=0.4, nom="Coup final sur « débat ? »")

# ———————————————————— réverbération (IR synthétique) ————————————————————
ir_len = int(1.8 * SR)
tir = np.arange(ir_len) / SR
ir = rng.standard_normal((ir_len, 2)) * np.exp(-tir / 0.4)[:, None]
ir = filt(ir, "low", 6000)
ir[: int(0.015 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([signal.fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)

# ———————————————————— ducking des ambiances sous la voix ————————————————————
hop = int(0.01 * SR)
nb = int(np.ceil(N / hop))
vm = np.abs(voice.mean(axis=1))
lvl = 20 * np.log10(np.array([vm[i * hop:(i + 1) * hop].max(initial=0) for i in range(nb)]) + 1e-9)
sp = np.concatenate([(lvl > -40).astype(float)[4:], np.zeros(4)])  # anticipation 40 ms
g = np.zeros(nb)
acc = 0.0
for i in range(nb):
    c = np.exp(-1 / 5) if sp[i] > acc else np.exp(-1 / 40)
    acc = c * acc + (1 - c) * sp[i]
    g[i] = acc
duck = 10 ** (np.interp(np.arange(N), np.arange(nb) * hop + hop / 2, -8.0 * g) / 20)

fx = hits + beds * duck[:, None] + wet * 0.3
fx = filt(fx, "high", 30)
fo = int(0.4 * SR)
fx[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2

# ———————————————————— mixage ————————————————————
v = filt(voice, "high", 70)  # seul traitement de la voix : coupe les graves parasites
mix = v + fx


def limiter(x, ceiling=10 ** (-1.0 / 20), look=0.005, release=0.08):
    """Limiteur à anticipation, sans décalage temporel."""
    need = np.minimum(1.0, ceiling / np.maximum(np.abs(x).max(axis=1), 1e-12))
    need = minimum_filter1d(need, size=2 * int(look * SR) + 1, mode="nearest")
    r = np.exp(-1 / (release * SR))
    gg = np.empty_like(need)
    a = 1.0
    for i in range(len(need)):
        a = need[i] if need[i] < a else r * a + (1 - r) * need[i]
        gg[i] = a
    return x * gg[:, None]


def lufs(x):
    p = out / "_probe.wav"
    sf.write(p, x, SR, subtype="FLOAT")
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(p), "-af", "ebur128",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    p.unlink()
    return float(r.split("Integrated loudness:")[1].split("I:")[1].split("LUFS")[0])


g_lin = 10 ** ((-16.0 - lufs(mix)) / 20)  # -16 LUFS : niveau usuel des réseaux sociaux
mix = np.clip(limiter(mix * g_lin), -0.98, 0.98)
fx_out = np.clip(limiter(fx * g_lin), -0.98, 0.98)

assert len(mix) == N and len(fx_out) == N
sf.write(out / "La_police_habillage_mix.wav", mix, SR, subtype="PCM_24")
sf.write(out / "La_police_effets_seuls.wav", fx_out, SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i",
                str(out / "La_police_habillage_mix.wav"), "-c:a", "libmp3lame", "-b:a", "320k",
                str(out / "La_police_habillage_mix.mp3")], check=True)
with open(out / "La_police_reperes.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh, delimiter=";")
    w.writerow(["temps", "secondes", "effet"])
    for t, nom in sorted(reperes):
        w.writerow([f"{int(t // 60):02d}:{t % 60:06.3f}", f"{t:.2f}", nom])
print(f"OK : {N} échantillons ({DUR:.3f} s) à {SR} Hz, {len(reperes)} effets")
