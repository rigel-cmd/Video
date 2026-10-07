/* Effets dessinés au canvas : mèches et étincelles, flashs, glitchs, combustion finale.
   Tout est calculé sans état à partir de t, pour que chaque image soit reproductible. */
(function () {
  const { on, rnd, clamp, lerp, $ } = Engine;
  const TL = window.TL;
  const W = 1920, H = 1080;

  const fx = $('#fx').getContext('2d');
  const bg = $('#bg').getContext('2d');
  const cam = $('#cam');

  /* ———— Tracés ———— */
  function catmull(P, n = 24) {
    if (P.length === 2) return P.map((p) => [...p]);
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push([...P[P.length - 1]]);
    return out;
  }
  class Path {
    constructor(P) {
      this.p = catmull(P);
      this.c = [0];
      for (let i = 1; i < this.p.length; i++) {
        const [x0, y0] = this.p[i - 1], [x1, y1] = this.p[i];
        this.c.push(this.c[i - 1] + Math.hypot(x1 - x0, y1 - y0));
      }
      this.len = this.c[this.c.length - 1];
    }
    idx(s) {
      let lo = 0, hi = this.c.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.c[m] <= s) lo = m; else hi = m; }
      return lo;
    }
    at(s) {
      s = clamp(s, 0, this.len);
      const i = Math.min(this.idx(s), this.p.length - 2);
      const seg = this.c[i + 1] - this.c[i] || 1;
      const k = (s - this.c[i]) / seg;
      return { x: lerp(this.p[i][0], this.p[i + 1][0], k), y: lerp(this.p[i][1], this.p[i + 1][1], k) };
    }
    stroke(ctx, s0, s1) {
      s0 = clamp(s0, 0, this.len); s1 = clamp(s1, 0, this.len);
      if (s1 - s0 < 0.5) return;
      const a = this.at(s0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      for (let i = this.idx(s0) + 1; i < this.p.length && this.c[i] < s1; i++) ctx.lineTo(this.p[i][0], this.p[i][1]);
      const b = this.at(s1);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  /* ———— Mèche ———— */
  function rope(ctx, path, s0, s1, w = 5, alpha = 1) {
    if (s1 - s0 < 0.5) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#8f7a5c'; ctx.lineWidth = w;
    path.stroke(ctx, s0, s1);
    ctx.setLineDash([w * 0.8, w * 0.9]);
    ctx.lineDashOffset = s0;
    ctx.strokeStyle = 'rgba(38,28,18,.6)';
    path.stroke(ctx, s0, s1);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,236,200,.18)'; ctx.lineWidth = 1;
    path.stroke(ctx, s0, s1);
    ctx.restore();
  }
  function burnt(ctx, path, s0, s1, w = 5, alpha = 1) {
    if (s1 - s0 < 0.5) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(70,64,60,.55)'; ctx.lineWidth = w * 0.45;
    path.stroke(ctx, s0, s1);
    ctx.restore();
  }
  function ember(ctx, path, s, len = 80, sc = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      const k = i / 16, p = path.at(s - k * len);
      ctx.fillStyle = `rgba(255,${Math.round(140 - 90 * k)},30,${0.5 * (1 - k) * (1 - k)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, (4.5 * (1 - k) + 1) * sc, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  function head(ctx, x, y, t, sc = 1) {
    const f = Math.floor(t * 60);
    const fl = 0.78 + 0.44 * rnd(f, 991);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = 62 * sc * fl;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(255,226,150,.95)');
    g.addColorStop(0.18, 'rgba(255,160,50,.55)');
    g.addColorStop(0.5, 'rgba(255,100,20,.16)');
    g.addColorStop(1, 'rgba(255,80,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, 7); ctx.fill();
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = rnd(f, i * 3 + 1) * Math.PI * 2;
      const l = (12 + 26 * rnd(f, i * 3 + 2)) * sc;
      ctx.strokeStyle = `rgba(255,240,200,${0.35 + 0.5 * rnd(f, i * 3 + 3)})`;
      ctx.lineWidth = 1.6 * sc;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, 5.5 * sc, 0, 7); ctx.fill();
    ctx.restore();
  }
  /* Étincelles : la particule k naît à k/rate à la position de la tête à cet instant. */
  function sparks(ctx, t, headAt, o) {
    const rate = o.rate, life = o.life;
    const k0 = Math.ceil((t - life) * rate), k1 = Math.floor(t * rate);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let k = k0; k <= k1; k++) {
      const tb = k / rate, age = t - tb;
      if (age < 0) continue;
      const h = headAt(tb);
      if (!h) continue;
      const r1 = rnd(k, o.seed), r2 = rnd(k, o.seed + 1), r3 = rnd(k, o.seed + 2);
      const lf = life * (0.3 + 0.7 * r3);
      if (age > lf) continue;
      const ang = -Math.PI / 2 + (r1 - 0.5) * Math.PI * (o.spread || 1.7);
      const sp = o.speed * (0.25 + 0.75 * r2);
      const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp, g = o.gravity;
      const a2 = Math.max(0, age - 0.035);
      const x = h.x + vx * age, y = h.y + vy * age + 0.5 * g * age * age;
      const xp = h.x + vx * a2, yp = h.y + vy * a2 + 0.5 * g * a2 * a2;
      const f = age / lf;
      const c = f < 0.25 ? '255,248,215' : f < 0.6 ? '255,196,90' : '255,120,40';
      ctx.strokeStyle = `rgba(${c},${(1 - f) * (o.alpha || 1)})`;
      ctx.lineWidth = (o.width || 2) * (1 - 0.6 * f);
      ctx.beginPath(); ctx.moveTo(xp, yp); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
  }

  /* ———— Mèches de la vidéo ———— */
  const pIntro = new Path([[90, 872], [230, 850], [350, 760], [480, 650], [640, 615], [800, 690], [930, 815], [1100, 858], [1260, 760], [1385, 645], [1540, 606], [1700, 680], [1830, 770], [2000, 790]]);
  const pHud = new Path([[100, 996], [1820, 996]]);
  const pOffre = new Path([[330, 370], [1590, 370]]);
  const pProto = new Path([[330, 540], [1590, 540]]);
  const span = (t, [a, b]) => clamp((t - a) / (b - a));

  function drawIntro(t) {
    const [a, b] = TL.fuse.intro;
    if (t > 5.2) return;
    const s = pIntro.len * span(t, [a, b]);
    const vis = clamp(t / 0.35);
    rope(fx, pIntro, s, pIntro.len, 6, vis);
    burnt(fx, pIntro, 0, s, 6, vis * clamp(1 - (t - 4.6) / 0.4));
    if (t >= a - 0.08 && t <= b + 0.05) {
      const h = pIntro.at(s);
      ember(fx, pIntro, s, 90, 1.2);
      head(fx, h.x, h.y, t, 1.25 + 0.25 * clamp((a + 0.25 - t) / 0.25));
    }
    // allumage : gerbe initiale
    const p0 = pIntro.at(0);
    sparks(fx, t, (tb) => (tb >= a - 0.1 && tb <= a + 0.12 ? p0 : null), { rate: 900, life: 0.7, speed: 620, gravity: 900, seed: 11, spread: 2.2, width: 2.2 });
    sparks(fx, t, (tb) => (tb >= a && tb <= b ? pIntro.at(pIntro.len * span(tb, [a, b])) : null), { rate: 260, life: 0.75, speed: 430, gravity: 820, seed: 21, width: 2 });
  }

  function hudFuseX(t) { return lerp(100, 1820, span(t, TL.fuse.hud)); }
  function drawHudFuse(t) {
    const [a, b] = TL.fuse.hud;
    if (t < a || t > b + 0.1) return;
    const alpha = clamp((t - a) / 0.4);
    const s = hudFuseX(t) - 100;
    const cd = clamp((t - TL.scenes.countdown[0]) / 1.5); // la mèche grossit pendant le compte à rebours
    rope(fx, pHud, s, pHud.len, 3 + 1.5 * cd, alpha * 0.9);
    burnt(fx, pHud, 0, s, 3, alpha * 0.5);
    if (t < b) {
      ember(fx, pHud, s, 50, 0.6 + 0.5 * cd);
      head(fx, 100 + s, 996, t, (0.5 + 0.55 * cd) * alpha);
    }
    sparks(fx, t, (tb) => (tb >= a + 0.3 && tb < b ? { x: hudFuseX(tb), y: 996 } : null),
      { rate: 50 + 160 * cd, life: 0.5 + 0.25 * cd, speed: 170 + 260 * cd, gravity: 700, seed: 31, width: 1.4 + 0.8 * cd, alpha: alpha });
  }

  // Mèche entre des nœuds (DOM) : la mèche n'est visible qu'entre les cercles
  function nodeFuse(t, path, run, nodes, radius, vis, seed) {
    if (vis <= 0) return;
    const [a, b] = run;
    const x0 = path.p[0][0], y = path.p[0][1];
    const sHead = path.len * span(t, run);
    const gaps = [];
    for (let i = 0; i < nodes.length - 1; i++) gaps.push([nodes[i] + radius - x0, nodes[i + 1] - radius - x0]);
    const inGap = (s) => gaps.some(([g0, g1]) => s > g0 && s < g1);
    for (const [g0, g1] of gaps) {
      rope(fx, path, Math.max(g0, sHead), g1, 5, vis);
      burnt(fx, path, g0, Math.min(g1, sHead), 5, vis);
    }
    if (t >= a && t <= b && inGap(sHead)) {
      ember(fx, path, sHead, 40, 0.9);
      head(fx, x0 + sHead, y, t, 0.95);
    }
    sparks(fx, t, (tb) => {
      if (tb < a || tb > b) return null;
      const s = path.len * span(tb, run);
      return inGap(s) ? { x: x0 + s, y } : null;
    }, { rate: 220, life: 0.6, speed: 380, gravity: 850, seed, width: 2 });
  }

  /* ———— Flashs, glitchs, secousses ———— */
  function drawFlashes(t) {
    for (const [peak, att, dec, col, max] of TL.flashes) {
      let a = 0;
      if (t >= peak - att && t < peak) a = (t - (peak - att)) / att;
      else if (t >= peak && t < peak + dec) a = Math.pow(1 - (t - peak) / dec, 2);
      if (a > 0) { fx.fillStyle = `rgba(${col},${a * max})`; fx.fillRect(0, 0, W, H); }
    }
  }
  function glitchAt(t) {
    for (const [a, b, amp] of TL.glitches) if (t >= a && t < b) return amp;
    return 0;
  }
  function drawGlitchBands(t, amp) {
    const f = Math.floor(t * 30);
    const n = 3 + Math.floor(rnd(f, 401) * 6);
    for (let i = 0; i < n; i++) {
      const y = rnd(f, 410 + i) * H, h = 2 + rnd(f, 430 + i) * 38 * amp;
      const kind = rnd(f, 450 + i);
      fx.fillStyle = kind < 0.33 ? `rgba(255,46,84,${0.16 * amp})` : kind < 0.66 ? `rgba(46,214,255,${0.14 * amp})` : `rgba(4,8,12,${0.5 * amp})`;
      const x = (rnd(f, 470 + i) - 0.5) * 300 * amp;
      fx.fillRect(x, y, W, h);
    }
    fx.fillStyle = `rgba(255,255,255,${0.06 * amp})`;
    for (let i = 0; i < 4; i++) fx.fillRect(0, rnd(f, 490 + i) * H, W, 1);
  }
  function camera(t) {
    const f = Math.floor(t * 30);
    let dx = 0, dy = 0, skew = 0, gx = 0;
    const g = glitchAt(t);
    if (g > 0 && rnd(f, 501) > 0.3) {
      dx += (rnd(f, 502) - 0.5) * 56 * g;
      skew = (rnd(f, 503) - 0.5) * 5 * g;
      gx = (4 + 10 * rnd(f, 504)) * g;
    }
    for (const [t0, d, amp] of TL.shakes) {
      if (t >= t0 && t < t0 + d) {
        const k = Math.pow(1 - (t - t0) / d, 2) * amp;
        dx += (rnd(f, 511) - 0.5) * 2 * k;
        dy += (rnd(f, 512) - 0.5) * 2 * k;
      }
    }
    cam.style.transform = dx || dy || skew ? `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) skewX(${skew.toFixed(2)}deg)` : '';
    cam.classList.toggle('glitch', gx > 0);
    cam.style.setProperty('--gx', gx.toFixed(1) + 'px');
    return g;
  }

  /* ———— Combustion finale (révèle la carte de fin) ———— */
  const BW = 480, BH = 270;
  const burnField = new Float32Array(BW * BH);
  (function () {
    const vn = (x, y, s) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const h = (i, j) => rnd(i * 7919 + j * 104729, s);
      return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
    };
    let mn = 1e9, mx = -1e9;
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const n = 0.5 * vn(x / 44, y / 44, 1) + 0.3 * vn(x / 18, y / 18, 2) + 0.2 * vn(x / 7, y / 7, 3);
      const d = Math.hypot((x - BW / 2) / (BW / 2), (y - BH / 2) / (BH / 2)) / Math.SQRT2;
      const v = 0.6 * d + 0.4 * n;
      burnField[y * BW + x] = v;
      mn = Math.min(mn, v); mx = Math.max(mx, v);
    }
    for (let i = 0; i < burnField.length; i++) burnField[i] = (burnField[i] - mn) / (mx - mn);
  })();
  const burnCv = document.createElement('canvas');
  burnCv.width = BW; burnCv.height = BH;
  const burnCtx = burnCv.getContext('2d');
  const burnImg = burnCtx.createImageData(BW, BH);
  const glowCv = document.createElement('canvas');
  glowCv.width = BW; glowCv.height = BH;
  const glowCtx = glowCv.getContext('2d');
  const glowImg = glowCtx.createImageData(BW, BH);
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  function drawBurn(t) {
    const [a, b] = TL.burn;
    if (t < TL.explosion || t > b + 0.1) return;
    const p = lerp(-0.06, 1.16, Math.pow(span(t, [a, b]), 0.8));
    const e1 = 0.07, e2 = 0.05;
    const d = burnImg.data, gd = glowImg.data;
    for (let i = 0; i < burnField.length; i++) {
      const dv = burnField[i] - p; // > 0 : pas encore brûlé
      let r = 11, g = 19, bl = 27, al = 1, ga = 0;
      if (dv < 0) {
        const k = clamp(-dv / e1); // 0 = front de flamme, 1 = cendre
        r = 255; g = Math.round(lerp(210, 60, k)); bl = Math.round(lerp(90, 8, k));
        al = 1 - sstep(0.55, 1, k);
        ga = (1 - k) * (1 - k);
      } else if (dv < e2) {
        const k = dv / e2;
        r = Math.round(lerp(70, 11, k)); g = Math.round(lerp(30, 19, k)); bl = Math.round(lerp(12, 27, k));
        ga = 0.35 * (1 - k);
      }
      d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = Math.round(al * 255);
      gd[i * 4] = 255; gd[i * 4 + 1] = 140; gd[i * 4 + 2] = 30; gd[i * 4 + 3] = Math.round(ga * 255);
    }
    burnCtx.putImageData(burnImg, 0, 0);
    glowCtx.putImageData(glowImg, 0, 0);
    fx.save();
    fx.imageSmoothingEnabled = true;
    fx.imageSmoothingQuality = 'high';
    fx.drawImage(burnCv, 0, 0, W, H);
    fx.globalCompositeOperation = 'lighter';
    fx.filter = 'blur(14px)';
    fx.drawImage(glowCv, 0, 0, W, H);
    fx.filter = 'blur(3px)';
    fx.globalAlpha = 0.8;
    fx.drawImage(glowCv, 0, 0, W, H);
    fx.restore();
  }

  /* ———— Braises du compte à rebours ———— */
  function drawEmbers(t) {
    const [a, b] = TL.scenes.countdown;
    if (t < a || t > b + 0.2) return;
    const k = clamp((t - a) / 4);
    fx.save();
    fx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const life = 2.2 + 1.8 * rnd(i, 601);
      const t0 = a - 2 + rnd(i, 602) * 3;
      const age = ((t - t0) % life + life) % life;
      const x = rnd(i, 603) * W + Math.sin(age * 2 + i) * 24;
      const y = H + 20 - age * (150 + 160 * rnd(i, 604));
      const al = Math.sin(Math.PI * age / life) * (0.25 + 0.6 * k);
      const r = 1.5 + 2.5 * rnd(i, 605);
      fx.fillStyle = `rgba(255,${Math.round(120 + 80 * rnd(i, 606))},40,${al})`;
      fx.beginPath(); fx.arc(x, y, r, 0, 7); fx.fill();
    }
    fx.restore();
  }

  /* ———— Fond : grille et poussières ———— */
  const grid = document.createElement('canvas');
  grid.width = W + 80; grid.height = H + 80;
  (function () {
    const g = grid.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    for (let x = 0.5; x < grid.width; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, grid.height); g.stroke(); }
    for (let y = 0.5; y < grid.height; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(grid.width, y); g.stroke(); }
    g.fillStyle = 'rgba(252,175,25,.10)';
    for (let x = 0; x < grid.width; x += 80) for (let y = 0; y < grid.height; y += 80) g.fillRect(x - 1, y - 1, 3, 3);
  })();
  function drawBg(t) {
    bg.clearRect(0, 0, W, H);
    if (t >= TL.explosion) return;
    const intro = clamp((t - 4.9) / 0.5);
    bg.globalAlpha = intro;
    const o = (t * 7) % 80;
    bg.drawImage(grid, -o, -o * 0.5);
    bg.globalAlpha = 1;
    for (let i = 0; i < 70; i++) {
      const x = ((rnd(i, 701) * W + t * (6 + 14 * rnd(i, 702))) % W + W) % W;
      const y = ((rnd(i, 703) * H - t * (3 + 8 * rnd(i, 704))) % H + H) % H;
      const a = (0.08 + 0.18 * rnd(i, 705)) * (0.6 + 0.4 * Math.sin(t * (0.5 + rnd(i, 706)) + i));
      bg.fillStyle = `rgba(201,212,220,${a})`;
      bg.beginPath(); bg.arc(x, y, 1 + 1.6 * rnd(i, 707), 0, 7); bg.fill();
    }
  }

  /* ———— Image ———— */
  on((t) => {
    fx.clearRect(0, 0, W, H);
    drawBg(t);
    drawIntro(t);
    drawHudFuse(t);
    const so = TL.scenes.offre, sp = TL.scenes.proto;
    nodeFuse(t, pOffre, TL.fuse.offre, [330, 960, 1590], 31, clamp((t - 51.9) / 0.4) * clamp((so[1] - t) / 0.3), 41);
    nodeFuse(t, pProto, TL.fuse.proto, [330, 750, 1170, 1590], 66, clamp((t - 60.5) / 0.4) * clamp((sp[1] - t) / 0.25), 51);
    drawEmbers(t);
    drawBurn(t);
    const g = camera(t);
    if (g > 0) drawGlitchBands(t, g);
    drawFlashes(t);
  });
})();
