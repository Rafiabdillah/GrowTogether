// Pengawal integritas build Pages: yang diperiksa adalah URL yang benar-benar
// tertulis di hasil build, bukan asumsi dari konfigurasi.
// Pemakaian: npm run build:pages
const fs = require('node:fs');
const path = require('node:path');

const DIST = process.argv[2] || 'dist';
const BASE = process.argv[3] || '/GrowTogether/';
if (!/^\/[^\s]*\/$/.test(BASE)) {
  console.error(`FAIL  argumen base "${BASE}" bukan bentuk /nama-folder/ — di Git Bash argumen berawalan /`);
  console.error('      bisa dikonversi jadi path Windows; jalankan tanpa argumen (default sudah benar).');
  process.exit(1);
}
const fail = [];
const ok = [];

const read = (rel) => fs.readFileSync(path.join(DIST, rel), 'utf8');
if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`FAIL  ${DIST}/index.html tidak ada — jalankan build dulu`);
  process.exit(1);
}

const html = read('index.html');
const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const appUrls = urls.filter((u) => u.startsWith(BASE) || u.startsWith('/') || /^[A-Za-z]:/.test(u));

for (const u of appUrls) {
  if (/Program Files|^[A-Za-z]:/.test(u)) {
    fail.push(`URL hasil build memakai path hasil konversi shell: ${u}`);
    continue;
  }
  if (!u.startsWith(BASE)) {
    fail.push(`URL tidak berprefiks ${BASE}: ${u}`);
    continue;
  }
  const file = path.join(DIST, u.slice(BASE.length).split('?')[0]);
  if (!fs.existsSync(file)) fail.push(`file tidak ikut ter-build untuk ${u}`);
}
if (appUrls.length > 0 && fail.length === 0) ok.push(`${appUrls.length} URL aplikasi di index.html berprefiks benar dan filenya ada`);

const sw = read('sw.js');
if (/Program Files/.test(sw)) fail.push('sw.js mengandung path shell yang terkonversi');
const precached = [...sw.matchAll(/["']((?:assets|index)[^"']*\.(?:js|css|html|webmanifest|png))["']/g)].map((m) => m[1]);
const missing = precached.filter((p) => !fs.existsSync(path.join(DIST, p)));
if (missing.length) fail.push(`precache menyebut file yang tidak ada: ${missing.join(', ')}`);
else if (precached.length) ok.push(`precache sw.js memuat ${precached.length} file dan semuanya ada di ${DIST}/`);

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const key of ['start_url', 'scope']) {
  if (manifest[key] !== BASE) fail.push(`manifest.${key} = ${manifest[key]}, seharusnya ${BASE}`);
}
if (!fail.some((f) => f.startsWith('manifest.'))) ok.push(`manifest start_url & scope = ${BASE}`);

for (const line of ok) console.log(`PASS  ${line}`);
for (const line of fail) console.log(`FAIL  ${line}`);
console.log(`\nRINGKASAN build-pages: ${ok.length} PASS, ${fail.length} FAIL`);
process.exit(fail.length ? 1 : 0);
