"""Bande-son de « Mission : association ».

Musique : assets/spy-agent-mission-music.mp3 (140 BPM, mi mineur), utilisée en entier.
Par-dessus, des bruitages synthétisés (numpy/scipy) et calés sur video/timeline.js :
mèche, frappe, verrouillages, impacts, tic-tac du compte à rebours, extinction de la mèche,
ouverture en iris. Les bruitages restent non tonals (ou dans la gamme de mi mineur)
pour ne pas entrer en conflit avec la musique.

    python3 scripts/soundtrack.py            → output/soundtrack.wav (+ .m4a et .ogg pour l'aperçu)
"""
import json
import pathlib
import subprocess
import wave

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
TLsrc = (ROOT / "video/timeline.js").read_text(encoding="utf-8")
TL = json.loads(TLsrc[TLsrc.index("{"): TLsrc.rindex("}") + 1])

SR = 48000
DUR = TL["duration"]
N = int(round(DUR * SR))
rng = np.random.default_rng(7)

sfx = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


# ———————————————————— outils ————————————————————
def tarr(dur):
    return np.arange(int(dur * SR)) / SR


def place(bus, sig, t, gain=1.0, pan=0.0, verb=0.0):
    """Ajoute un signal mono (ou stéréo) au bus à l'instant t, panoramique à puissance constante."""
    i = int(round(t * SR))
    if i >= N or len(sig) == 0:
        return
    if i < 0:
        sig = sig[-i:]
        i = 0
    sig = sig[: N - i]
    if sig.ndim == 1:
        th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        st = np.stack([sig * np.cos(th), sig * np.sin(th)], axis=1) * np.sqrt(2)
    else:
        st = sig
    bus[i: i + len(st)] += st * gain
    if verb:
        verb_send[i: i + len(st)] += st * gain * verb


def sos(kind, f, order=2):
    if kind == "band":
        return signal.butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], btype="band", output="sos")
    return signal.butter(order, f / (SR / 2), btype=kind, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x, axis=0)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def env_exp(dur, decay, attack=0.002):
    t = tarr(dur)
    e = np.exp(-t / decay)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def fade(x, fin=0.003, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def sine(freq, n, phase=0.0):
    inc = np.broadcast_to(np.asarray(freq, float) / SR, (n,))
    return np.sin(2 * np.pi * (phase + np.cumsum(inc)))


# Notes de mi mineur pour les bips d'interface
E6, G6, A6, B6, D7, E7 = 1318.5, 1568.0, 1760.0, 1975.5, 2349.3, 2637.0


# ———————————————————— bruitages ————————————————————
def kick(vel=1.0, dur=0.5):
    t = tarr(dur)
    f = 45 + 95 * np.exp(-t / 0.035)
    s = sine(f, len(t)) * np.exp(-t / 0.22)
    click = filt(noise(dur), "high", 3000) * np.exp(-t / 0.002) * 0.25
    return fade(np.tanh(1.5 * (s + click)) * vel, 0.0005, 0.02)


def tick(vel=1.0):
    t = tarr(0.12)
    s = filt(noise(0.12), "band", (2500, 9000)) * np.exp(-t / 0.012) + sine(E6, len(t)) * np.exp(-t / 0.01) * 0.3
    return fade(s * vel, 0.0003, 0.01)


def boom(dur=2.0, f_hi=90, f_lo=32, vel=1.0):
    t = tarr(dur)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.12)
    s = sine(f, len(t)) * np.exp(-t / (dur / 3.2))
    body = filt(noise(dur), "low", 400) * np.exp(-t / 0.18) * 0.8
    return fade(np.tanh(1.3 * (s + body)) * vel, 0.001, 0.2)


def crash(dur=2.5, vel=1.0):
    t = tarr(dur)
    s = filt(noise(dur), "high", 3500) * np.exp(-t / 0.7) * np.minimum(1, t / 0.004)
    return fade(s * vel, 0.0005, 0.3)


def whoosh(dur=0.6, f0=300, f1=4000, vel=1.0):
    """Souffle filtré dont la fréquence balaie de f0 à f1 (filtre d'état variable)."""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    t = np.arange(n) / n
    g = np.tan(np.pi * np.clip(f0 * (f1 / f0) ** t, 20, SR * 0.45) / SR)
    k = 1.2
    y = np.zeros(n)
    ic1 = ic2 = 0.0
    for i in range(n):
        gi = g[i]
        a1 = 1 / (1 + gi * (gi + k))
        v1 = a1 * (ic1 + gi * (x[i] - ic2))
        v2 = ic2 + gi * v1
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        y[i] = v1
    return fade(y * np.sin(np.pi * t) ** 1.6 * vel, 0.002, 0.02)


