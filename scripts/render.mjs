// Rendu image par image de video/index.html, puis encodage MP4 (H.264 + AAC) avec ffmpeg.
//
//   node scripts/render.mjs                      → vidéo complète (output/mission-association.mp4)
//   node scripts/render.mjs --stills=4.5,22.6    → captures PNG dans output/stills/
//   node scripts/render.mjs --from=20 --to=30    → extrait
//   options : --workers=3 --fps=30 --out=chemin.mp4 --audio=output/soundtrack.wav
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const url = pathToFileURL(path.join(root, 'video/index.html')).href + '?render';

async function openPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (['warning', 'error'].includes(m.type())) console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  const cdp = await ctx.newCDPSession(page);
  return { page, cdp };
}

async function capture({ page, cdp }, t, format) {
  await page.evaluate((t) => window.seek(t), t);
  const r = await cdp.send('Page.captureScreenshot', {
    format, ...(format === 'jpeg' ? { quality: 95 } : {}), optimizeForSpeed: true,
  });
  return Buffer.from(r.data, 'base64');
}

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--hide-scrollbars'] });
try {
  const probe = await openPage(browser);
  const DUR = await probe.page.evaluate(() => window.DUR);
  const FPS = Number(args.fps || (await probe.page.evaluate(() => window.FPS)));

  if (args.stills) {
    const dir = path.join(root, 'output/stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const s of String(args.stills).split(',')) {
      const t = Number(s);
      const file = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(file, await capture(probe, t, 'png'));
      console.log(file);
    }
  } else {
    const from = Number(args.from || 0), to = Math.min(Number(args.to || DUR), DUR);
    const first = Math.round(from * FPS), last = Math.round(to * FPS) - 1;
    const total = last - first + 1;
    const frames = path.join(root, 'frames');
    fs.rmSync(frames, { recursive: true, force: true });
    fs.mkdirSync(frames, { recursive: true });
    const nw = Number(args.workers || 3);
    const pages = [probe];
    for (let w = 1; w < nw; w++) pages.push(await openPage(browser));
    let done = 0;
    const t0 = Date.now();
    await Promise.all(pages.map(async (pg, w) => {
      const a = first + Math.floor((total * w) / nw), b = first + Math.floor((total * (w + 1)) / nw);
      for (let i = a; i < b; i++) {
        const buf = await capture(pg, i / FPS, 'jpeg');
        fs.writeFileSync(path.join(frames, String(i - first).padStart(5, '0') + '.jpg'), buf);
        if (++done % 150 === 0 || done === total) {
          const el = (Date.now() - t0) / 1000;
          console.log(`${done}/${total} images · ${(done / el).toFixed(1)} img/s · reste ~${Math.round((total - done) / (done / el))} s`);
        }
      }
    }));
    await browser.close();

    const out = path.resolve(root, args.out || 'output/mission-association.mp4');
    const audio = path.resolve(root, args.audio || 'output/soundtrack.wav');
    const ff = ['-y', '-framerate', String(FPS), '-i', path.join(frames, '%05d.jpg')];
    if (fs.existsSync(audio) && !args.mute) ff.push('-ss', String(from), '-t', String(to - from), '-i', audio);
    ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-g', String(FPS * 2), '-movflags', '+faststart');
    if (fs.existsSync(audio) && !args.mute) ff.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    ff.push(out);
    console.log('ffmpeg', ff.join(' '));
    const r = spawnSync('ffmpeg', ff, { stdio: ['ignore', 'inherit', 'inherit'] });
    if (r.status !== 0) process.exit(r.status || 1);
    if (!args.keep) fs.rmSync(frames, { recursive: true, force: true });
    console.log('→', out);
  }
} finally {
  if (browser.isConnected()) await browser.close();
}
