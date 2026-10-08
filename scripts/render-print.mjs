// Affiche A4 (PDF vectoriel + PNG 300 dpi) et vignettes de la vidéo (16:9 et 9:16) depuis print/affiche.html.
//
//   node scripts/render-print.mjs                  → output/print/
//   node scripts/render-print.mjs --qr=chemin.png  → affiche avec le QR code intégré
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const out = path.join(root, 'output/print');
fs.mkdirSync(out, { recursive: true });
const base = pathToFileURL(path.join(root, 'print/affiche.html')).href;
const qr = args.qr ? '&qr=' + encodeURIComponent(pathToFileURL(path.resolve(args.qr)).href) : '';

// Le PNG de l'affiche : recadré à 2480 × 3508 px (Chromium arrondit au pixel supérieur) et marqué 300 dpi
// (bloc pHYs) pour que les logiciels de mise en page et d'impression l'ouvrent directement au format A4.
function png300dpi(file) {
  const tmp = file.replace(/\.png$/, '.tmp.png');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', file, '-vf', 'crop=2480:3508:0:0', tmp]);
  if (r.status !== 0) throw new Error('ffmpeg : recadrage du PNG impossible');
  const src = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const dpm = Math.round(300 / 0.0254); // pixels par mètre
  const phys = Buffer.alloc(9); phys.writeUInt32BE(dpm, 0); phys.writeUInt32BE(dpm, 4); phys[8] = 1;
  // signature (8 octets) + IHDR (25 octets), puis pHYs, puis le reste sans éventuel pHYs d'origine
  const parts = [src.subarray(0, 33), chunk('pHYs', phys)];
  for (let o = 33; o < src.length;) {
    const n = src.readUInt32BE(o), type = src.toString('ascii', o + 4, o + 8);
    if (type !== 'pHYs') parts.push(src.subarray(o, o + 12 + n));
    o += 12 + n;
  }
  fs.writeFileSync(file, Buffer.concat(parts));
}

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb'] });
async function open(f, w, h, dsf, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${base}?f=${f}${extra}`);
  await page.waitForFunction(() => window.__ready === true);
  return { ctx, page };
}
try {
  // Affiche A4 : 210 × 297 mm. PNG à 300 dpi (2480 × 3508 px) ; PDF à fonds perdus nuls, texte vectoriel.
  const dsf = 2480 / (210 / 25.4 * 96);
  let { ctx, page } = await open('a4', 794, 1123, dsf, `&scale=${dsf}${qr}`);
  const a4png = path.join(out, 'affiche-a4.png');
  await page.locator('#page').screenshot({ path: a4png });
  png300dpi(a4png);
  await page.pdf({ path: path.join(out, 'affiche-a4.pdf'), preferCSSPageSize: true, printBackground: true });
  const box = await page.evaluate(() => {
    const p = document.getElementById('page').getBoundingClientRect(), q = document.getElementById('qr').getBoundingClientRect();
    const mm = (v) => Math.round((v / 96) * 25.4 * 10) / 10;
    return { x: mm(q.left - p.left), y: mm(q.top - p.top), w: mm(q.width), h: mm(q.height) };
  });
  console.log(`emplacement du QR code : ${box.w} × ${box.h} mm, à ${box.x} mm du bord gauche et ${box.y} mm du haut`);
  await ctx.close();

  for (const [f, w, h] of [['16x9', 1920, 1080], ['9x16', 1080, 1920]]) {
    ({ ctx, page } = await open(f, w, h, 1));
    const png = path.join(out, `vignette-${f}.png`);
    await page.locator('#page').screenshot({ path: png });
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-q:v', '2', png.replace('.png', '.jpg')]);
    await ctx.close();
  }
  for (const f of fs.readdirSync(out)) console.log('→', path.join('output/print', f));
} finally {
  await browser.close();
}