def blip(f=E6, dur=0.06, vel=1.0, f2=None):
    t = tarr(dur)
    fr = f if f2 is None else f + (f2 - f) * np.minimum(1, t / (dur * 0.6))
    return fade(sine(fr, len(t)) * np.exp(-t / (dur / 3)) * vel, 0.002, 0.01)


def key_click(vel=1.0):
    t = tarr(0.04)
    s = filt(noise(0.04), "band", (2500, 9000)) * np.exp(-t / 0.004)
    return fade(s * vel, 0.0002, 0.005)


def crackle(dur, rate=45, vel=1.0):
    """Grésillement de mèche : souffle + crépitements aléatoires."""
    n = int(dur * SR)
    hiss = filt(rng.standard_normal(n), "band", (2500, 9000)) * 0.18
    hiss *= 0.7 + 0.3 * filt(rng.standard_normal(n), "low", 12, 1) * 4
    cr = np.zeros(n)
    for _ in range(int(dur * rate)):
        i = rng.integers(0, max(1, n - 400))
        L = int(SR * (0.0015 + 0.004 * rng.random()))
        cr[i: i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * (0.3 + rng.random())
    cr = np.tanh(filt(cr, "high", 1200) * 1.5) / 1.5  # crépitements adoucis
    return fade((hiss + cr * 0.6) * vel, 0.03, 0.08)


def fizzle(dur=0.9):
    """Mèche étouffée : le grésillement retombe, petit souffle de fumée."""
    t = tarr(dur)
    hiss = filt(noise(dur), "band", (3000, 9000)) * np.exp(-t / 0.18) * 0.6
    puff = filt(noise(dur), "low", 900) * np.exp(-t / 0.12) * np.minimum(1, t / 0.02) * 0.8
    return fade(hiss + puff, 0.001, 0.1)


def shimmer(dur=1.2, vel=1.0):
    """Scintillement non tonal (souffle aigu qui monte puis s'éteint)."""
    return fade(whoosh(dur, 3000, 12000, 1.0) * vel, 0.01, 0.2)


def bitcrush(dur=0.2, vel=1.0):
    n = int(dur * SR)
    s = rng.standard_normal(n // 60 + 1).repeat(60)[:n]
    s = np.round(s * 3) / 3
    s *= np.sin(2 * np.pi * np.cumsum(np.full(n, 90 + 400 * rng.random())) / SR) * 0.5 + 0.5
    return fade(filt(s, "band", (500, 6000)) * vel, 0.002, 0.02)


SC = TL["scenes"]

# Mise à feu (l'intro de la musique est calme : la mèche s'entend)
fi0, fi1 = TL["fuse"]["intro"]
place(sfx, filt(noise(0.18), "band", (900, 6000)) * env_exp(0.18, 0.05), fi0 - 0.12, 1.0, -0.8)
place(sfx, whoosh(0.35, 800, 5000, 0.8), fi0 - 0.1, 0.25, -0.8)
for k in range(16):
    a = fi0 + (fi1 - fi0) * k / 16
    place(sfx, crackle((fi1 - fi0) / 16 + 0.05, 55, 1.0), a, 0.9, -0.9 + 1.8 * (k + 0.5) / 16)
h0 = SC["hello"][0]
place(sfx, boom(2.0, 110, 30), h0 - 0.04, 0.6, verb=0.35)
place(sfx, crash(2.0), h0 - 0.04, 0.15, verb=0.3)

# Mèche du HUD : discrète, plus présente pendant le compte à rebours
hh0, zero = TL["fuse"]["hud"], TL["zero"]
cd0 = SC["countdown"][0]
place(sfx, crackle(cd0 - hh0, 18, 1.0), hh0, 0.04, 0.3)
place(sfx, crackle(zero - cd0, 70, 1.0), cd0, 0.35, 0.7)

# Frappe au clavier
for key, (t0, cps, nch) in TL["type"].items():
    if key.startswith("hud_"):  # textes du bandeau : frappe rapide et discrète, un clic sur trois
        for i in range(0, nch, 3):
            place(sfx, key_click(0.4), t0 + i / cps, 0.3, 0.7 if key == "hud_br" else -0.7)
        continue
    for i in range(nch):
        place(sfx, key_click(0.7 + 0.3 * rng.random()), t0 + i / cps, 0.55, rng.uniform(-0.3, 0.3))

# Barre de déchiffrement
b0, b1 = TL["bar"]
for i in range(16):
    place(sfx, blip([E6, G6, A6, B6][i % 4], 0.04), b0 + (b1 - b0) * i / 16, 0.16, 0.2)
place(sfx, blip(B6, 0.25, 1.0, E7), b1, 0.18, 0.2, verb=0.3)

# Transitions de scène : souffle + grésillement numérique
for k in ("cabinet", "reveal", "missions", "profil", "contact", "countdown"):
    place(sfx, whoosh(0.55, 400, 7000, 1.0), SC[k][0] - 0.42, 0.4, verb=0.2)
for a, b, amp in TL["glitches"]:
    place(sfx, bitcrush(b - a + 0.05, 1.0), a, 0.1 * min(amp, 1.4), rng.uniform(-0.5, 0.5))

# Cabinet : verrouillage des cibles, étiquettes
for t in TL["locks"]:
    for j in range(3):
        place(sfx, blip(B6, 0.05), t - 0.4 + j * 0.12, 0.35, 0.5)
    place(sfx, blip(E7, 0.18, 1.0, B6), t, 0.4, 0.5, verb=0.3)
for i in range(TL["tags"]["n"]):
    place(sfx, blip([E6, G6, A6, B6, D7][i], 0.07), TL["tags"]["start"] + i * TL["tags"]["step"], 0.55, -0.4)

# « Votre mission… » : montée de souffle jusqu'à l'impact du titre
slam = TL["slam"]
vm0 = TL["type"]["vm1"][0]
place(sfx, whoosh(slam - vm0 - 0.6, 200, 7000, 1.0), vm0 + 0.6, 0.25, verb=0.3)
place(sfx, boom(3.0, 120, 28, 1.0), slam, 0.75, verb=0.5)
place(sfx, crash(3.0), slam, 0.3, verb=0.4)
place(sfx, whoosh(0.3, 6000, 300, 0.9), slam - 0.28, 0.3)
place(sfx, kick(0.8, 0.4), TL["marker"], 0.3)

# Missions : chaque carte arrive en plein écran
for i in range(TL["cards"]["n"]):
    t = TL["cards"]["start"] + i * TL["cards"]["step"]
    place(sfx, whoosh(0.32, 300, 5000, 1.0), t - 0.15, 0.4, -0.3 + 0.6 * (i % 4) / 3)
    place(sfx, kick(0.6, 0.3), t + 0.05, 0.35)
    place(sfx, whoosh(0.35, 3000, 400, 0.6), t + 0.88, 0.2, -0.6 + 1.2 * (i % 4) / 3)
sw = TL["cards"]["start"] + (TL["cards"]["n"] - 1) * TL["cards"]["step"] + 1.35
place(sfx, whoosh(1.1, 500, 8000, 0.8), sw, 0.25, verb=0.3)

# Profil : scanner, coches, tampon
s0, s1 = TL["scan"]
ts = tarr(s1 - s0)
sweep = 900 + 1100 * (0.5 - 0.5 * np.cos(2 * np.pi * ts / (s1 - s0)))
place(sfx, fade(sine(sweep, len(ts)) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * ts)), 0.05, 0.1), s0, 0.035, 0.3)
for i in range(TL["skills"]["n"]):
    t = TL["skills"]["start"] + i * TL["skills"]["step"] + 0.12
    place(sfx, blip(E6, 0.06), t, 0.4, 0.4)
    place(sfx, blip(B6, 0.12), t + 0.06, 0.35, 0.4, verb=0.3)
