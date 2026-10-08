/* Visuel de fond de l'affiche et des vignettes : nuit, relief des Alpes, cadran du compte à rebours,
   mèche allumée et étincelles. Dessin déterministe (même résultat à chaque rendu). */
(function () {
  const params = new URLSearchParams(location.search);
  const fmt = document.documentElement.className.replace('f-', '');
  const page = document.getElementById('page');
  const cv = document.getElementById('art');
  const fig = document.querySelector('.figure');

  // QR code optionnel : ?qr=chemin/vers/qr.png
  if (params.get('qr')) {
    const img = new Image();
    img.src = params.get('qr');
    img.alt = 'QR code';
    document.getElementById('qr').appendChild(img);
  }

  const rnd = (a, b = 0) => {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  const lerp = (a, b, k) => a + (b - a) * k;

  // Tracé de la mèche (px CSS de la page) et taille du cadran, selon le format
  const CFG = {
    a4: { ring: 205, sparkAt: 0.8, grid: 40,
      fuse: [[-30, 1010], [14, 900], [20, 760], [16, 640], [56, 480], [150, 350], [230, 230], [360, 150], [520, 168], [640, 150], [740, 90], [840, 40]] },
    169: { ring: 290, sparkAt: 0.8, grid: 60,
      fuse: [[1000, 1120], [1060, 1000], [1050, 860], [1090, 720], [1120, 560], [1180, 420], [1260, 290], [1400, 200], [1580, 210], [1730, 160], [1850, 90], [1990, 40]] },
    916: { ring: 300, sparkAt: 0.86, grid: 60,
      fuse: [[-40, 1700], [26, 1560], [36, 1380], [26, 1200], [70, 1000], [150, 820], [200, 660], [250, 520], [360, 420], [520, 380], [680, 420], [820, 480], [930, 470], [1020, 400], [1130, 330]] },
  }[fmt];

  function catmull(P, n = 30) {
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(P[P.length - 1]);
    return out;
  }

  function draw() {
    const W = page.clientWidth, H = page.clientHeight;
    const S = Number(params.get('scale')) || window.devicePixelRatio || 1;
    cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    const c = cv.getContext('2d');
    c.setTransform(S, 0, 0, S, 0, 0);
    const fr = fig.getBoundingClientRect(), pr = page.getBoundingClientRect();
    const k = fr.width / 600;
    const hx = fr.left - pr.left + 300 * k, hy = fr.top - pr.top + 196 * k; // centre de la tête
    const u = W / 794; // unité relative (épaisseurs, tailles)

    // Fond nocturne
    let g = c.createRadialGradient(hx, hy, 0, hx, hy, Math.max(W, H) * 0.95);
    g.addColorStop(0, '#203446'); g.addColorStop(0.35, '#101C27'); g.addColorStop(1, '#04070A');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // Grille HUD discrète
    c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = 1 / S * Math.max(1, S * 0.6);
    for (let x = 0; x <= W; x += CFG.grid) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y <= H; y += CFG.grid) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    // Relief des Alpes en courbes de niveau
    const massifs = fmt === '169'
      ? [[300, 980, 260], [760, 1010, 200], [1180, 980, 240], [1700, 960, 260], [60, 120, 200]]
      : fmt === '916'
        ? [[120, 1760, 280], [560, 1840, 240], [980, 1720, 280], [980, 120, 220], [60, 320, 160]]
        : [[90, 1060, 160], [400, 1110, 140], [720, 1040, 170], [740, 330, 120], [40, 170, 110]];
    massifs.forEach(([cx, cy, r], m) => {
      for (let kk = 0; kk < 7; kk++) {
        const rr = r * (1 - kk * 0.13);
        c.beginPath();
        for (let i = 0; i <= 90; i++) {
          const a = (i / 90) * Math.PI * 2;
          const n = 0.16 * Math.sin(3 * a + m * 1.7) + 0.09 * Math.sin(5 * a + m * 2.3 + kk * 0.6) + 0.05 * Math.sin(9 * a + m);
          const x = cx + Math.cos(a) * rr * (1 + n) * 1.15, y = cy + Math.sin(a) * rr * (1 + n) * 0.8;
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.strokeStyle = `rgba(201,212,220,${0.05 + 0.025 * kk})`; c.lineWidth = 1.1 * u;
        c.stroke();
      }
    });

    // Halo de contre-jour derrière la silhouette
    g = c.createRadialGradient(hx + 40 * u, hy - 20 * u, 0, hx, hy, CFG.ring * 1.6);
    g.addColorStop(0, 'rgba(252,175,25,.22)'); g.addColorStop(0.45, 'rgba(181,32,38,.10)'); g.addColorStop(1, 'rgba(181,32,38,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    // Cadran du compte à rebours autour de la tête
    const R = CFG.ring;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,.10)'; c.lineWidth = 6 * u;
    c.beginPath(); c.arc(hx, hy, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#B52026'; c.shadowColor = 'rgba(255,80,80,.6)'; c.shadowBlur = 14 * u;
    c.beginPath(); c.arc(hx, hy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.72); c.stroke();
    c.shadowBlur = 0;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r1 = R + 14 * u, r2 = R + (i % 5 === 0 ? 28 : 20) * u;
      c.strokeStyle = 'rgba(255,255,255,.26)'; c.lineWidth = (i % 5 === 0 ? 2 : 1.2) * u;
      c.beginPath(); c.moveTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); c.lineTo(hx + Math.cos(a) * r2, hy + Math.sin(a) * r2); c.stroke();
    }
    // Coins de visée du cadre (HUD)
    const m = 22 * u, L = 34 * u;
    c.strokeStyle = 'rgba(252,175,25,.8)'; c.lineWidth = 2 * u; c.lineCap = 'butt';
    // (sur l'affiche, le bas est occupé par le générique et le QR code : coins du haut seulement)
    [[m, m, 1, 1], [W - m, m, -1, 1], ...(fmt === 'a4' ? [] : [[m, H - m - 8 * u, 1, -1], [W - m, H - m - 8 * u, -1, -1]])].forEach(([x, y, sx, sy]) => {
      c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke();
    });

    // Mèche : partie brûlée, partie intacte, braise et étincelles
    const P = catmull(CFG.fuse);
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const len = cum[cum.length - 1], sH = len * CFG.sparkAt;
    const at = (s) => {
      let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const kk = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [lerp(P[i - 1][0], P[i][0], kk), lerp(P[i - 1][1], P[i][1], kk)];
    };
    const stroke = (s0, s1) => {
      c.beginPath(); const a0 = at(s0); c.moveTo(a0[0], a0[1]);
      for (let i = 0; i < P.length; i++) if (cum[i] > s0 && cum[i] < s1) c.lineTo(P[i][0], P[i][1]);
      const a1 = at(s1); c.lineTo(a1[0], a1[1]); c.stroke();
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(80,72,66,.55)'; c.lineWidth = 2.4 * u; stroke(0, sH);
    const w = 5 * u;
    c.strokeStyle = '#8f7a5c'; c.lineWidth = w; stroke(sH, len);
    c.setLineDash([w * 0.8, w * 0.9]); c.lineDashOffset = sH; c.strokeStyle = 'rgba(38,28,18,.6)'; stroke(sH, len); c.setLineDash([]);
    c.strokeStyle = 'rgba(255,236,200,.18)'; c.lineWidth = 1 * u; stroke(sH, len);
    const [sx, sy] = at(sH);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) { // braise
      const kk = i / 22, p = at(sH - kk * 70 * u);
      c.fillStyle = `rgba(255,${Math.round(140 - 90 * kk)},30,${0.55 * (1 - kk) ** 2})`;
      c.beginPath(); c.arc(p[0], p[1], (5 * (1 - kk) + 1) * u, 0, 7); c.fill();
    }
    for (let i = 0; i < 230; i++) { // étincelles figées en plein vol
      const ang = -Math.PI / 2 + (rnd(i, 1) - 0.5) * Math.PI * 1.9;
      const sp = (60 + 260 * rnd(i, 2)) * u, age = 0.08 + 0.55 * rnd(i, 3), grav = 520 * u;
      const pos = (t) => [sx + Math.cos(ang) * sp * t, sy + Math.sin(ang) * sp * t + 0.5 * grav * t * t];
      const [x1, y1] = pos(age), [x0, y0] = pos(Math.max(0, age - 0.05));
      const f = age / 0.63;
      c.strokeStyle = `rgba(${f < 0.3 ? '255,248,215' : f < 0.65 ? '255,196,90' : '255,120,40'},${0.9 * (1 - f * 0.8)})`;
      c.lineWidth = (2.2 - 1.2 * f) * u;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    g = c.createRadialGradient(sx, sy, 0, sx, sy, 95 * u);
    g.addColorStop(0, 'rgba(255,226,150,.95)'); g.addColorStop(0.16, 'rgba(255,160,50,.6)'); g.addColorStop(0.5, 'rgba(255,100,20,.16)'); g.addColorStop(1, 'rgba(255,80,10,0)');
    c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 95 * u, 0, 7); c.fill();
    for (let i = 0; i < 9; i++) {
      const a = rnd(i, 7) * Math.PI * 2, l = (16 + 34 * rnd(i, 8)) * u;
      c.strokeStyle = `rgba(255,240,200,${0.4 + 0.5 * rnd(i, 9)})`; c.lineWidth = 1.8 * u;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); c.stroke();
    }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 6.5 * u, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over';

    // Poussières
    for (let i = 0; i < 140; i++) {
      c.fillStyle = `rgba(201,212,220,${0.06 + 0.16 * rnd(i, 11)})`;
      c.beginPath(); c.arc(rnd(i, 12) * W, rnd(i, 13) * H, (0.6 + 1.4 * rnd(i, 14)) * u, 0, 7); c.fill();
    }
    // Vignettage
    g = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // Grain léger (fixe)
    const gs = 2;
    for (let y = 0; y < H; y += gs) for (let x = 0; x < W; x += gs) {
      const r = rnd(x * 7 + 1, y * 13 + 5);
      if (r > 0.9) { c.fillStyle = `rgba(255,255,255,${(r - 0.9) * 0.25})`; c.fillRect(x, y, gs, gs); }
      else if (r < 0.1) { c.fillStyle = `rgba(0,0,0,${(0.1 - r) * 0.5})`; c.fillRect(x, y, gs, gs); }
    }
  }

  document.fonts.ready.then(() => { draw(); window.__ready = true; });
})();
