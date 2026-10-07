"""Bande-son originale de « Mission : association », synthétisée de zéro (numpy/scipy).

Groove d'espionnage en 5/4 (120 bpm, mesure = 2,5 s), percussions, cuivres, nappes,
et bruitages calés sur video/timeline.js : mèche, frappe, verrouillages, impacts,
compte à rebours, explosion. Aucune mélodie existante n'est reprise.

    python3 scripts/soundtrack.py            → output/soundtrack.wav
"""
import json
import pathlib
import subprocess

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
TLsrc = (ROOT / "video/timeline.js").read_text(encoding="utf-8")
TL = json.loads(TLsrc[TLsrc.index("{"): TLsrc.rindex("}") + 1])

SR = 48000
DUR = TL["duration"] + 0.5
N = int(DUR * SR)
rng = np.random.default_rng(7)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


# ———————————————————— outils ————————————————————
def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


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


TABLE = 4096


def saw_table(nh):
    ph = np.arange(TABLE) / TABLE * 2 * np.pi
    return sum(((-1) ** (k + 1)) * np.sin(k * ph) / k for k in range(1, nh + 1)) * 2 / np.pi


def square_table(nh):
    ph = np.arange(TABLE) / TABLE * 2 * np.pi
    return sum(np.sin(k * ph) / k for k in range(1, nh + 1, 2)) * 4 / np.pi


SAW_DARK, SAW_MID, SAW_BRIGHT = saw_table(5), saw_table(12), saw_table(36)
SQ = square_table(15)


def osc(freq, n, table, phase=0.0):
    inc = np.broadcast_to(np.asarray(freq, float) / SR, (n,))
    ph = (phase + np.cumsum(inc)) % 1.0
    x = ph * TABLE
    i0 = x.astype(int)
    fr = x - i0
    return table[i0] * (1 - fr) + table[(i0 + 1) % TABLE] * fr


def sine(freq, n, phase=0.0):
    inc = np.broadcast_to(np.asarray(freq, float) / SR, (n,))
    return np.sin(2 * np.pi * (phase + np.cumsum(inc)))


# ———————————————————— instruments ————————————————————
def bass(m, dur, vel=1.0):
    n = int(dur * SR)
    f = mtof(m)
    t = np.arange(n) / SR
    b = np.exp(-t / 0.06)
    s = osc(f, n, SAW_DARK) * (1 - b) + osc(f, n, SAW_BRIGHT) * b
    s += 0.7 * sine(f / 2 if m > 45 else f, n)
    e = np.exp(-t / 0.35) * 0.6 + 0.4
    s = np.tanh(1.6 * s * e) * vel
    return fade(s, 0.003, 0.03)


def brass(notes, dur, vel=1.0, bright=1.0, att=0.02):
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for m in notes:
        f = mtof(m)
        for det in (-0.004, 0.0, 0.005):
            dark = osc(f * (1 + det), n, SAW_DARK, rng.random())
            br = osc(f * (1 + det), n, SAW_MID, rng.random())
            k = np.clip(t / att, 0, 1) * (0.45 + 0.55 * np.exp(-t / 0.12)) * bright
            out += dark * (1 - k) + br * k
    e = np.clip(t / att, 0, 1) * (0.55 + 0.45 * np.exp(-t / 0.18))
    out = out * e / (len(notes) * 2.2) * vel
    return fade(out, 0.002, min(0.12, dur / 3))


def pad(notes, dur, att=1.2, rel=1.5, vel=1.0, table=None):
    table = SAW_DARK if table is None else table
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for j, m in enumerate(notes):
        f = mtof(m)
        for v, det in enumerate((-0.006, 0.0, 0.007)):
            s = osc(f * (1 + det), n, table, rng.random())
            pan = ((v - 1) * 0.6 + (j % 2 - 0.5) * 0.3)
            th = (pan + 1) * np.pi / 4
            out[:, 0] += s * np.cos(th)
            out[:, 1] += s * np.sin(th)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.23 * t)
    e = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t) / rel)) * lfo
    out = filt(out, "low", 1800) * e[:, None] / (len(notes) * 2.5) * vel
    return out


def conga(f0, vel=1.0):
    t = tarr(0.35)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.012))
    s = sine(f, len(t)) * np.exp(-t / (0.16 if f0 < 250 else 0.1))
    slap = filt(noise(0.35), "band", (1500, 5000)) * np.exp(-t / 0.008) * 0.35
    return fade((s + slap) * vel, 0.0005, 0.01)


