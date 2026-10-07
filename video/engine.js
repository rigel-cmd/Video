/* Moteur d'animation déterministe.
   Chaque image est entièrement calculée à partir du temps t (en secondes) :
   - les pistes WAAPI (K) sont mises en pause et positionnées sur t ;
   - les fonctions de mise à jour (on) recalculent le reste (machine à écrire, compteurs, canvas…).
   Le rendu vidéo appelle window.seek(t) image par image ; l'aperçu navigateur le fait en temps réel. */
(function () {
  const DUR = window.TL ? window.TL.duration : 82.5;
  const FPS = window.TL ? window.TL.fps : 30;
  const tracks = [];
  const updaters = [];

  const E = {
    lin: 'linear',
    out: 'cubic-bezier(.16,1,.3,1)',
    out2: 'cubic-bezier(.22,1,.36,1)',
    inOut: 'cubic-bezier(.65,0,.35,1)',
    in: 'cubic-bezier(.6,0,.9,.4)',
    back: 'cubic-bezier(.34,1.56,.64,1)',
    hold: 'steps(1,end)',
  };

  const $ = (s, r = document) => (typeof s === 'string' ? r.querySelector(s) : s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

  // Hachage déterministe → [0, 1)
  function rnd(a, b = 0) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* K(el, [[t, {props}, easing], ...])
     Une piste par élément et par propriété ; l'easing d'une image clé décrit
     la transition qui y mène. */
  function K(el, frames) {
    el = $(el);
    if (!el) throw new Error('K : élément introuvable');
    frames = [...frames].sort((a, b) => a[0] - b[0]);
    const props = new Set();
    frames.forEach(([, p]) => Object.keys(p).forEach((k) => props.add(k)));
    const firstVal = {}, lastVal = {};
    props.forEach((k) => {
      firstVal[k] = frames.find(([, p]) => k in p)[1][k];
      lastVal[k] = [...frames].reverse().find(([, p]) => k in p)[1][k];
    });
    const kf = [{ offset: 0, ...firstVal }];
    frames.forEach(([t, p]) => kf.push({ offset: clamp(t / DUR), ...p }));
    kf.push({ offset: 1, ...lastVal });
    // easing : de l'image i vers l'image i+1 = easing déclaré sur l'image i+1
    for (let i = 0; i < kf.length - 1; i++) {
      const next = i < frames.length ? frames[i] : null; // kf[i+1] correspond à frames[i]
      kf[i].easing = next ? E[next[2]] || next[2] || E.out : 'linear';
    }
    const a = el.animate(kf, { duration: DUR * 1000, fill: 'both' });
    a.pause();
    tracks.push(a);
    return a;
  }

  const on = (fn) => updaters.push(fn);

  // Affiche une scène entre t0 et t1
  function scene(el, t0, t1) {
    el = $(el);
    on((t) => { el.style.display = t >= t0 && t < t1 ? 'block' : 'none'; });
  }

  // Découpe le texte d'un élément en caractères (conserve les balises internes)
  function splitChars(el) {
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const c of n.textContent) {
            const s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c;
            frag.appendChild(s);
            chars.push(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return chars;
  }

  /* Machine à écrire : t0 = début, cps = caractères par seconde.
     opts.caret : [tDébut, tFin] d'affichage du curseur. Renvoie l'heure de fin de frappe. */
  function type(el, t0, cps, opts = {}) {
    el = $(el);
    const chars = splitChars(el);
    const caret = document.createElement('span');
    caret.className = 'caret';
    const tEnd = t0 + chars.length / cps;
    on((t) => {
      const n = clamp(Math.floor((t - t0) * cps), 0, chars.length);
      for (let i = 0; i < chars.length; i++) chars[i].style.visibility = i < n ? 'visible' : 'hidden';
      if (opts.caret && t >= opts.caret[0] && t < opts.caret[1]) {
        const typing = t >= t0 && t < tEnd;
        const blink = typing || Math.floor((t - opts.caret[0]) * 2.4) % 2 === 0;
        caret.style.visibility = blink ? 'visible' : 'hidden';
        const ref = n > 0 ? chars[n - 1] : chars[0];
        if (n > 0) { if (ref.nextSibling !== caret) ref.after(caret); }
        else if (ref.previousSibling !== caret) ref.before(caret);
      } else if (caret.parentNode) caret.remove();
    });
    return tEnd;
  }

  // Compteur numérique
  function counter(el, t0, t1, from, to, fmt = (v) => String(Math.round(v))) {
    el = $(el);
    on((t) => { el.textContent = fmt(lerp(from, to, easeOut(clamp((t - t0) / (t1 - t0))))); });
  }

  function seek(t) {
    const ms = t * 1000;
    for (const a of tracks) a.currentTime = ms;
    for (const u of updaters) u(t);
  }

  window.Engine = { DUR, FPS, E, K, on, scene, type, counter, seek, $, $$, clamp, lerp, rnd, easeOut, easeInOut };
})();
