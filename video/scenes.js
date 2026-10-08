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
  const typeKey = (el, key, caret = null) => {
    const [t0, cps, n] = ty[key];
    const chars = [...$(el).textContent].length;
    if (chars !== n) console.warn(`timeline.js : « ${key} » compte ${chars} caractères (et non ${n})`);
    return type(el, t0, cps, { caret });
  };

  /* ———— Scènes visibles ———— */
  [['#s-intro', 'intro'], ['#s-hello', 'hello'], ['#s-cabinet', 'cabinet'], ['#s-reveal', 'reveal'],
   ['#s-missions', 'missions'], ['#s-profil', 'profil'], ['#s-contact', 'contact'],
   ['#s-countdown', 'countdown'], ['#s-end', 'end']]
    .forEach(([id, k]) => scene(id, ...S[k]));

  /* ———— HUD permanent ———— */
  const h0 = S.hello[0], [iris0, iris1] = TL.iris, zero = TL.zero;
  K('#hud', [[h0, { opacity: 0 }], [h0 + 0.3, { opacity: 1 }, 'out'], [iris0 - 0.1, { opacity: 1 }], [iris0 + 0.2, { opacity: 0 }, 'lin']]);
  $$('#hud .corner').forEach((c, i) =>
    K(c, [[h0 + i * 0.05, { opacity: 0, transform: 'scale(1.8)' }], [h0 + 0.5 + i * 0.05, { opacity: 1, transform: 'scale(1)' }, 'out']]));
  typeKey('.hud-tl', 'hud_tl');
  typeKey('.hud-bl', 'hud_bl');
  typeKey('.hud-br', 'hud_br');
  fadeIn('.hud-tr', h0 + 0.2, 0.4);
  const rec = $('.rec'), tc = $('#tc');
  const pad = (v) => String(v).padStart(2, '0');
  // Le minuteur rejoint le compte à rebours : il affiche 00:05:00 au « 5 » et 00:00:00 au zéro
  const dg = TL.digits, step = dg[1] - dg[0], cdLen = zero - dg[0];
  const remaining = (t) => (t < dg[0] ? zero - t + (5 - cdLen) : ((zero - t) / cdLen) * 5);
  on((t) => {
    const done = t >= zero;
    rec.style.opacity = done ? 1 : Math.floor(t * 1.6) % 2 ? 0.25 : 1;
    rec.classList.toggle('ok', done);
    const rem = Math.max(0, remaining(t));
    // Chiffres dans des cases de largeur fixe : les chiffres de Poppins n'ont pas tous la même chasse
    tc.innerHTML = done ? 'annulée'
      : 'T-' + `${pad(Math.floor(rem / 60))}:${pad(Math.floor(rem % 60))}:${pad(Math.floor((rem * 30) % 30))}`.replace(/\d/g, '<i>$&</i>');
    tc.classList.toggle('ok', done);
  });
  K('#overlay', [[iris0, { opacity: 1 }], [iris1, { opacity: 0 }, 'inOut']]);
  K('#fade', [[S.end[1] - 0.9, { opacity: 0 }], [S.end[1], { opacity: 1 }, 'inOut']]);

  /* ———— 0 · Mise à feu ———— */
  K('.intro-1', [[1.4, { opacity: 0, letterSpacing: '.12em' }], [3.4, { opacity: 1, letterSpacing: '.34em' }, 'out'], [6.7, { opacity: 1 }], [7.25, { opacity: 0 }, 'in']]);
  K('.intro-2', [[2.8, { opacity: 0, transform: 'translateY(12px)' }], [3.7, { opacity: 1, transform: 'translateY(0px)' }, 'out'], [6.7, { opacity: 1 }], [7.25, { opacity: 0 }, 'in']]);

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
  const helloT = ty.hello[0];
  K('#s-hello .term', [[helloT - 0.4, { opacity: 1, transform: 'translateY(0px)' }], [helloT - 0.1, { opacity: 0, transform: 'translateY(-40px)' }, 'in']]);
  typeKey('.hello', 'hello', [helloT - 0.15, S.hello[1]]);
  K('.hello', [[helloT, { transform: 'scale(1)' }], [S.hello[1], { transform: 'scale(1.05)' }, 'lin']]);
  exit('#s-hello', S.hello[1], 0.25);

  /* ———— 2 · Le cabinet ———— */
  const c0 = S.cabinet[0];
  fadeUp('#s-cabinet .sur', c0 + 0.15, 0.6, 20);
  $$('#s-cabinet .h .line>span').forEach((el, i) => lineUp(el, c0 + 0.3 + i * 0.15));
  fadeUp('#s-cabinet .lead', c0 + 1.05, 0.8, 26);
  $$('#s-cabinet .tags li').forEach((el, i) => pop(el, TL.tags.start + i * TL.tags.step, 0.5, 0.6));
  K('.map-frame', [[c0 + 0.15, { opacity: 0 }], [c0 + 0.65, { opacity: 1 }, 'out']]);
  K('.radar', [[c0 + 0.25, { opacity: 0, transform: 'scale(.6)' }], [c0 + 1.05, { opacity: 1, transform: 'scale(1)' }, 'out']]);
  K('.sweep', [[c0, { transform: 'rotate(0deg)' }], [S.cabinet[1], { transform: 'rotate(660deg)' }, 'lin']]);
  K('.sweep', [[c0 + 0.35, { opacity: 0 }], [c0 + 0.95, { opacity: 1 }, 'out']]);
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
      const t = c0 + 0.4 + m * 0.12 + k * 0.08;
      K(p, [[t, { strokeDashoffset: 1 }], [t + 1.1, { strokeDashoffset: 0 }, 'inOut']]);
    }
  });
  K('.lake', [[TL.locks[1] - 0.3, { opacity: 0 }], [TL.locks[1] + 0.2, { opacity: 1 }, 'out']]);
  $$('.massif').forEach((el, i) => fadeIn(el, c0 + 1.55 + i * 0.12, 0.6));
  [['#tg-gre', TL.locks[0]], ['#tg-ann', TL.locks[1]]].forEach(([id, t]) => {
    const g = $(id);
    K($('.lock', g), [[t - 0.45, { opacity: 0, transform: 'scale(3.2) rotate(90deg)' }], [t, { opacity: 1, transform: 'scale(1) rotate(0deg)' }, 'out']]);
    pop($('.dot', g), t, 0.45, 0);
    K($('.tlbl', g), [[t + 0.05, { opacity: 0, transform: 'translateX(16px)' }], [t + 0.5, { opacity: 1, transform: 'translateX(0px)' }, 'out']]);
  });
  K('.link-mask', [[TL.locks[1] + 0.2, { strokeDashoffset: 1 }], [TL.locks[1] + 0.9, { strokeDashoffset: 0 }, 'inOut']]);
  fadeIn('.map-cap', TL.locks[1] + 0.9, 0.6);
  exit('#s-cabinet', S.cabinet[1]);

  /* ———— 3 · Votre mission, si vous l'acceptez ———— */
  const vmT = ty.vm1[0], slam = TL.slam;
  typeKey('.vm1', 'vm1', [vmT - 0.1, vmT + 1.1]);
  K('.vm2', [[vmT + 1.2, { opacity: 0, transform: 'translateY(18px)', letterSpacing: '.14em' }], [vmT + 1.9, { opacity: 1, transform: 'translateY(0px)', letterSpacing: '.01em' }, 'out']]);
  K('#s-reveal .vm', [[vmT + 1.2, { transform: 'scale(1)' }], [slam - 0.25, { transform: 'scale(1.06)' }, 'lin'], [slam - 0.08, { transform: 'scale(.85)' }, 'in']]);
  K('#s-reveal .vm', [[slam - 0.25, { opacity: 1 }], [slam - 0.08, { opacity: 0 }, 'in']]);
  K('.mega .l1', [[slam - 0.16, { opacity: 0, transform: 'scale(2.6)' }], [slam, { opacity: 1, transform: 'scale(1)' }, 'in']]);
  K('.mega .l2', [[slam + 0.15, { clipPath: 'inset(0 100% 0 0)' }], [slam + 0.5, { clipPath: 'inset(0 0% 0 0)' }, 'inOut']]);
  K('#s-reveal .pill', [[slam + 0.35, { opacity: 0, transform: 'translateY(-18px)' }], [slam + 0.9, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  K('.marker', [[TL.marker, { opacity: 0, transform: 'rotate(-14deg) scale(.4)' }], [TL.marker + 0.55, { opacity: 1, transform: 'rotate(-1.5deg) scale(1)' }, 'back']]);
  fadeUp('#s-reveal .lead', TL.marker + 0.86, 0.9, 26);
  exit('#s-reveal', S.reveal[1]);

  /* ———— 4 · Missions ———— */
  const m0 = S.missions[0];
  fadeUp('#s-missions .sur', m0 + 0.15, 0.6, 20);
  lineUp('#s-missions .h .line>span', m0 + 0.25);
  fadeIn('#s-missions .count', TL.cards.start, 0.4);
  const cols = [110, 542, 974, 1406], rows = [300, 618];
  const cards = $$('#s-missions .card');
  const cardT = (i) => TL.cards.start + i * TL.cards.step;
  cards.forEach((c, i) => {
    const x = cols[i % 4], y = rows[Math.floor(i / 4)];
    Object.assign(c.style, { left: x + 'px', top: y + 'px', zIndex: 10 + i });
    const dx = 960 - (x + 202), dy = 575 - (y + 145), t0 = cardT(i);
    const big = (s) => `translate(${dx}px,${dy}px) scale(${s})`;
    // La carte reste agrandie ≈0,85 s ; elle regagne la grille pendant que la suivante arrive (z-index plus haut)
    K(c, [[t0, { opacity: 0, transform: big(2.3) }], [t0 + 0.2, { opacity: 1, transform: big(1.8) }, 'out'],
          [t0 + 1.05, { transform: big(1.74) }, 'lin'], [t0 + 1.4, { transform: 'translate(0px,0px) scale(1)' }, 'inOut']]);
    K(c, [[t0 + 0.2, { borderColor: 'rgba(252,175,25,.95)' }], [t0 + 1.05, { borderColor: 'rgba(252,175,25,.95)' }], [t0 + 1.55, { borderColor: 'rgba(255,255,255,.1)' }, 'out']]);
  });
  const mCount = $('#m-count');
  on((t) => {
    let n = 1;
    for (let i = 0; i < cards.length; i++) if (t >= cardT(i)) n = i + 1;
    mCount.textContent = pad(n);
  });
  const sw = cardT(cards.length - 1) + 1.5;
  K('.grid-sweep', [[sw, { transform: 'translateX(-260px)' }], [sw + 1.1, { transform: 'translateX(1920px)' }, 'inOut']]);
  K('.grid-sweep', [[sw, { opacity: 0 }], [sw + 0.1, { opacity: 1 }], [sw + 1.0, { opacity: 1 }], [sw + 1.1, { opacity: 0 }]]);
  exit('#s-missions', S.missions[1]);

  /* ———— 5 · Profil ———— */
  const p0 = S.profil[0];
  fadeUp('#s-profil .sur', p0 + 0.13, 0.6, 20);
  lineUp('#s-profil .h .line>span', p0 + 0.23);
  K('.idcard', [[p0 + 0.38, { opacity: 0, transform: 'translateX(-90px) rotate(-5deg)' }], [p0 + 1.08, { opacity: 1, transform: 'translateX(0px) rotate(-1.2deg)' }, 'out']]);
  K('.scanbar', [[TL.scan[0], { transform: 'translateY(0px)', opacity: 1 }], [TL.scan[0] + 0.85, { transform: 'translateY(181px)' }, 'inOut'],
                 [TL.scan[1], { transform: 'translateY(0px)', opacity: 1 }, 'inOut'], [TL.scan[1] + 0.2, { opacity: 0 }]]);
  const q = TL.scan[0] + 0.1;
  K('.photo .q', [[q, { opacity: 0 }], [q + 0.06, { opacity: 1 }], [q + 0.12, { opacity: 0.2 }], [q + 0.2, { opacity: 1 }], [q + 0.3, { opacity: 0.4 }], [q + 0.4, { opacity: 1 }]]);
  const nameT = ty.name[0];
  $$('.id-who .mini').forEach((m, i) => fadeIn(m, nameT - 0.05 + i * 0.5, 0.4));
  typeKey('.id-name', 'name', [nameT - 0.1, nameT + 1.0]);
  fadeUp('.id-wait', nameT + 0.55, 0.6, 12);
  K('.id-wait', [[TL.stamp - 0.05, { color: 'rgba(91,103,112,.75)' }], [TL.stamp + 0.3, { color: 'rgba(91,103,112,.18)' }, 'out']]);
  $$('.fields li').forEach((li, i) =>
    K(li, [[nameT + 0.6 + i * 0.3, { opacity: 0, transform: 'translateX(-24px)' }], [nameT + 1.2 + i * 0.3, { opacity: 1, transform: 'translateX(0px)' }, 'out']]));
  K('.stamp', [[TL.stamp - 0.14, { opacity: 0, transform: 'rotate(-8deg) scale(2.6)' }], [TL.stamp, { opacity: 0.92, transform: 'rotate(-8deg) scale(1)' }, 'in']]);
  fadeIn('.lbl-1', TL.skills.start - 0.2);
  $$('.skills li').forEach((li, i) => {
    const t = TL.skills.start + i * TL.skills.step;
    K(li, [[t, { opacity: 0, transform: 'translateX(30px)' }], [t + 0.5, { opacity: 1, transform: 'translateX(0px)' }, 'out']]);
    pop($('.chk', li), t + 0.12, 0.45, 0);
  });
  fadeIn('.lbl-2', TL.quals.start - 0.3);
  $$('.quals li').forEach((li, i) => pop(li, TL.quals.start + i * TL.quals.step, 0.45, 0.6));
  exit('#s-profil', S.profil[1]);

  /* ———— 6 · Candidater ———— */
  const k0 = S.contact[0];
  fadeUp('#s-contact .sur', k0 + 0.15, 0.6, 20);
  $$('#s-contact .h .line>span').forEach((el, i) => lineUp(el, k0 + 0.3 + i * 0.15));
  K('.mailbox', [[ty.mail[0] - 0.15, { opacity: 0, transform: 'scale(.85)' }], [ty.mail[0] + 0.3, { opacity: 1, transform: 'scale(1)' }, 'back']]);
  typeKey('.mail', 'mail', [ty.mail[0] - 0.05, S.contact[1]]);
  fadeUp('#s-contact .lead', ty.mail[0] + 1.3, 0.8, 20);
  K('#s-contact', [[S.contact[1] - 0.3, { opacity: 1 }], [S.contact[1], { opacity: 0 }, 'in']]);

  /* ———— 7 · Compte à rebours… et le message ne s'autodétruit pas ———— */
  const d0 = S.countdown[0], fix = TL.correct;
  const ticks = $('.ticks');
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, r1 = 244, r2 = i % 5 === 0 ? 262 : 252;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 250 + Math.cos(a) * r1); l.setAttribute('y1', 250 + Math.sin(a) * r1);
    l.setAttribute('x2', 250 + Math.cos(a) * r2); l.setAttribute('y2', 250 + Math.sin(a) * r2);
    ticks.appendChild(l);
  }
  K('.cd-top', [[d0, { opacity: 0, transform: 'translateY(-20px)' }], [d0 + 0.4, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  K('.cd-bot', [[dg[0] - 0.1, { opacity: 0 }], [dg[0] + 0.3, { opacity: 1 }, 'out']]);
  K('.ring', [[d0, { opacity: 0, transform: 'scale(.8)' }], [d0 + 0.35, { opacity: 1, transform: 'scale(1)' }, 'out']]);
  // L'anneau s'arme (se remplit) avant le « 5 », se vide jusqu'au zéro, puis se remplit en vert à la correction
  K('.ring-prog', [[d0 + 0.1, { strokeDashoffset: 1 }], [dg[0], { strokeDashoffset: 0 }, 'inOut'], [zero, { strokeDashoffset: 1 }, 'lin'],
                   [fix, { strokeDashoffset: 1 }], [fix + 0.7, { strokeDashoffset: 0 }, 'inOut']]);
  K('.ring-prog', [[fix, { stroke: '#B52026' }], [fix + 0.2, { stroke: '#8EC33F' }, 'out']]);
  $$('.digit').forEach((d, i) => {
    const t = dg[i];
    K(d, [[t, { opacity: 0, transform: 'scale(1.7)' }], [t + 0.12, { opacity: 1, transform: 'scale(1)' }, 'out'],
          [t + step - 0.15, { opacity: 1, transform: 'scale(.94)' }, 'lin'], [t + step, { opacity: 0, transform: 'scale(.82)' }, 'in']]);
  });
  const sec = $('.cd-sec');
  on((t) => { sec.textContent = t >= dg[4] ? 'seconde' : 'secondes'; });
  K('.alarm', [...dg.flatMap((t, i) => [[t, { opacity: 0.15 + 0.05 * i }], [t + 0.06, { opacity: 1 }, 'out'], [t + step - 0.05, { opacity: 0.15 + 0.06 * i }, 'out']]),
               [zero + 0.6, { opacity: 0 }, 'out']]);
  // À zéro : la mèche s'éteint, la phrase est barrée et reste lisible…
  K('.strike', [[zero + 0.06, { transform: 'scaleX(0)' }], [zero + 0.36, { transform: 'scaleX(1)' }, 'inOut']]);
  K('.cd-sec', [[zero, { opacity: 1 }], [zero + 0.3, { opacity: 0 }, 'in']]);
  // … puis elle est corrigée, et la coche verte arrive avec la correction
  K('.cd-a', [[fix - 0.05, { opacity: 1, transform: 'translateY(0px)' }], [fix + 0.15, { opacity: 0, transform: 'translateY(-30px)' }, 'in']]);
  K('.cd-b', [[fix + 0.15, { opacity: 0, transform: 'translateY(30px)' }], [fix + 0.55, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  K('.cd-ok', [[fix, { opacity: 0, transform: 'scale(.3)' }], [fix + 0.45, { opacity: 1, transform: 'scale(1)' }, 'back'],
               [iris0 - 0.22, { opacity: 1, transform: 'scale(1)' }], [iris0 + 0.02, { opacity: 0, transform: 'scale(.85)' }, 'in']]);
  K('.ok-path', [[fix + 0.2, { strokeDashoffset: 1 }], [fix + 0.6, { strokeDashoffset: 0 }, 'out']]);
  K('.cd-rep', [[TL.reply, { opacity: 0, transform: 'translateY(20px)' }], [TL.reply + 0.6, { opacity: 1, transform: 'translateY(0px)' }, 'out']]);
  // Ouverture en iris vers la carte finale (sans explosion ni écran brûlé)
  K('#s-end', [[iris0, { clipPath: 'circle(0px at 960px 540px)' }], [iris1, { clipPath: 'circle(1150px at 960px 540px)' }, 'inOut']]);
  K('.iris-ring', [[iris0, { transform: 'scale(0)' }], [iris1, { transform: 'scale(1)' }, 'inOut']]);
  K('.iris-ring', [[iris0, { opacity: 0 }], [iris0 + 0.05, { opacity: 1 }], [iris1 - 0.15, { opacity: 1 }], [iris1 + 0.1, { opacity: 0 }]]);

  /* ———— 8 · Signature ———— */
  K('.leaf-o', [[TL.logo, { opacity: 0, transform: 'translate(-40px,30px) rotate(-12deg) scale(.6)' }], [TL.logo + 0.7, { opacity: 1, transform: 'translate(0px,0px) rotate(0deg) scale(1)' }, 'back']]);
  K('.leaf-r', [[TL.logo + 0.15, { opacity: 0, transform: 'translate(40px,30px) rotate(12deg) scale(.6)' }], [TL.logo + 0.85, { opacity: 1, transform: 'translate(0px,0px) rotate(0deg) scale(1)' }, 'back']]);
  fadeUp('.end-name', TL.logo + 0.5, 0.7, 14);
  lineUp('.end-h .line>span', TL.logo + 0.8, 0.9);
  K('.end-h mark', [[TL.logo + 1.25, { transform: 'rotate(-12deg) scale(.5)' }], [TL.logo + 1.8, { transform: 'rotate(-1.5deg) scale(1)' }, 'back']]);
  fadeUp('.end-sub', TL.logo + 1.3, 0.7, 16);
  K('.btn', [[TL.button, { opacity: 0, transform: 'translateY(20px) scale(.9)' }], [TL.button + 0.6, { opacity: 1, transform: 'translateY(0px) scale(1)' }, 'back']]);
  // Halo du bouton qui respire sur chaque mesure, puis pulsation sur le dernier accent de la musique
  const hit = TL.music.finalHit, bar = 4 * (60 / TL.music.bpm); // une mesure de la musique
  const halo = [];
  for (let t = TL.button + bar; t < hit - 0.2; t += bar) // sur les premiers temps : 77,87 · 79,58 · 81,29 s
    halo.push([t, { boxShadow: '0 22px 40px -18px rgba(181,32,38,.85), 0 0 0 0px rgba(181,32,38,.35)' }, 'hold'], // repart d'un coup, sans retour visible
              [t + 0.6, { boxShadow: '0 22px 40px -18px rgba(181,32,38,.85), 0 0 0 18px rgba(181,32,38,0)' }, 'out']);
  if (halo.length) K('.btn', halo);
  K('.btn', [[hit, { scale: '1' }], [hit + 0.12, { scale: '1.07' }, 'out'], [hit + 0.7, { scale: '1' }, 'inOut']]);
  K('.logo', [[hit, { scale: '1' }], [hit + 0.12, { scale: '1.08' }, 'out'], [hit + 0.7, { scale: '1' }, 'inOut']]);
  fadeUp('.end-web', TL.button + 0.4, 0.7, 10);
  fadeUp('.quote', TL.button + 1.0, 0.9, 10);
  K('.lisere', [[iris1 + 0.2, { transform: 'scaleX(0)' }], [iris1 + 1.3, { transform: 'scaleX(1)' }, 'inOut']]);
  K('.end', [[iris0, { transform: 'scale(1)' }], [S.end[1], { transform: 'scale(1.03)' }, 'lin']]);

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
