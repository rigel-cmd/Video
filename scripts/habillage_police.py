"""Habillage sonore de « La police, sujet de débat ? ».

Tout est synthétisé (numpy/scipy), donc libre de droits. La bande produite a EXACTEMENT
le même nombre d'échantillons que la voix d'origine (44,1 kHz) : elle se recale à l'image près.

    python3 scripts/habillage_police.py chemin/voix.mp3 dossier_sortie

Sorties :
  La_police_habillage_mix.wav   voix + habillage, prêt à réimporter
  La_police_habillage_mix.mp3   idem en MP3 320 kb/s (pour écoute rapide)
  La_police_musique_seule.wav   habillage seul (déjà « ducké » sous la voix), pour mixer soi-même

Dramaturgie (temps calés sur le SRT) :
  0,0   ouverture : impact grave + sirène lointaine, « La police, sujet de débat ? »
  0,8   actualité : nappe ré mineur + pulsation sourde (90 BPM), tension retenue
  25,9  « Tout cela est codifié » : arpège régulier, idée de règle / de cadre
  37,5  « Premier critère »  : ponctuation 1 (tic + note)
  44,8  « Le deuxième critère » : ponctuation 2
  54,9  « Enfin le troisième critère » : ponctuation 3, la plus aboutie
  66,5  « Donc, vous le voyez » : résolution vers fa majeur, rassurant
  78,2  « Il n'empêche que parfois » : bascule sombre, la pulsation s'arrête
  86,3  « Nous avons réalisé un podcast » : motif de piano intime (l'histoire de Maud)
  95,9  « Alors, la police, on en débat ? » : remontée finale, accord suspendu, fondu à la dernière milliseconde
"""
import subprocess
import sys
import pathlib

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
rng = np.random.default_rng(2024)

music = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


# ———————————————————— outils ————————————————————
def tarr(d):
    return np.arange(int(d * SR)) / SR


def place(sig, t, gain=1.0, pan=0.0, verb=0.0, bus=None):
    bus = music if bus is None else bus
    i = int(round(t * SR))
    if i >= N or len(sig) == 0:
        return
    sig = sig[: N - i]
    if sig.ndim == 1:
        th = (np.clip(pan, -1, 1) + 1) * np.pi / 4
        st = np.stack([sig * np.cos(th), sig * np.sin(th)], axis=1) * np.sqrt(2)
    else:
        st = sig
    bus[i: i + len(st)] += st * gain
    if verb:
        verb_send[i: i + len(st)] += st * gain * verb


def filt(x, kind, f, order=2):
    wn = [f[0] / (SR / 2), f[1] / (SR / 2)] if kind == "band" else f / (SR / 2)
    return signal.sosfilt(signal.butter(order, wn, btype=kind, output="sos"), x, axis=0)


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def adsr(d, a=0.01, r=0.3):
    n = int(d * SR)
    e = np.ones(n)
    na, nr = min(int(a * SR), n), min(int(r * SR), n)
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[n - nr:] *= np.linspace(1, 0, nr)
    return e


def pad_voice(freq, d, detune=0.12, bright=1800):
    """Nappe : 3 dents de scie légèrement désaccordées, filtrées."""
    t = tarr(d)
    x = sum(signal.sawtooth(2 * np.pi * freq * (1 + c * detune / 100) * t + rng.uniform(0, 6))
            for c in (-1, 0, 1)) / 3
    return filt(x, "low", bright, 2)


def pad_chord(notes, t0, t1, gain, a=2.0, r=2.5, bright=1600):
    d = t1 - t0
    x = sum(pad_voice(midi(n), d, bright=bright) for n in notes) / len(notes)
    x *= adsr(d, a, r)
    # léger mouvement stéréo
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * tarr(d))
    st = np.stack([x * (0.8 + 0.2 * lfo), x * (1.0 - 0.2 * lfo)], axis=1)
    place(st, t0, gain, verb=0.5)


def piano(m, d=2.5):
    """Note de piano électrique / celesta douce (additif, décroissance exponentielle)."""
    t = tarr(d)
    f = midi(m)
    x = np.zeros_like(t)
    for k, (amp, dec) in enumerate([(1, 1.4), (0.45, 0.8), (0.2, 0.5), (0.1, 0.3)], start=1):
        x += amp * np.sin(2 * np.pi * f * k * 1.0008 ** (k - 1) * t) * np.exp(-t / dec)
    x *= adsr(d, 0.004, 0.2)
    return x * 0.5