def kick(vel=1.0, dur=0.5):
    t = tarr(dur)
    f = 45 + 95 * np.exp(-t / 0.035)
    s = sine(f, len(t)) * np.exp(-t / 0.22)
    click = filt(noise(dur), "high", 3000) * np.exp(-t / 0.002) * 0.25
    return fade(np.tanh(1.5 * (s + click)) * vel, 0.0005, 0.02)


def rim(vel=1.0):
    t = tarr(0.2)
    s = sine(420, len(t)) * np.exp(-t / 0.015) + filt(noise(0.2), "band", (1800, 7000)) * np.exp(-t / 0.03) * 0.6
    return fade(s * vel, 0.0003, 0.01)


def shaker(vel=1.0):
    t = tarr(0.09)
    e = np.minimum(1, t / 0.012) * np.exp(-t / 0.03)
    return fade(filt(noise(0.09), "high", 6000) * e * vel, 0.0005, 0.005)


def hat(vel=1.0, dec=0.03):
    t = tarr(0.12)
    return fade(filt(noise(0.12), "high", 8000) * np.exp(-t / dec) * vel, 0.0003, 0.005)


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


def whoosh(dur=0.6, f0=300, f1=4000, vel=1.0, rev=False):
    """Souffle filtré dont la fréquence balaie de f0 à f1 (filtre d'état variable)."""
    n = int(dur * SR)
    x = rng.standard_normal(n)
    t = np.arange(n) / n
    fc = f0 * (f1 / f0) ** t
    g = np.tan(np.pi * np.clip(fc, 20, SR * 0.45) / SR)
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
    e = np.sin(np.pi * t) ** 1.6
    out = y * e * vel
    return fade(out[::-1] if rev else out, 0.002, 0.02)


def blip(f=1320, dur=0.06, vel=1.0, f2=None):
    t = tarr(dur)
    fr = f if f2 is None else f + (f2 - f) * np.minimum(1, t / (dur * 0.6))
    return fade(sine(fr, len(t)) * np.exp(-t / (dur / 3)) * vel, 0.002, 0.01)


def key_click(vel=1.0):
    t = tarr(0.04)
    s = filt(noise(0.04), "band", (2500, 9000)) * np.exp(-t / 0.004)
    s += sine(1700 + 500 * rng.random(), len(t)) * np.exp(-t / 0.008) * 0.25
    return fade(s * vel, 0.0002, 0.005)


