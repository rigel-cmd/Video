/* Scénario : chaque scène et ses animations, calées sur timeline.js. */
(function () {
  const { K, on, scene, type, $, $$, clamp, easeInOut } = Engine;
  const TL = window.TL, S = TL.scenes, ty = TL.type;

  /* ———— Raccourcis ———— */
  const fadeIn = (el, t, d = 0.5) => K(el, [[t, { opacity: 0 }], [t + d, { opacity: 1 }, 'out']]);
  const fadeUp = (el, t, d = 0.7, dy = 30) =>
    K(el, [[t, { opacity: 0, transform: `translateY(${dy}px)` }], [t + d, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  const lineUp = (el, t, d = 0.85) =>
    K(el, [[t, { transform: 'translateY(115%)' }], [t + d, { transform: 'translateY(0%)' }, 'out']]);
  const pop = (el, t, d = 0.5, from = 0.5) =>
    K(el, [[t, { opacity: 0, transform: `scale(${from})` }], [t + d, { opacity: 1, transform: 'scale(1)' }, 'back']]);
  const exit = (el, t1, d = 0.3) =>
    K(el, [[t1 - d, { opacity: 1, filter: 'blur(0px)' }], [t1, { opacity: 0, filter: 'blur(8px)' }, 'in']]);
  const typeKey = (el, key, caret) => {
    const [t0, cps, n] = ty[key];
    const chars = [...$(el).textContent].length;
    if (chars !== n) console.warn(`timeline.js : « ${key} » compte ${chars} caractères (et non ${n})`);
    return type(el, t0, cps, { caret });
  };

  /* ———— Scènes visibles ———— */
  [['#s-intro', 'intro'], ['#s-hello', 'hello'], ['#s-cabinet', 'cabinet'], ['#s-reveal', 'reveal'],
   ['#s-missions', 'missions'], ['#s-profil', 'profil'], ['#s-offre', 'offre'], ['#s-proto', 'proto'],
   ['#s-contact', 'contact'], ['#s-countdown', 'countdown'], ['#s-end', 'end']]
    .forEach(([id, k]) => scene(id, ...S[k]));

  /* ———— HUD permanent ———— */
  K('#hud', [[5.0, { opacity: 0 }], [5.3, { opacity: 1 }, 'out'], [74.97, { opacity: 1 }], [75.0, { opacity: 0 }, 'lin']]);
  $$('#hud .corner').forEach((c, i) =>
    K(c, [[5.0 + i * 0.05, { opacity: 0, transform: 'scale(1.8)' }], [5.5 + i * 0.05, { opacity: 1, transform: 'scale(1)' }, 'out']]));
  type('.hud-tl', 5.1, 75);
  type('.hud-bl', 5.25, 75);
  type('.hud-br', 5.3, 75);
  fadeIn('.hud-tr', 5.2, 0.4);
  const rec = $('.rec'), tc = $('#tc');
  const pad = (v) => String(v).padStart(2, '0');
  on((t) => {
    rec.style.opacity = Math.floor(t * 1.6) % 2 ? 0.25 : 1;
    const rem = Math.max(0, TL.explosion - t);
    tc.textContent = `${pad(Math.floor(rem / 60))}:${pad(Math.floor(rem % 60))}:${pad(Math.floor((rem * 30) % 30))}`;
  });
  K('#overlay', [[TL.explosion - 0.01, { opacity: 1 }], [TL.explosion, { opacity: 0 }, 'lin']]);
  K('#fade', [[S.end[1] - 0.7, { opacity: 0 }], [S.end[1], { opacity: 1 }, 'inOut']]);

  /* ———— 0 · Mise à feu ———— */
  K('.intro-1', [[1.0, { opacity: 0, letterSpacing: '.12em' }], [2.8, { opacity: 1, letterSpacing: '.34em' }, 'out'], [4.35, { opacity: 1 }], [4.8, { opacity: 0 }, 'in']]);
  K('.intro-2', [[2.2, { opacity: 0, transform: 'translateY(12px)' }], [3.0, { opacity: 1, transform: 'translateY(0px)' }, 'out'], [4.35, { opacity: 1 }], [4.8, { opacity: 0 }, 'in']]);

  /* ———— 1 · Transmission ———— */
  const tlines = $$('#s-hello .tl');
  ['l1', 'l2', 'l3'].forEach((k, i) => {
    const [t0, cps, n] = ty[k];
    K(tlines[i], [[t0 - 0.08, { opacity: 0 }], [t0 - 0.02, { opacity: 1 }, 'lin']]);
    typeKey($('span', tlines[i]), k, [t0 - 0.05, t0 + n / cps + 0.15]);
  });
  const [b0, b1] = TL.bar;
  K('#s-hello .bar', [[b0 - 0.15, { opacity: 0 }], [b0, { opacity: 1 }, 'lin']]);
  K('#s-hello .bar>i', [[b0, { transform: 'scaleX(0)' }], [b1, { transform: 'scaleX(1)' }, 'inOut']]);
  K('#pct', [[b0 - 0.15, { opacity: 0 }], [b0, { opacity: 1 }, 'lin']]);
  const pct = $('#pct');
  on((t) => { pct.textContent = Math.round(100 * easeInOut(clamp((t - b0) / (b1 - b0)))) + ' %'; });
  K('#s-hello .term', [[8.75, { opacity: 1, transform: 'translateY(0px)' }], [9.05, { opacity: 0, transform: 'translateY(-40px)' }, 'in']]);
  typeKey('.hello', 'hello', [8.95, S.hello[1]]);
  K('.hello', [[9.0, { transform: 'scale(1)' }], [S.hello[1], { transform: 'scale(1.05)' }, 'lin']]);
  exit('#s-hello', S.hello[1], 0.25);

  /* ———— 2 · Le cabinet ———— */
  fadeUp('#s-cabinet .sur', 11.45, 0.6, 20);
  $$('#s-cabinet .h .line>span').forEach((el, i) => lineUp(el, 11.6 + i * 0.15));
  fadeUp('#s-cabinet .lead', 12.3, 0.8, 26);
  $$('#s-cabinet .tags li').forEach((el, i) => pop(el, TL.tags.start + i * TL.tags.step, 0.5, 0.6));
  K('.map-frame', [[11.5, { opacity: 0 }], [12.0, { opacity: 1 }, 'out']]);
  K('.radar', [[11.6, { opacity: 0, transform: 'scale(.6)' }], [12.4, { opacity: 1, transform: 'scale(1)' }, 'out']]);
  K('.sweep', [[S.cabinet[0], { transform: 'rotate(0deg)' }], [S.cabinet[1], { transform: 'rotate(560deg)' }, 'lin']]);
  K('.sweep', [[11.7, { opacity: 0 }], [12.3, { opacity: 1 }, 'out']]);
  // Relief en courbes de niveau : Vercors, Chartreuse, Belledonne, Bauges, massif du Mont-Blanc
  const topo = $('.topo');
  [[130, 580, 120, 1], [300, 360, 88, 2], [430, 490, 100, 3], [500, 290, 70, 4], [620, 110, 120, 5]].forEach(([cx, cy, r, seed], m) => {
    for (let k = 0; k < 6; k++) {
      const rr = r * (1 - k * 0.15);
      let d = '';
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const n = 0.16 * Math.sin(3 * a + seed * 1.7) + 0.09 * Math.sin(5 * a + seed * 2.3 + k * 0.6) + 0.05 * Math.sin(9 * a + seed);
        d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr * (1 + n) * 1.12).toFixed(1)} ${(cy + Math.sin(a) * rr * (1 + n) * 0.86).toFixed(1)}`;
      }
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d + 'Z');
      p.setAttribute('pathLength', '1');
      p.setAttribute('class', 'contour');
      p.setAttribute('stroke', `rgba(201,212,220,${0.1 + 0.05 * k})`);
      p.setAttribute('stroke-width', k === 5 ? 2 : 1.3);
      if (k === 5) p.setAttribute('fill', 'rgba(201,212,220,.06)');
      topo.appendChild(p);
      const t = 11.75 + m * 0.12 + k * 0.08;
      K(p, [[t, { strokeDashoffset: 1 }], [t + 1.1, { strokeDashoffset: 0 }, 'inOut']]);
    }
  });
  K('.lake', [[13.4, { opacity: 0 }], [13.9, { opacity: 1 }, 'out']]);
  $$('.massif').forEach((el, i) => fadeIn(el, 12.9 + i * 0.12, 0.6));
  [['#tg-gre', TL.locks[0]], ['#tg-ann', TL.locks[1]]].forEach(([id, t]) => {
    const g = $(id);
    K($('.lock', g), [[t - 0.45, { opacity: 0, transform: 'scale(3.2) rotate(90deg)' }], [t, { opacity: 1, transform: 'scale(1) rotate(0deg)' }, 'out']]);
    pop($('.dot', g), t, 0.45, 0);
    K($('.tlbl', g), [[t + 0.05, { opacity: 0, transform: 'translateX(16px)' }], [t + 0.5, { opacity: 1, transform: 'translateX(0px)' }, 'out']]);
  });
  K('.link-mask', [[14.1, { strokeDashoffset: 1 }], [14.8, { strokeDashoffset: 0 }, 'inOut']]);
  fadeIn('.map-cap', 14.8, 0.6);
  exit('#s-cabinet', S.cabinet[1]);

  /* ———— 3 · Votre mission, si vous l'acceptez ———— */
  typeKey('.vm1', 'vm1', [20.1, 21.15]);
  K('.vm2', [[21.2, { opacity: 0, transform: 'translateY(18px)', letterSpacing: '.14em' }], [21.9, { opacity: 1, transform: 'translateY(0px)', letterSpacing: '.01em' }, 'out']]);
  K('#s-reveal .vm', [[22.28, { opacity: 1, transform: 'scale(1)' }], [22.44, { opacity: 0, transform: 'scale(.85)' }, 'in']]);
  const slam = TL.slam;
  K('.mega .l1', [[slam - 0.16, { opacity: 0, transform: 'scale(2.6)' }], [slam, { opacity: 1, transform: 'scale(1)' }, 'in']]);
  K('.mega .l2', [[slam + 0.15, { clipPath: 'inset(0 100% 0 0)' }], [slam + 0.5, { clipPath: 'inset(0 0% 0 0)' }, 'inOut']]);
  K('#s-reveal .pill', [[slam + 0.35, { opacity: 0, transform: 'translateY(-18px)' }], [slam + 0.9, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  K('.marker', [[TL.marker, { opacity: 0, transform: 'rotate(-14deg) scale(.4)' }], [TL.marker + 0.55, { opacity: 1, transform: 'rotate(-1.5deg) scale(1)' }, 'back']]);
  fadeUp('#s-reveal .lead', 24.4, 0.9, 26);
  exit('#s-reveal', S.reveal[1]);

  /* ———— 4 · Missions ———— */
  fadeUp('#s-missions .sur', 28.95, 0.6, 20);
  lineUp('#s-missions .h .line>span', 29.05);
  fadeIn('#s-missions .count', 29.2, 0.5);
  const cols = [110, 542, 974, 1406], rows = [300, 618];
  const cards = $$('#s-missions .card');
  const cardT = (i) => TL.cards.start + i * TL.cards.step;
  cards.forEach((c, i) => {
    const x = cols[i % 4], y = rows[Math.floor(i / 4)];
    Object.assign(c.style, { left: x + 'px', top: y + 'px', zIndex: 10 + i });
    const dx = 960 - (x + 202), dy = 575 - (y + 145), t0 = cardT(i);
    const big = (s) => `translate(${dx}px,${dy}px) scale(${s})`;
    K(c, [[t0, { opacity: 0, transform: big(2.3) }], [t0 + 0.2, { opacity: 1, transform: big(1.8) }, 'out'],
          [t0 + 0.78, { transform: big(1.74) }, 'lin'], [t0 + 1.12, { transform: 'translate(0px,0px) scale(1)' }, 'inOut']]);
    K(c, [[t0 + 0.2, { borderColor: 'rgba(252,175,25,.95)' }], [t0 + 0.78, { borderColor: 'rgba(252,175,25,.95)' }], [t0 + 1.3, { borderColor: 'rgba(255,255,255,.1)' }, 'out']]);
  });
  const mCount = $('#m-count');
  on((t) => {
    let n = 1;
    for (let i = 0; i < cards.length; i++) if (t >= cardT(i)) n = i + 1;
    mCount.textContent = pad(n);
  });
  K('.grid-sweep', [[39.3, { transform: 'translateX(-260px)' }], [40.4, { transform: 'translateX(1920px)' }, 'inOut']]);
  K('.grid-sweep', [[39.3, { opacity: 0 }], [39.4, { opacity: 1 }], [40.3, { opacity: 1 }], [40.4, { opacity: 0 }]]);
  exit('#s-missions', S.missions[1]);

  /* ———— 5 · Profil ———— */
  fadeUp('#s-profil .sur', 41.4, 0.6, 20);
  lineUp('#s-profil .h .line>span', 41.5);
  K('.idcard', [[41.65, { opacity: 0, transform: 'translateX(-90px) rotate(-5deg)' }], [42.35, { opacity: 1, transform: 'translateX(0px) rotate(-1.2deg)' }, 'out']]);
  K('.scanbar', [[TL.scan[0], { transform: 'translateY(0px)', opacity: 1 }], [TL.scan[0] + 0.85, { transform: 'translateY(181px)' }, 'inOut'],
                 [TL.scan[1], { transform: 'translateY(0px)', opacity: 1 }, 'inOut'], [TL.scan[1] + 0.2, { opacity: 0 }]]);
  K('.photo .q', [[42.3, { opacity: 0 }], [42.36, { opacity: 1 }], [42.42, { opacity: 0.2 }], [42.5, { opacity: 1 }], [42.6, { opacity: 0.4 }], [42.7, { opacity: 1 }]]);
  $$('.id-who .mini').forEach((m, i) => fadeIn(m, 42.45 + i * 0.5, 0.4));
  typeKey('.id-name', 'name', [42.5, 43.5]);
  fadeUp('.id-wait', 43.05, 0.6, 12);
  K('.id-wait', [[TL.stamp - 0.05, { color: 'rgba(91,103,112,.75)' }], [TL.stamp + 0.3, { color: 'rgba(91,103,112,.18)' }, 'out']]);
  $$('.fields li').forEach((li, i) =>
    K(li, [[43.2 + i * 0.3, { opacity: 0, transform: 'translateX(-24px)' }], [43.8 + i * 0.3, { opacity: 1, transform: 'translateX(0px)' }, 'out']]));
  K('.stamp', [[TL.stamp - 0.14, { opacity: 0, transform: 'rotate(-8deg) scale(2.6)' }], [TL.stamp, { opacity: 0.92, transform: 'rotate(-8deg) scale(1)' }, 'in']]);
  fadeIn('.lbl-1', 43.3);
  $$('.skills li').forEach((li, i) => {
    const t = TL.skills.start + i * TL.skills.step;
    K(li, [[t, { opacity: 0, transform: 'translateX(30px)' }], [t + 0.5, { opacity: 1, transform: 'translateX(0px)' }, 'out']]);
    pop($('.chk', li), t + 0.12, 0.45, 0);
  });
  fadeIn('.lbl-2', 45.5);
  $$('.quals li').forEach((li, i) => pop(li, TL.quals.start + i * TL.quals.step, 0.45, 0.6));
  fadeUp('.note', 47.3, 0.7, 16);
  exit('#s-profil', S.profil[1]);

  /* ———— 6 · Ce que nous offrons ———— */
  fadeUp('#s-offre .sur', 51.4, 0.6, 20);
  lineUp('#s-offre .h .line>span', 51.5);
  $$('#s-offre .node').forEach((n, i) => {
    pop(n, 51.9 + i * 0.12, 0.5, 0);
    const ti = TL.igniteOffre[i];
    K(n, [[ti - 0.01, { backgroundColor: '#0D1720', borderColor: 'rgba(252,175,25,.6)', boxShadow: '0 0 0px 0px rgba(252,175,25,0)' }],
          [ti + 0.25, { backgroundColor: '#FCAF19', borderColor: '#FCAF19', boxShadow: '0 0 44px 12px rgba(252,175,25,.55)' }, 'out'],
          [ti + 1.2, { boxShadow: '0 0 24px 4px rgba(252,175,25,.35)' }, 'out']]);
  });
  $$('#s-offre .node-lbl').forEach((l, i) => fadeUp(l, TL.igniteOffre[i] - 0.05, 0.6, 14));
  K('.o-rule-1', [[54.1, { transform: 'scaleX(0)' }], [54.9, { transform: 'scaleX(1)' }, 'inOut']]);
  K('.o-rule-2', [[55.3, { transform: 'scaleX(0)' }], [56.1, { transform: 'scaleX(1)' }, 'inOut']]);
  $$('.stats li').forEach((li, i) => fadeUp(li, 54.3 + i * 0.3, 0.7, 22));
  Engine.counter('#o-218', TL.count218[0], TL.count218[1], 0, 218);
  $$('.atouts li').forEach((li, i) => fadeUp(li, 55.6 + i * 0.25, 0.7, 22));
  exit('#s-offre', S.offre[1]);

  /* ———— 7 · Protocole ———— */
  fadeUp('#s-proto .sur', 60.15, 0.6, 20);
  lineUp('#s-proto .h .line>span', 60.25);
  $$('.pnode').forEach((n, i) => {
    pop(n, 60.5 + i * 0.1, 0.5, 0);
    const ti = TL.igniteProto[i];
    K(n, [[ti - 0.01, { backgroundColor: '#0D1720', boxShadow: '0 0 0px 0px rgba(181,32,38,0)' }],
          [ti + 0.2, { backgroundColor: '#B52026', boxShadow: '0 0 64px 16px rgba(181,32,38,.6)' }, 'out'],
          [ti + 1.0, { boxShadow: '0 0 30px 4px rgba(181,32,38,.4)' }, 'out']]);
    K(n, [[ti, { scale: '1' }], [ti + 0.12, { scale: '1.16' }, 'out'], [ti + 0.5, { scale: '1' }, 'out']]);
  });
  $$('.pnode-lbl').forEach((l, i) => fadeUp(l, 60.6 + i * 0.1, 0.6, 14));
  fadeUp('.p-cap', 63.6, 0.7, 16);
  exit('#s-proto', S.proto[1], 0.25);

  /* ———— 8 · Candidater ———— */
  fadeUp('#s-contact .sur', 65.15, 0.6, 20);
  $$('#s-contact .h .line>span').forEach((el, i) => lineUp(el, 65.3 + i * 0.15));
  K('.mailbox', [[65.85, { opacity: 0, transform: 'scale(.85)' }], [66.3, { opacity: 1, transform: 'scale(1)' }, 'back']]);
  typeKey('.mail', 'mail', [65.95, S.contact[1]]);
  fadeUp('#s-contact .lead', 67.3, 0.8, 20);
  K('#s-contact', [[69.6, { opacity: 1 }], [70.0, { opacity: 0 }, 'in']]);

  /* ———— 9 · Autodestruction ———— */
  const ticks = $('.ticks');
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, r1 = 244, r2 = i % 5 === 0 ? 262 : 252;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 250 + Math.cos(a) * r1); l.setAttribute('y1', 250 + Math.sin(a) * r1);
    l.setAttribute('x2', 250 + Math.cos(a) * r2); l.setAttribute('y2', 250 + Math.sin(a) * r2);
    ticks.appendChild(l);
  }
  K('.cd-top', [[70.0, { opacity: 0, transform: 'translateY(-20px)' }], [70.4, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  K('.cd-bot', [[70.1, { opacity: 0 }], [70.5, { opacity: 1 }, 'out']]);
  K('.ring', [[70.0, { opacity: 0, transform: 'scale(.8)' }], [70.35, { opacity: 1, transform: 'scale(1)' }, 'out']]);
  K('.ring-prog', [[70.0, { strokeDashoffset: 0 }], [TL.explosion, { strokeDashoffset: 1 }, 'lin']]);
  $$('.digit').forEach((d, i) => {
    const t = TL.digits[i];
    K(d, [[t, { opacity: 0, transform: 'scale(1.7)' }], [t + 0.14, { opacity: 1, transform: 'scale(1)' }, 'out'],
          [t + 0.82, { opacity: 1, transform: 'scale(.94)' }, 'lin'], [t + 1.0, { opacity: 0, transform: 'scale(.82)' }, 'in']]);
  });
  K('.alarm', TL.digits.flatMap((t, i) => [[t, { opacity: 0.15 + 0.05 * i }], [t + 0.06, { opacity: 1 }, 'out'], [t + 0.94, { opacity: 0.15 + 0.06 * i }, 'out']]));

  /* ———— 10 · Signature ———— */
  K('.leaf-o', [[TL.logo, { opacity: 0, transform: 'translate(-40px,30px) rotate(-12deg) scale(.6)' }], [TL.logo + 0.7, { opacity: 1, transform: 'translate(0px,0px) rotate(0deg) scale(1)' }, 'back']]);
  K('.leaf-r', [[TL.logo + 0.15, { opacity: 0, transform: 'translate(40px,30px) rotate(12deg) scale(.6)' }], [TL.logo + 0.85, { opacity: 1, transform: 'translate(0px,0px) rotate(0deg) scale(1)' }, 'back']]);
  fadeUp('.end-name', 76.2, 0.7, 14);
  lineUp('.end-h .line>span', 76.5, 0.9);
  K('.end-h mark', [[76.95, { transform: 'rotate(-12deg) scale(.5)' }], [77.5, { transform: 'rotate(-1.5deg) scale(1)' }, 'back']]);
  fadeUp('.end-sub', 77.2, 0.7, 16);
  K('.btn', [[TL.button, { opacity: 0, transform: 'translateY(20px) scale(.9)' }], [TL.button + 0.6, { opacity: 1, transform: 'translateY(0px) scale(1)' }, 'back']]);
  K('.btn', [[79.6, { scale: '1' }], [79.85, { scale: '1.05' }, 'out'], [80.3, { scale: '1' }, 'inOut']]);
  fadeUp('.end-web', 78.0, 0.7, 10);
  fadeUp('.quote', 78.5, 0.9, 10);
  K('.lisere', [[75.9, { transform: 'scaleX(0)' }], [77.0, { transform: 'scaleX(1)' }, 'inOut']]);
  K('.end', [[75.4, { transform: 'scale(1)' }], [S.end[1], { transform: 'scale(1.025)' }, 'lin']]);

  /* ———— Lecture : rendu image par image ou aperçu temps réel ———— */
  const params = new URLSearchParams(location.search);
  const stage = $('#stage');
  window.seek = Engine.seek;
  window.DUR = TL.duration;
  window.FPS = TL.fps;

  async function fontsReady() {
    await Promise.all(['600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Poppins`)));
    await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 40px "Open Sans"`)));
    await document.fonts.ready;
  }

  if (params.has('render')) {
    fontsReady().then(() => { Engine.seek(0); window.__ready = true; });
    return;
  }

  // Aperçu : mise à l'échelle, clic / espace = lecture-pause, flèches = ±2 s
  const fit = () => stage.style.setProperty('--s', Math.min(innerWidth / 1920, innerHeight / 1080));
  fit();
  addEventListener('resize', fit);
  const music = $('#music');
  let playing = false, t = params.has('t') ? +params.get('t') : 0, last = 0;
  const hint = document.createElement('p');
  hint.id = 'hint';
  hint.textContent = 'Cliquer ou appuyer sur Espace pour lancer — ← → pour naviguer';
  document.body.appendChild(hint);
  const toggle = () => {
    playing = !playing;
    hint.style.display = playing ? 'none' : '';
    if (playing) {
      if (t >= TL.duration) t = 0;
      music.currentTime = t;
      music.play().catch(() => {});
      last = performance.now();
    } else music.pause();
  };
  const jump = (d) => { t = clamp(t + d, 0, TL.duration); music.currentTime = t; Engine.seek(Math.min(t, TL.duration - 1e-3)); };
  addEventListener('click', toggle);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight') jump(2);
    if (e.code === 'ArrowLeft') jump(-2);
  });
  fontsReady().then(() => {
    Engine.seek(t);
    const loop = (now) => {
      if (playing) {
        const audioOk = music.readyState >= 2 && !music.paused;
        t = audioOk ? music.currentTime : t + (now - last) / 1000;
        last = now;
        if (t >= TL.duration) { t = TL.duration; toggle(); }
        Engine.seek(Math.min(t, TL.duration - 1e-3));
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})();