def pluck(m, d=0.5):
    t = tarr(d)
    x = signal.square(2 * np.pi * midi(m) * t, 0.3) * np.exp(-t / 0.12)
    return filt(x, "low", 2200, 2) * adsr(d, 0.002, 0.05) * 0.4


def kick(d=0.5, f0=95, f1=42):
    t = tarr(d)
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / 0.04)) / SR
    return np.sin(ph) * np.exp(-t / 0.18) * adsr(d, 0.002, 0.05)


def tick(d=0.06):
    x = rng.standard_normal(int(d * SR))
    return filt(x, "band", (3500, 9000), 2) * np.exp(-tarr(d) / 0.008)


def boom(d=4.0):
    """Impact grave : sub qui descend + bruit filtré."""
    t = tarr(d)
    ph = 2 * np.pi * np.cumsum(30 + 45 * np.exp(-t / 0.25)) / SR
    sub = np.sin(ph) * np.exp(-t / 1.2)
    nz = filt(rng.standard_normal(len(t)), "low", 900, 2) * np.exp(-t / 0.35)
    return (sub + 0.5 * nz) * adsr(d, 0.003, 0.8)


def riser(d=1.5, f0=400, f1=4000):
    t = tarr(d)
    nz = rng.standard_normal(len(t))
    # bruit filtré dont la fréquence monte
    out_ = np.zeros_like(nz)
    blocks = 30
    edges = np.linspace(0, len(t), blocks + 1).astype(int)
    for b in range(blocks):
        fc = f0 * (f1 / f0) ** (b / blocks)
        seg = filt(nz[edges[b]: edges[b + 1] + 2000], "band", (fc * 0.7, fc * 1.3), 2)
        out_[edges[b]: edges[b + 1]] = seg[: edges[b + 1] - edges[b]]
    return out_ * (t / d) ** 2 * adsr(d, 0.05, 0.03)


def siren(d=3.2):
    """Deux-tons français lointain (la / ré), assourdi."""
    t = tarr(d)
    f = np.where((t % 1.0) < 0.5, 435.0, 580.0)
    f = filt(f, "low", 25, 1)  # glissement doux entre les deux tons
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = signal.sawtooth(ph, 0.5)
    x = filt(x, "band", (350, 1600), 2)
    return x * adsr(d, 0.6, 1.6)


# ———————————————————— composition ————————————————————
BPM = 90
BEAT = 60 / BPM

# Accords (ré mineur) : Dm, Bb, F, C, Gm, A
D_m = [50, 57, 62, 65]
B_b = [46, 53, 62, 65]
F_M = [41, 57, 60, 65]
C_M = [48, 55, 60, 64]
G_m = [43, 55, 58, 62]
A_M = [45, 57, 61, 64]
D_sus = [50, 57, 62, 67]

# 1. Ouverture
place(boom(), 0.0, 0.55, verb=0.4)
sir = siren(3.2)
place(np.stack([sir * 0.6, sir], axis=1), 0.05, 0.05, verb=0.8)

# 2. Actualité (0,8 → 25,9) : nappe + pulsation
prog1 = [D_m, B_b, F_M, C_M]
t = 0.4
i = 0
while t < 25.9:
    t_end = min(t + 8 * BEAT, 26.6)
    pad_chord(prog1[i % 4], t, t_end + 1.2, 0.10, a=1.5 if i else 2.5, r=1.6)
    t += 8 * BEAT
    i += 1
for k in range(int((25.6 - 1.0) / BEAT)):
    tb = 1.0 + k * BEAT
    place(kick(), tb, 0.30 if k % 2 == 0 else 0.18)
    place(tick(), tb + BEAT / 2, 0.05, pan=0.3 if k % 2 else -0.3)