def crackle(dur, rate=45, vel=1.0):
    """Grésillement de mèche : souffle + crépitements aléatoires."""
    n = int(dur * SR)
    hiss = filt(rng.standard_normal(n), "band", (2500, 9000)) * 0.18
    hiss *= 0.7 + 0.3 * filt(rng.standard_normal(n), "low", 12, 1) * 4
    cr = np.zeros(n)
    k = int(dur * rate)
    for _ in range(k):
        i = rng.integers(0, max(1, n - 400))
        L = int(SR * (0.0015 + 0.004 * rng.random()))
        cr[i: i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * (0.3 + rng.random())
    cr = filt(cr, "high", 1200)
    return fade((hiss + cr * 0.6) * vel, 0.03, 0.08)


def bitcrush(dur=0.2, vel=1.0):
    n = int(dur * SR)
    s = rng.standard_normal(n // 60 + 1).repeat(60)[:n]
    s = np.round(s * 3) / 3
    s *= np.sin(2 * np.pi * np.cumsum(np.full(n, 90 + 400 * rng.random())) / SR) * 0.5 + 0.5
    return fade(filt(s, "band", (500, 6000)) * vel, 0.002, 0.02)


def bell(m, dur=3.0, vel=1.0):
    t = tarr(dur)
    f = mtof(m)
    s = np.zeros(len(t))
    for ratio, amp, dec in ((1, 1, 1.4), (2.76, 0.4, 0.6), (5.4, 0.2, 0.3), (8.93, 0.1, 0.15), (0.5, 0.25, 1.8)):
        s += sine(f * ratio, len(t)) * amp * np.exp(-t / dec)
    return fade(s * vel * 0.4, 0.001, 0.3)


# ———————————————————— musique ————————————————————
BAR = 60 / TL["bpm"] * 5
E8 = BAR / 10
T0 = TL["musicStart"]
SC = TL["scenes"]

# Ostinato de basse (ré mineur), accents 3+2
RIFF_A = [38, 38, 45, 38, 48, 38, 41, 38, 43, 44]
RIFF_B = [38, 38, 45, 38, 48, 38, 41, 38, 45, 48]
ACC = {0: 1.0, 6: 0.95}

def bar_start(b):
    return T0 + b * BAR


def section(t):
    for k, (a, b) in SC.items():
        if a <= t < b:
            return k
    return None


n_bars = int((SC["countdown"][0] - T0) / BAR + 1e-6)
for b in range(n_bars):
    bs = bar_start(b)
    riff = RIFF_A if b % 2 == 0 else RIFF_B
    for e in range(10):
        t = bs + e * E8
        sec = section(t + 1e-4)
        brk = SC["reveal"][0] <= t < TL["slam"]
        quiet = sec == "hello"
        # basse
        if not brk:
            vel = ACC.get(e, 0.62) * (0.55 if quiet else 1.0)
            place(music, bass(riff[e], E8 * 0.92, vel), t, 0.34, 0.0)
        # shaker (doubles-croches)
        if not brk:
            for h in range(2):
                place(music, shaker(1.0 if h == 0 else 0.55), t + h * E8 / 2, 0.08 if quiet else 0.11, 0.35)
        if quiet or brk:
            continue
        # congas
        if e in (0, 6):
            place(music, conga(180, 1.0), t, 0.42, -0.25)
        if e in (2, 3, 7, 9):
            place(music, conga(290, 0.75 if e != 9 else 0.9), t, 0.36, 0.3)
        if e == 5:
            place(music, conga(290, 0.4), t + E8 / 2, 0.3, 0.3)
        # grosse caisse et rim
        if sec not in ("cabinet", "profil") and e in (0, 6):
            place(music, kick(0.95), t, 0.5)
        if sec not in ("cabinet",) and e in (4, 8):
            place(music, rim(0.8), t, 0.22, -0.1, verb=0.15)
        # charleston en doubles-croches pendant les missions et la fin
        if sec in ("missions", "offre", "proto", "contact"):
            for h in range(2):
                place(music, hat(0.9 if h == 0 else 0.5), t + h * E8 / 2, 0.07, -0.4)
    # cuivres : stab sur le premier temps toutes les deux mesures
    sec = section(bs + 1e-4)
    if sec in ("reveal", "missions", "offre", "proto", "contact") and b % 2 == 1 and bs > TL["slam"]:
        place(music, brass([62, 65, 69], 0.32, 0.8), bs, 0.2, 0.0, verb=0.25)
        place(music, brass([62, 65, 68], 0.22, 0.6), bs + 6 * E8, 0.16, 0.0, verb=0.25)

# Motif de cuivre en sourdine (deux mesures), réponse au groove
MOTIF = [(0, 69, 2), (2, 70, 1), (3, 69, 1), (4, 65, 2), (6, 74, 3), (9, 72, 1),
         (10, 70, 2), (12, 69, 1), (13, 67, 1), (14, 64, 2), (16, 69, 4)]
for b in (7, 11, 15, 19, 23):
    bs = bar_start(b)
    soft = section(bs + 1e-4) == "profil"
    for pos, m, ln in MOTIF:
        place(music, brass([m], ln * E8 * 0.95, 0.55 if soft else 0.85, bright=0.55, att=0.03),
              bs + pos * E8, 0.2, 0.18, verb=0.35)

# Nappes
place(music, pad([38, 45, 50, 53], SC["reveal"][0] - SC["cabinet"][0] + 0.8, att=2.0, rel=1.2), SC["cabinet"][0], 0.55)
place(music, pad([38, 39, 50, 51], TL["slam"] - SC["reveal"][0], att=0.8, rel=0.2, table=SAW_MID), SC["reveal"][0], 0.42)
place(music, pad([38, 45, 50, 53, 57], SC["countdown"][0] - TL["slam"], att=1.5, rel=0.6), TL["slam"], 0.4)

# Montée avant l'impact du titre
rise_d = TL["slam"] - SC["reveal"][0] - 0.3
place(sfx, whoosh(rise_d, 200, 6000, 1.0), SC["reveal"][0] + 0.3, 0.22, verb=0.3)
tr = tarr(rise_d)
place(sfx, sine(55 * 2 ** (tr / rise_d * 2), len(tr)) * (tr / rise_d) ** 2 * 0.5, SC["reveal"][0] + 0.3, 0.3)

# ———————————————————— bruitages ————————————————————
# Allumette et mèche d'ouverture (le panoramique suit l'étincelle)
fi0, fi1 = TL["fuse"]["intro"]
place(sfx, filt(noise(0.18), "band", (900, 6000)) * env_exp(0.18, 0.05), fi0 - 0.12, 0.5, -0.8)
place(sfx, whoosh(0.35, 800, 5000, 0.8), fi0 - 0.1, 0.25, -0.8)
for k in range(12):
    a = fi0 + (fi1 - fi0) * k / 12
    seg = crackle((fi1 - fi0) / 12 + 0.05, 55, 1.0)
    place(sfx, seg, a, 0.5, -0.9 + 1.8 * (k + 0.5) / 12)
place(music, pad([26, 33, 38], 5.2, att=4.0, rel=0.3, table=SAW_MID), 0.0, 0.5)

# Impact d'ouverture → début du groove
place(sfx, boom(2.5, 110, 30), 4.95, 0.9, verb=0.4)
place(sfx, crash(2.5), 4.95, 0.25, verb=0.3)
place(music, brass([50, 53, 57, 62], 0.9, 1.0), 4.95, 0.3, verb=0.5)

# Mèche du HUD : discrète, plus présente pendant le compte à rebours
h0, h1 = TL["fuse"]["hud"]
place(sfx, crackle(SC["countdown"][0] - h0, 18, 1.0), h0, 0.05, 0.3)
place(sfx, crackle(h1 - SC["countdown"][0], 70, 1.0), SC["countdown"][0], 0.4, 0.7)

# Frappe au clavier
for key, (t0, cps, nch) in TL["type"].items():
    for i in range(nch):
        place(sfx, key_click(0.7 + 0.3 * rng.random()), t0 + i / cps, 0.2, rng.uniform(-0.3, 0.3))
for t0, txt in ((5.1, 50), (5.25, 50), (5.3, 28)):
    for i in range(0, txt, 3):
        place(sfx, key_click(0.4), t0 + i / 75, 0.06, -0.7 if t0 < 5.3 else 0.7)

# Barre de déchiffrement
b0, b1 = TL["bar"]
for i in range(16):
    place(sfx, blip(900 + 60 * i, 0.04), b0 + (b1 - b0) * i / 16, 0.1, 0.2)
place(sfx, blip(1760, 0.25, 1.0, 2640), b1, 0.12, 0.2, verb=0.3)

# Transitions de scène : souffle + grésillement numérique
for k in ("cabinet", "reveal", "missions", "profil", "offre", "proto", "contact"):
    t = SC[k][0]
    place(sfx, whoosh(0.55, 400, 7000, 1.0), t - 0.42, 0.22, verb=0.2)
for a, b, amp in TL["glitches"]:
    place(sfx, bitcrush(b - a + 0.05, 1.0), a, 0.12 * min(amp, 1.4), rng.uniform(-0.5, 0.5))

# Cabinet : verrouillage des cibles, étiquettes
for t in TL["locks"]:
    for j in range(3):
        place(sfx, blip(1600, 0.05), t - 0.4 + j * 0.12, 0.13, 0.5)
    place(sfx, blip(2400, 0.18, 1.0, 2000), t, 0.14, 0.5, verb=0.3)
for i in range(TL["tags"]["n"]):
    place(sfx, blip(990 + 110 * i, 0.07, 1.0, 1320 + 110 * i), TL["tags"]["start"] + i * TL["tags"]["step"], 0.12, -0.4)

# « Votre mission… » puis impact du titre
slam = TL["slam"]
place(sfx, boom(3.0, 120, 28, 1.0), slam, 1.0, verb=0.5)
place(sfx, crash(3.0), slam, 0.32, verb=0.4)
place(music, brass([38, 50, 53, 57, 62], 1.2, 1.0, att=0.01), slam, 0.42, verb=0.6)
place(sfx, whoosh(0.3, 6000, 300, 0.9), slam - 0.28, 0.3)
place(sfx, brass([62, 65, 69, 74], 0.5, 0.7), TL["marker"], 0.18, verb=0.4)

# Missions : chaque carte arrive en plein écran
for i in range(TL["cards"]["n"]):
    t = TL["cards"]["start"] + i * TL["cards"]["step"]
    place(sfx, whoosh(0.32, 300, 5000, 1.0), t - 0.15, 0.2, -0.3 + 0.6 * (i % 4) / 3)
    place(sfx, kick(0.6, 0.3), t + 0.05, 0.25)
    place(sfx, blip(1320, 0.08), t + 0.05, 0.08, 0.0, verb=0.3)
    place(sfx, whoosh(0.35, 3000, 400, 0.6), t + 0.78, 0.1, -0.6 + 1.2 * (i % 4) / 3)
place(sfx, whoosh(1.1, 500, 8000, 0.8), 39.3, 0.12, verb=0.3)

# Profil : scanner, coches, tampon
s0, s1 = TL["scan"]
ts = tarr(s1 - s0)
sweep = 600 + 1400 * (0.5 - 0.5 * np.cos(2 * np.pi * ts / (s1 - s0)))
place(sfx, fade(sine(sweep, len(ts)) * (0.6 + 0.4 * np.sin(2 * np.pi * 18 * ts)), 0.05, 0.1), s0, 0.06, 0.3)
for i in range(TL["skills"]["n"]):
    t = TL["skills"]["start"] + i * TL["skills"]["step"] + 0.12
    place(sfx, blip(1320, 0.06), t, 0.11, 0.4)
    place(sfx, blip(1980, 0.12), t + 0.06, 0.1, 0.4, verb=0.3)
for i in range(TL["quals"]["n"]):
    place(sfx, blip(880 + 90 * i, 0.06), TL["quals"]["start"] + i * TL["quals"]["step"], 0.09, 0.4)
st = TL["stamp"]
place(sfx, boom(0.8, 150, 60, 1.0), st, 0.7, verb=0.3)
place(sfx, filt(noise(0.3), "low", 1200) * env_exp(0.3, 0.05), st, 0.6, -0.2)

# Offre et protocole : mèches entre les nœuds, allumage des étapes
for run, nodes, xs in ((TL["fuse"]["offre"], TL["igniteOffre"], (330, 1590)), (TL["fuse"]["proto"], TL["igniteProto"], (330, 1590))):
    a, b = run
    for k in range(8):
        ta = a + (b - a) * k / 8
        x = xs[0] + (xs[1] - xs[0]) * (k + 0.5) / 8
        place(sfx, crackle((b - a) / 8 + 0.04, 60, 1.0), ta, 0.3, x / 960 - 1)
    for j, t in enumerate(nodes):
        x = xs[0] + (xs[1] - xs[0]) * j / (len(nodes) - 1)
        place(sfx, boom(0.6, 140, 55, 0.8), t, 0.45, x / 960 - 1, verb=0.3)
        place(sfx, brass([62 + 2 * j, 66 + 2 * j], 0.25, 0.7), t, 0.12, x / 960 - 1, verb=0.4)
c0, c1 = TL["count218"]
for i in range(18):
    place(sfx, key_click(0.6), c0 + (c1 - c0) * (1 - (1 - i / 18) ** 2), 0.1, -0.5)

# Candidater : montée vers l'autodestruction
cd0 = SC["countdown"][0]
place(sfx, whoosh(2.4, 150, 9000, 1.0), cd0 - 2.4, 0.18, verb=0.3)
tr = tarr(2.4)
place(sfx, sine(110 * 2 ** (tr / 2.4 * 1.5), len(tr)) * (tr / 2.4) ** 2 * 0.4, cd0 - 2.4, 0.25)

# Compte à rebours : battements, tic-tac, impacts, alarme montante
for i, t in enumerate(TL["digits"]):
    place(sfx, boom(1.0, 100, 40, 1.0), t, 0.6 + 0.08 * i, verb=0.35)
    place(sfx, kick(0.7, 0.3), t + 0.22, 0.35)
    place(sfx, brass([50 + i, 57 + i], 0.35, 0.8, att=0.01), t, 0.16, verb=0.4)
for j in range(20):
    t = cd0 + j * 0.25
    place(sfx, rim(0.6 if j % 2 else 1.0), t + 0.125, 0.12, -0.6 if j % 2 else 0.6)
ta = tarr(5.0)
alarm = osc(220 * 2 ** (ta / 5.0), len(ta), SQ) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 4 * ta)))
place(sfx, fade(filt(alarm, "low", 2500) * (ta / 5.0) ** 1.5, 0.1, 0.01), cd0, 0.05)
place(music, pad([38, 39, 44, 50], 5.0, att=3.0, rel=0.05, table=SAW_MID), cd0, 0.5)