for i in range(TL["quals"]["n"]):
    place(sfx, blip([E6, G6, A6, B6, D7, E7][i], 0.06), TL["quals"]["start"] + i * TL["quals"]["step"], 0.35, 0.4)
st = TL["stamp"]
place(sfx, boom(0.8, 150, 60, 1.0), st, 0.6, verb=0.3)
place(sfx, filt(noise(0.3), "low", 1200) * env_exp(0.3, 0.05), st, 0.55, -0.2)

# Compte à rebours : battement, tic-tac, impact à chaque chiffre
dg = TL["digits"]
step = dg[1] - dg[0]
for i, t in enumerate(dg):
    place(sfx, boom(0.9, 100, 40, 1.0), t, 0.45 + 0.06 * i, verb=0.35)
    place(sfx, kick(0.6, 0.3), t + step / 2, 0.25)
for j in range(int((zero - cd0) / (step / 2))):
    place(sfx, tick(1.0 if j % 2 == 0 else 0.6), cd0 + j * step / 2, 0.14, -0.6 if j % 2 else 0.6)

# Zéro : la mèche s'éteint, le message est corrigé, réponse positive
place(sfx, fizzle(), zero, 0.8, 0.85, verb=0.2)
place(sfx, whoosh(0.32, 2500, 7000, 0.8), zero + 0.06, 0.3, -0.2)  # trait qui barre la phrase
fix = TL["correct"]
place(sfx, whoosh(0.4, 5000, 600, 0.8), fix - 0.1, 0.3, 0.3)
place(sfx, blip(E6, 0.09), fix + 0.1, 0.25, verb=0.3)
place(sfx, blip(B6, 0.22), fix + 0.22, 0.25, verb=0.4)
place(sfx, shimmer(1.0), TL["reply"] - 0.1, 0.4, verb=0.4)