# 3. « Tout cela est codifié » (25,9 → 66,5) : arpège régulier
prog2 = [D_m, G_m, B_b, A_M]
t = 25.9
i = 0
while t < 66.4:
    ch = prog2[i % 4]
    pad_chord(ch, t, min(t + 8 * BEAT, 66.6) + 1.0, 0.09, a=0.8, r=1.2)
    arp = [ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12]
    for s in range(16):
        ts = t + s * BEAT / 2
        if ts >= 66.3:
            break
        place(pluck(arp[s % 4]), ts, 0.12, pan=0.4 * np.sin(s), verb=0.3)
    t += 8 * BEAT
    i += 1
for k in range(int((66.3 - 25.9) / BEAT)):
    tb = 25.9 + k * BEAT
    place(kick(), tb, 0.22 if k % 4 == 0 else 0.12)
    place(tick(), tb, 0.035, pan=-0.4)
    place(tick(), tb + BEAT / 2, 0.025, pan=0.4)

# Ponctuations des 3 critères : riser court + tic + note (1, 2, 3 notes montantes)
for n_crit, tc in enumerate([37.45, 44.75, 54.85], start=1):
    place(riser(0.6, 800, 6000), tc - 0.6, 0.05, verb=0.3)
    place(boom(1.5), tc, 0.18, verb=0.3)
    for j in range(n_crit):
        place(piano(74 + [0, 3, 7][j], 2.0), tc + j * 0.12, 0.22, pan=-0.3 + 0.3 * j, verb=0.6)

# 4. « Donc, vous le voyez » (66,5 → 78,2) : résolution lumineuse en fa majeur
for ch, t0 in [(F_M, 66.4), (C_M, 69.1), (B_b, 71.8), (F_M, 74.5)]:
    pad_chord([n + 12 if n < 48 else n for n in ch], t0, t0 + 3.9, 0.09, a=0.9, r=1.4, bright=2400)
for k, (m, tn) in enumerate([(69, 66.5), (72, 69.2), (74, 71.9), (72, 74.6), (69, 76.4)]):
    place(piano(m, 2.6), tn, 0.16, pan=0.2, verb=0.6)
for k in range(int((78.0 - 66.5) / BEAT)):
    place(kick(0.4, 80, 45), 66.5 + k * BEAT, 0.10 if k % 2 == 0 else 0.0)

# 5. « Il n'empêche que parfois… » (78,2 → 86,3) : bascule sombre
place(boom(3.0), 78.2, 0.12, verb=0.5)
t = tarr(8.4)
drone = (np.sin(2 * np.pi * midi(38) * t) + 0.6 * np.sin(2 * np.pi * midi(39) * t)) * adsr(8.4, 1.5, 1.8)
drone = filt(drone + 0.3 * pad_voice(midi(50), 8.4, bright=600), "low", 900)
place(drone, 78.2, 0.06, verb=0.4)
pad_chord([50, 53, 56, 62], 78.3, 86.6, 0.05, a=2.5, r=2.0, bright=900)  # Dm(b5), inquiétant
for k in range(4):  # battement de cœur ralenti
    tb = 79.0 + k * 1.5
    place(kick(0.35, 70, 40), tb, 0.12)
    place(kick(0.35, 70, 40), tb + 0.22, 0.07)
place(boom(2.0), 84.5, 0.10, verb=0.5)  # « …qui sont graves. »

# 6. Le podcast, l'histoire de Maud (86,3 → 95,9) : piano intime
pad_chord([50, 57, 62, 65], 86.2, 96.3, 0.06, a=2.0, r=1.5, bright=1100)
melodie = [(62, 86.4), (65, 87.1), (69, 87.8), (67, 89.2), (65, 90.6),
           (62, 91.4), (64, 92.8), (65, 93.5), (62, 94.6)]
for m, tn in melodie:
    place(piano(m, 2.8), tn, 0.17, pan=-0.15, verb=0.7)
for m, tn in [(50, 86.4), (46, 89.2), (43, 91.4), (45, 93.5)]:
    place(piano(m, 3.2), tn, 0.12, pan=0.15, verb=0.5)

# 7. « Alors, la police, on en débat ? » (95,9 → fin) : remontée et accord suspendu
place(riser(2.2, 300, 5000), 95.9, 0.07, verb=0.3)
pad_chord(D_sus, 95.8, DUR, 0.10, a=1.2, r=0.6, bright=2600)
for k in range(5):
    place(kick(0.4), 96.0 + k * BEAT / 2, 0.10 + 0.04 * k)