# Explosion et combustion
ex = TL["explosion"]
place(sfx, boom(4.0, 90, 24, 1.0), ex, 1.2, verb=0.6)
tn = tarr(3.5)
blast = noise(3.5) * np.exp(-tn / 0.6) * np.minimum(1, tn / 0.003)
place(sfx, filt(blast, "low", 2500), ex, 0.6, verb=0.5)
place(sfx, crash(4.0), ex, 0.35, verb=0.5)
bu0, bu1 = TL["burn"]
place(sfx, crackle(bu1 - bu0 + 0.8, 140, 1.0), bu0, 0.45, -0.3)
place(sfx, crackle(bu1 - bu0 + 0.8, 140, 1.0), bu0 + 0.05, 0.45, 0.3)
place(sfx, whoosh(1.6, 200, 3000, 1.0), bu0, 0.25, verb=0.4)

# Signature : accord résolu en ré majeur, cloche du logo, scintillement du bouton
end0, end1 = SC["end"]
place(music, pad([38, 50, 54, 57, 62], end1 - end0 - 0.4, att=1.6, rel=1.4, vel=1.2), end0 + 0.5, 0.8)
place(music, brass([50, 54, 57, 62], 2.6, 0.7, bright=0.6, att=0.5), end0 + 0.7, 0.22, verb=0.6)
for pos, m, ln in [(0, 69, 2), (2, 74, 2), (4, 78, 6)]:
    place(music, brass([m], ln * E8 * 0.95, 0.6, bright=0.5, att=0.05), end0 + 2.6 + pos * E8, 0.16, 0.18, verb=0.5)