# Ouverture en iris, logo, bouton
iris0, iris1 = TL["iris"]
place(sfx, whoosh(iris1 - iris0 + 0.3, 300, 6000, 1.0), iris0 - 0.1, 0.7, verb=0.3)
place(sfx, shimmer(1.4), TL["logo"], 0.25, -0.2, verb=0.5)
place(sfx, shimmer(0.9), TL["button"], 0.2, 0.2, verb=0.5)


# ———————————————————— musique ————————————————————
def load_music(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    m = np.frombuffer(raw, "<f4").reshape(-1, 2).astype(float)
    # Décalage mesuré : sans lui, les attaques de la musique arrivent ~30 ms avant la grille de timeline.js
    off = int(round(TL["music"]["offset"] * SR))
    out = np.zeros((N, 2))
    n = min(N - off, len(m))
    out[off: off + n] = m[:n]
    return out


music = load_music(ROOT / TL["music"]["file"])
tt = np.arange(N) / SR


def gain_curve(points):
    """Courbe de gain (dB) interpolée entre des points (temps, dB)."""
    ts, db = zip(*points)
    return 10 ** (np.interp(tt, ts, db) / 20)


# Respiration de la musique : légère baisse sous « Votre mission… » (sur la mesure) puis retour plein
# juste avant l'impact ; baisse pendant le compte à rebours pour faire entendre le tic-tac, retour au zéro.
# Les remontées se terminent 20 ms avant l'attaque musicale pour ne pas l'écorner.
rv0 = SC["reveal"][0]
duck = gain_curve([
    (0, 0), (rv0, 0), (rv0 + 0.857, -3.5), (slam - 0.08, -3.5), (slam - 0.02, 0),
    (cd0, 0), (cd0 + 0.6, -4), (zero - 0.08, -4), (zero - 0.02, 0), (DUR, 0),
])
music *= duck[:, None]


# ———————————————————— mixage ————————————————————
def make_ir(sec=2.2):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (sec / 6.9))[:, None]
    ir = filt(ir, "low", 5000)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(axis=0))


ir = make_ir()
wet = np.stack([signal.fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
fx_bus = sfx + wet * 0.35
mix = music + fx_bus * 0.55

# Fondu final avec l'image
mix *= np.clip((DUR - tt) / 0.9, 0, 1)[:, None]


def loudness(x):
    """Sonie intégrée (LUFS, EBU R128) et crête vraie (dBTP) mesurées par ffmpeg."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                        "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                       input=x.astype("<f4").tobytes(), capture_output=True)
    e = r.stderr.decode()
    m = json.loads(e[e.rindex("{"): e.rindex("}") + 1])
    return float(m["input_i"]), float(m["input_tp"])


def limiter(x, ceiling_db=-2.0, look=0.004):
    """Limiteur à anticipation : réduit seulement les crêtes au-dessus du plafond."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    c = 10 ** (ceiling_db / 20)
    g = np.minimum(1.0, c / np.maximum(np.max(np.abs(x), axis=1), 1e-9))
    L = int(look * SR)
    g = uniform_filter1d(minimum_filter1d(g, 2 * L + 1), L + 1)
    return x * g[:, None]


# Sonie cible −14 LUFS (réseaux sociaux), crêtes limitées à −2 dBFS (crête vraie ≤ −1 dBTP)
i_mix, _ = loudness(mix)
mix *= 10 ** ((-14 - i_mix) / 20)
mix = limiter(mix)
i_out, tp_out = loudness(mix)

out = ROOT / "output"
out.mkdir(exist_ok=True)
final = out / "soundtrack.wav"
with wave.open(str(final), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
# Version compressée pour l'aperçu navigateur (versionnée dans le dépôt)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final), "-c:a", "aac", "-b:a", "192k", str(out / "soundtrack.m4a")], check=True)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final), "-c:a", "libopus", "-b:a", "128k", str(out / "soundtrack.ogg")], check=True)
print(f"sonie {i_mix:.1f} → {i_out:.1f} LUFS, crête vraie {tp_out:.1f} dBTP")
print("→", final)