place(boom(1.0), 98.25, 0.35, verb=0.5)
for j, m in enumerate([62, 67, 69, 74]):
    place(piano(m, 0.8), 98.25 + 0.03 * j, 0.18, verb=0.5)

# ———————————————————— réverbération (convolution, IR synthétique) ————————————————————
ir_len = int(2.4 * SR)
tir = np.arange(ir_len) / SR
ir = rng.standard_normal((ir_len, 2)) * np.exp(-tir / 0.55)[:, None]
ir = filt(ir, "low", 5000)
ir[: int(0.02 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([signal.fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
music += wet * 0.35
music = filt(music, "high", 35)

# ———————————————————— ducking sous la voix ————————————————————
vmono = np.abs(voice.mean(axis=1))
hop = int(0.01 * SR)
nb = int(np.ceil(N / hop))
env = np.array([vmono[i * hop:(i + 1) * hop].max(initial=0) for i in range(nb)])
env_db = 20 * np.log10(env + 1e-9)
speaking = (env_db > -40).astype(float)
# attaque 60 ms (avec anticipation 40 ms), relâche 450 ms
att, rel = np.exp(-1 / 6), np.exp(-1 / 45)
g = np.zeros(nb)
lead = 4
sp = np.concatenate([speaking[lead:], np.zeros(lead)])
acc = 0.0
for i in range(nb):
    c = att if sp[i] > acc else rel
    acc = c * acc + (1 - c) * sp[i]
    g[i] = acc
DUCK_DB = -9.0
gain_db = DUCK_DB * g
duck = 10 ** (np.interp(np.arange(N), np.arange(nb) * hop + hop / 2, gain_db) / 20)
music *= duck[:, None]

# fondu d'entrée/sortie très court pour démarrer et finir exactement sur le silence
fi, fo = int(0.005 * SR), int(0.5 * SR)
music[:fi] *= np.linspace(0, 1, fi)[:, None]
music[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2


# ———————————————————— niveaux et mixage ————————————————————
def rms_db(x):
    return 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)


# voix : passe-haut 70 Hz, rien d'autre (on ne touche pas au timbre)
v = filt(voice, "high", 70)
# musique calée ~12 dB sous la voix en moyenne (après ducking)
music *= 10 ** ((rms_db(v) - 12 - rms_db(music)) / 20)
mix = v + music


def limiter(x, ceiling=10 ** (-1.0 / 20), look=0.005, release=0.08):
    """Limiteur à anticipation sans décalage temporel (le gain est anticipé, pas le signal)."""
    peak = np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-12))
    L = int(look * SR)
    # min glissant vers l'avant : le gain baisse AVANT la crête
    need = minimum_filter1d(need, size=2 * L + 1, mode="nearest")
    r = np.exp(-1 / (release * SR))
    gg = np.empty_like(need)
    acc_ = 1.0
    for i in range(len(need)):
        acc_ = need[i] if need[i] < acc_ else r * acc_ + (1 - r) * need[i]
        gg[i] = acc_
    gg = signal.sosfiltfilt(signal.butter(1, 200 / (SR / 2), output="sos"), gg)
    return x * gg[:, None]


# gain global pour viser ~ -16 LUFS (norme réseaux sociaux), mesuré ensuite par ffmpeg
def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128",
                        "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(r.split("Integrated loudness:")[1].split("I:")[1].split("LUFS")[0])


probe = out / "_probe.wav"
sf.write(probe, mix, SR, subtype="FLOAT")
g_lin = 10 ** ((-16.0 - lufs(probe)) / 20)
probe.unlink()
mix = limiter(mix * g_lin)
music_out = limiter(music * g_lin)
mix = np.clip(mix, -0.98, 0.98)

assert len(mix) == N and len(music_out) == N
sf.write(out / "La_police_habillage_mix.wav", mix, SR, subtype="PCM_24")
sf.write(out / "La_police_musique_seule.wav", music_out, SR, subtype="PCM_24")
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i",
                str(out / "La_police_habillage_mix.wav"), "-c:a", "libmp3lame", "-b:a", "320k",
                str(out / "La_police_habillage_mix.mp3")], check=True)
print(f"OK : {N} échantillons ({DUR:.3f} s) à {SR} Hz")