place(music, bass(38, 3.0, 0.8), end0 + 0.7, 0.3)
place(sfx, bell(86, 3.5), TL["logo"], 0.25, -0.2, verb=0.6)
place(sfx, bell(93, 3.0), TL["logo"] + 0.15, 0.18, 0.2, verb=0.6)
place(sfx, bell(90, 3.0), TL["button"], 0.16, 0.0, verb=0.6)
place(sfx, blip(1760, 0.1, 1.0, 2640), 79.62, 0.06, 0.3, verb=0.5)

# ———————————————————— mixage ————————————————————
def make_ir(sec=2.6):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-t / (sec / 6.9))[:, None]
    ir = filt(ir, "low", 5000)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(axis=0))


ir = make_ir()
wet = np.stack([signal.fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)

music = filt(music, "high", 30)
mix = music * 0.9 + sfx * 0.85 + wet * 0.35

# Fondu final avec l'image
fo0, fo1 = TL["duration"] - 0.9, TL["duration"]
tt = np.arange(N) / SR
mix *= np.clip((fo1 - tt) / (fo1 - fo0), 0, 1)[:, None]

# Compression douce puis limiteur
envl = np.sqrt(filt(np.mean(mix ** 2, axis=1), "low", 8, 1).clip(1e-9))
gain = np.minimum(1.0, (0.25 / envl) ** 0.35)
mix *= gain[:, None]
mix = mix / np.max(np.abs(mix)) * 0.98
mix = np.tanh(mix * 1.15) / np.tanh(1.15)

out = ROOT / "output"
out.mkdir(exist_ok=True)
raw = out / "soundtrack.raw.wav"
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
import wave

with wave.open(str(raw), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

# Normalisation de sonie en deux passes (EBU R128, −16 LUFS, crête −1,5 dBTP)
final = out / "soundtrack.wav"
target = "I=-16:TP=-1.5:LRA=11"
meas = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(raw), "-af", f"loudnorm={target}:print_format=json",
                       "-f", "null", "-"], capture_output=True, text=True).stderr
m = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
af = (f"loudnorm={target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", af, "-ar", str(SR), str(final)], check=True)
print(f"sonie mesurée {m['input_i']} LUFS → −16 LUFS")
raw.unlink()
# Version compressée pour l'aperçu navigateur (versionnée dans le dépôt)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final), "-c:a", "aac", "-b:a", "192k", str(out / "soundtrack.m4a")], check=True)
print("→", final)
