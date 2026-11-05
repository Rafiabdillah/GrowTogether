// QA fase 2: DUA PERANGKAT NYATA.
//
// Dua instance Chrome dengan --user-data-dir terpisah = dua IndexedDB/localStorage
// terpisah = dua sesi Firebase Anonymous yang benar-benar berbeda (dua tab di satu
// Chrome berbagi storage sehingga menjadi satu uid yang sama, jadi itu bukan uji
// dua perangkat). Keduanya membuka satu server preview dari build repo, bicara ke
// emulator Firestore yang sama, dan saling melihat datanya lewat server — bukan
// lewat BroadcastChannel.
//
// Aturan emulator di fase ini dibuat longgar (LOOSE_RULES) supaya query list
// aplikasi selalu jalan; aturan ASLI sudah dibuktikan per-dokumen di qa-rules.cjs.
// Privasi di sini yang diuji adalah perilaku aplikasi: apakah baris privat benar-benar
// tidak muncul di layar pasangan.
//
// Semua tulisan aplikasi berjalan di latar belakang, jadi dua hal yang dipakai sebagai
// saksi: REST emulator (isi database, tanpa SDK tes dan tanpa aturan) untuk membuktikan
// barisnya benar-benar mendarat, dan panel "Log aktivitas sinkron" milik perangkat untuk
// membedakan "server menolak" dari "masih dalam perjalanan".
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const REPO = process.env.GT_REPO || 'C:/Users/WINDOWS 11/Downloads/growtogether-improved';
const TMP = process.env.TMP || os.tmpdir();
const JDK = process.env.GT_JDK || path.join(TMP, 'gt-testenv/jdk-21.0.13+9');
const CLI = process.env.GT_CLI || path.join(TMP, 'gt-testenv/cli');
const SYNCTEST = process.env.GT_SYNCTEST || path.join(TMP, 'gt-synctest');
const CHROME = process.env.GT_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WORK = path.join(TMP, 'gt-qa');
const PORT = Number(process.env.GT_PORT || 4177);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PROJECT = 'growtogether-rafiabdillah';
const APP_VERSION = JSON.parse(fs.readFileSync(`${REPO}/package.json`, 'utf8')).version;
// GT_CONNECT=1: pakai emulator/preview/Chrome yang sudah jalan (loop debug cepat,
// tanpa build ulang). GT_ONLY="a,b": hanya fase dengan nama yang cocok yang jalan.
const CONNECT = process.env.GT_CONNECT === '1';
const ONLY = (process.env.GT_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const LOOSE_RULES = `service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
let failures = 0;
let passes = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (ok) passes++;
  else failures++;
}
function say(msg) {
  console.log(`... ${msg}`);
}
// Penanda supaya mudah mencari fase tertentu lewat GT_ONLY.
const STAMP = Date.now().toString().slice(-4);
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}
function start(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env || process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(opts.log, { flags: 'w' });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push(child);
  return child;
}
async function stopEverything() {
  for (const child of children) {
    if (child.killed) continue;
    await run('taskkill', ['/F', '/T', '/PID', String(child.pid)]).catch(() => undefined);
  }
  children.length = 0;
}
function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port });
    s.setTimeout(400);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
    s.on('timeout', () => { s.destroy(); resolve(false); });
  });
}
async function waitForPort(port, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await sleep(1200);
  }
  return false;
}
async function waitForFreePort(port, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (await portOpen(port)) {
    if (Date.now() > deadline) return false;
    await sleep(2000);
  }
  return true;
}

class Connection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.waiting = new Map();
    this.onEvent = null;
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.waiting.has(message.id)) {
        const { resolve, reject, method } = this.waiting.get(message.id);
        this.waiting.delete(message.id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result);
      } else if (message.method && this.onEvent) {
        this.onEvent(message.method, message.params, message.sessionId);
      }
    });
    // Koneksi bisa hilang tanpa aba-aba (laptop tidur, Chrome ditutup, jaringan
    // putus) dan WebSocket tidak selalu mengirim peristiwa penutupan. Tanpa dua
    // penjaga ini, harness hanya diam menggantung berjam-jam alih-alih gagal.
    const drop = (reason) => {
      for (const [, waiter] of [...this.waiting]) waiter.reject(new Error(`CDP ${reason}`));
      this.waiting.clear();
    };
    ws.addEventListener('close', () => drop('terputus'));
    ws.addEventListener('error', () => drop('galat koneksi'));
  }
  send(method, params = {}, sessionId, timeoutMs = 90000) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.waiting.delete(id)) reject(new Error(`${method} tidak menjawab dalam ${timeoutMs} ms`));
      }, timeoutMs);
      this.waiting.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
        method,
      });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

function compileCheck(expression) {
  try {
    new Function(`return (Promise.resolve(${expression}));`);
    return;
  } catch {
    /* coba sebagai statement */
  }
  try {
    new Function(expression);
  } catch (err) {
    throw new Error(`ekspresi tidak valid: ${err.message}\n${expression}`);
  }
}

const hasText = (text) =>
  `(() => !!document.body && document.body.innerText.includes(${JSON.stringify(text)}))()`;

// Satu perangkat = satu Chrome + satu tab, dengan pembantu UI yang sama.
async function makeDevice(label, cdpPort, width, navWhere, navLabels) {
  const profile = path.join(WORK, `chrome-${label}`);
  if (!CONNECT) {
    fs.rmSync(profile, { recursive: true, force: true });
    const chrome = spawn(
      CHROME,
      ['--headless=new', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run',
        '--no-default-browser-check', '--disable-gpu', '--mute-audio',
        // Tab yang sedang di latar dihukum Chrome dengan membatasi timer, dan
        // Firestore menjadwalkan aliran datanya lewat timer. Tanpa flag ini, kabar
        // pasangan bisa baru tampak 60+ detik kemudian — itu hukuman desktop, bukan
        // perilaku aplikasi. "HP tertutup" yang sesungguhnya tetap diuji lewat
        // visibilityState yang dipaksa hidden + notifikasi sistem.
        '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        'about:blank'],
      { stdio: 'ignore' }
    );
    children.push(chrome);
  }
  let cdp;
  for (let attempt = 0; attempt < 80 && !cdp; attempt++) {
    await sleep(400);
    try {
      const info = await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json();
      cdp = new Connection(new WebSocket(info.webSocketDebuggerUrl));
      await sleep(200);
    } catch {
      // Chrome masih menyala.
    }
  }
  if (!cdp) throw new Error(`Chrome ${label} tidak menjawab di port ${cdpPort}`);

  const dev = {
    label, cdp, sid: '', navWhere, navLabels,
    consoleLines: [], exceptions: [], warns: [], confirmations: [],
  };
  await cdp.send('Browser.grantPermissions', { origin: ORIGIN, permissions: ['notifications'] }).catch(() => undefined);
  let targetIdForAttach;
  if (CONNECT) {
    const list = await cdp.send('Target.getTargets');
    const page = list.targetInfos.find((t) => t.type === 'page' && String(t.url).startsWith(ORIGIN)) ||
      list.targetInfos.find((t) => t.type === 'page');
    if (!page) throw new Error(`Chrome ${label} tidak punya tab halaman`);
    targetIdForAttach = page.targetId;
  } else {
    targetIdForAttach = (await cdp.send('Target.createTarget', { url: 'about:blank' })).targetId;
  }
  const attached = await cdp.send('Target.attachToTarget', { targetId: targetIdForAttach, flatten: true });
  dev.sid = attached.sessionId;
  await cdp.send('Runtime.enable', {}, dev.sid);
  await cdp.send('Page.enable', {}, dev.sid);
  await cdp.send('Network.enable', {}, dev.sid);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 1024 }, dev.sid);

  // Tab pengalih: aplikasi sengaja MENAHAN notifikasi sistem saat jendelanya
  // terlihat (toast di layar sudah cukup). Untuk membuktikan notifikasi nyata,
  // tab aplikasi harus benar-benar background — sama seperti ponsel di kantong.
  dev.decoy = async (on) => {
    if (on) {
      dev.decoyId = (await cdp.send('Target.createTarget', { url: 'about:blank' })).targetId;
      await cdp.send('Target.activateTarget', { targetId: dev.decoyId }).catch(() => undefined);
      await sleep(1200);
      const real = await dev.t(`document.visibilityState`);
      if (real === 'hidden') return real;
      // Chrome headless kadang tetap melaporkan tab aplikasi 'visible' walau tab
      // lain aktif. Getter-nya dipaksa 'hidden' supaya kondisi "ponsel di kantong"
      // benar-benar ter uji, lalu dipulihkan saat decoy(off).
      await dev.t(`(() => { if (!window.__origVis) window.__origVis = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
        Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange')); return 'ok'; })()`);
      return `${await dev.t(`document.visibilityState`)} (disimulasikan)`;
    }
    if (dev.decoyId) {
      await dev.t(`(() => { if (window.__origVis) { Object.defineProperty(Document.prototype, 'visibilityState', window.__origVis); delete window.__origVis; } return 'ok'; })()`);
      await cdp.send('Target.closeTarget', { targetId: dev.decoyId }).catch(() => undefined);
      dev.decoyId = null;
      await sleep(800);
    }
    return dev.t(`document.visibilityState`);
  };

  cdp.onEvent = (method, params, sessionId) => {
    if (method === 'Page.javascriptDialogOpening') {
      dev.confirmations.push(params.message);
      cdp.send('Page.handleJavaScriptDialog', { accept: true }, sessionId).catch(() => undefined);
      return;
    }
    if (method === 'Runtime.exceptionThrown') {
      const d = params.exceptionDetails;
      dev.exceptions.push(d.exception ? String(d.exception.description || d.exception.value) : d.text);
      return;
    }
    if (method !== 'Runtime.consoleAPICalled') return;
    const text = (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    dev.consoleLines.push(`${params.type} ${text}`);
    if (params.type === 'error' || params.type === 'warning') dev.warns.push(text);
  };

  dev.t = (expression) => {
    compileCheck(expression);
    return cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, dev.sid).then((r) => {
      if (r.exceptionDetails) {
        const e = r.exceptionDetails.exception;
        throw new Error(`[${label}] evaluate: ${e ? e.description : r.exceptionDetails.text}`);
      }
      return r.result.value;
    });
  };
  dev.wait = async (expression, timeoutMs = 20000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let value;
      try {
        value = await dev.t(`Promise.resolve(${expression})`);
      } catch {
        value = false;
      }
      if (value) return true;
      if (Date.now() > deadline) return false;
      await sleep(350);
    }
  };
  dev.has = (text) => dev.t(hasText(text));
  dev.text = (text, ms) => dev.wait(hasText(text), ms);
  dev.body = () => dev.t(`document.body ? document.body.innerText.slice(0, 4000) : ''`);
  dev.go = async (url) => {
    await cdp.send('Page.navigate', { url }, dev.sid);
    await dev.wait(`location.href.startsWith(${JSON.stringify(ORIGIN)})`, 30000);
  };
  // Mengisi input/textarea/select terkendali React: setter native + event input/change.
  dev.fill = (locator, value) => dev.t(`(() => {
    const el = ${locator};
    if (!el) return 'TIDAK_ADA_ELEMEN';
    if (!el.tagName) return 'LOCATOR-BUKAN-ELEMEN';
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value;
  })()`);
  dev.click = (locatorExpr) => dev.t(`(() => { const el = ${locatorExpr}; if (!el) return 'TIDAK_ADA_TOMBOL'; el.click(); return 'ok'; })()`);
  // scope berupa selector CSS wadah (mis. '[role="dialog"]'), bukan ekspresi JS.
  // Digabung sebagai keturunan, jadi pencarian di dalam dialog yang belum muncul
  // mengembalikan tombol kosong alih-alih merusak evaluasi.
  const buttons = (css) => `document.querySelectorAll(${JSON.stringify(css ? `${css} button` : 'button')})`;
  dev.byText = (text, css) =>
    `[...${buttons(css)}].find(b => b.textContent.trim() === ${JSON.stringify(text)})`;
  dev.byIncludes = (text, css) =>
    `[...${buttons(css)}].find(b => b.textContent.includes(${JSON.stringify(text)}))`;
  dev.byAria = (label, css) =>
    `[...${buttons(css)}].find(b => (b.getAttribute('aria-label')||'') === ${JSON.stringify(label)})`;
  dev.clickText = (text, css) => dev.click(dev.byText(text, css));
  dev.clickIncludes = (text, css) => dev.click(dev.byIncludes(text, css));
  dev.clickAria = (label, css) => dev.click(dev.byAria(label, css));
  // window.confirm sudah diganti dialog in-app, jadi tombol 'Ya'-nya ditekan lewat DOM.
  dev.askYes = async (label) => {
    const ada = await dev.wait(`!!document.querySelector('[role="alertdialog"]')`, 8000);
    if (!ada) return 'TANPA-DIALOG-KONFIRMASI';
    const locator = label
      ? `[...document.querySelectorAll('[role="alertdialog"] button')].find(b => b.textContent.trim().toLowerCase().includes(${JSON.stringify(String(label).toLowerCase())}))`
      : `[...document.querySelectorAll('[role="alertdialog"] button')][0]`;
    return dev.click(locator);
  };
  dev.esc = () => dev.t(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); 'ok'`);
  dev.dlg = (text, ms = 15000) => dev.wait(`(() => { const d = document.querySelector('[role="dialog"]');
    if (!d) return false;
    return ((d.getAttribute('aria-label') || '') + ' ' + d.innerText).toLowerCase().includes(${JSON.stringify(String(text).toLowerCase())});
  })()`, ms);
  // Semua [role="alert"] yang terlihat — peringatan sinkron selalu muncul di sini.
  dev.alerts = () => dev.t(`[...document.querySelectorAll('[role="alert"]')].map(x => x.innerText.replace(/\\s+/g, ' ')).join(' | ')`);
  // Modal yang tertinggal dari fase sebelumnya bisa menutupi fase berikutnya.
  dev.closeDialogs = async () => {    for (let i = 0; i < 5; i++) {
      const open = await dev.t(`document.querySelectorAll('[role="dialog"]').length`);
      if (!open) return true;
      await dev.esc();
      await sleep(250);
    }
    return (await dev.t(`document.querySelectorAll('[role="dialog"]').length`)) === 0;
  };
  dev.gotoTab = async (id) => {
    const clicked = await dev.click(dev.byText(dev.navLabels[id], dev.navWhere));
    const ok = await dev.wait(`(() => { const el = document.querySelector(${JSON.stringify(dev.navWhere)});
      return !!el && [...el.querySelectorAll('button')].some(b => b.getAttribute('aria-current') === 'page' && b.textContent.trim() === ${JSON.stringify(dev.navLabels[id])}); })()`, 15000);
    // View dipasang lewat lazy import: aria-current sudah berubah tapi isinya
    // masih fallback Suspense. Tunggu sampai <main> benar-benar terisi.
    const rendered = await dev.wait(`(() => { const m = document.querySelector('main'); return !!m && m.innerText.trim().length > 40; })()`, 25000);
    return clicked === 'ok' && ok && rendered;
  };
  dev.state = () => dev.t(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1') || '{}');
    return { coupleId: (s.couple && s.couple.id) || '', user1: (s.couple && s.couple.user1Id) || '', user2: (s.couple && s.couple.user2Id) || '',
      xp: s.couple ? s.couple.levelXp : null, decor: s.couple ? (s.couple.unlockedDecorations || []).length : -1,
      weather: s.couple ? s.couple.selectedWeather : '', habits: (s.habits || []).length, logs: (s.logs || []).length,
      reactions: (s.reactions || []).length, books: (s.books || []).length, journals: (s.journals || []).length,
      checkins: (s.checkins || []).length, agreements: (s.agreements || []).length }; } catch (e) { return { err: String(e) }; } })()`);
  dev.xpNow = () => dev.t(`(() => { const el = document.querySelector('[aria-label="Progres XP menuju level berikutnya"]');
    return el ? Number(el.getAttribute('aria-valuenow')) : -1; })()`);
  dev.srOnly = () => dev.t(`[...document.querySelectorAll('.sr-only')].map(e => e.textContent).join(' | ').slice(0, 1200)`);
  // Diagnosis: perangkat sedang di tab mana + sub-tab apa saja yang tersedia.
  dev.where = () => dev.t(`(() => {
      const nav = document.querySelector(${JSON.stringify(navWhere)});
      const active = nav ? [...nav.querySelectorAll('button')].filter(b => b.getAttribute('aria-current') === 'page').map(b => b.textContent.trim()).join(',') : 'TANPA_NAV';
      const sub = [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim()).join(',');
      const head = [...document.querySelectorAll('h1,h2,h3')].slice(0, 3).map(x => x.textContent.trim()).join(' / ');
      return JSON.stringify({ url: location.pathname + location.search, active, subtabs: sub, headings: head });
    })()`);
  return dev;
}

// Kedua nav (header desktop & bottom mobile) memakai aria-label yang sama
// "Navigasi utama", jadi wadah harus dibedakan lewat kelas breakpoint-nya,
// kalau tidak perangkat 620px diam-diam mengklik tombol header yang tersembunyi.
const DEV_A = { key: 'A', port: 9337, width: 1280, navWhere: 'nav[aria-label="Navigasi utama"][class*="lg:flex"]', navLabels: { today: 'Hari Ini', timer: 'Timer Fokus', agreements: 'Kesepakatan', couple: 'Pasangan', progress: 'Progres', garden: 'Taman' } };
const DEV_B = { key: 'B', port: 9338, width: 620, navWhere: 'nav[aria-label="Navigasi utama"][class*="lg:hidden"]', navLabels: { today: 'Hari Ini', timer: 'Timer', agreements: 'Sanksi', couple: 'Kita', progress: 'Progres', garden: 'Taman' } };

let A;
let B;
let f;
let dbAdmin;
let testEnv;

async function seedFresh(dev, tabQuery) {
  await dev.go(`${ORIGIN}/`);
  await dev.t(`localStorage.setItem('gt_visited_v1','true'); localStorage.setItem('gt_demo_mode','false'); 'ok'`);
  await dev.go(`${ORIGIN}/${tabQuery || ''}`);
}

async function openSettings(dev, tabName) {
  await dev.wait(`!!(${dev.byAria('Buka pengaturan pasangan dan profil')})`, 20000);
  await dev.clickAria('Buka pengaturan pasangan dan profil');
  const up = await dev.text('Pengaturan pasangan', 20000);
  if (up && tabName) {
    await dev.wait(`!!document.querySelector('[role="dialog"] button[role="tab"]')`, 15000);
    await dev.click(`[...document.querySelectorAll('[role="dialog"] button[role="tab"]')].find(b => b.textContent.includes(${JSON.stringify(tabName)}))`);
  }
  return up;
}
async function closeSettings(dev) {
  await dev.clickAria('Tutup pengaturan', `[role="dialog"]`);
  await sleep(300);
}

// Beda paling penting saat sebuah tulisan tidak sampai ke server: aturan yang
// MENOLAK, atau hanya lambat. Aplikasi mencatat keduanya di panel Sinkronisasi,
// jadi baca dari sana alih-alih menebak.
async function syncTrail(dev) {
  await openSettings(dev, 'Sinkronisasi');
  const rows = await dev.t(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return 'TANPA-DIALOG';
    const h = [...d.querySelectorAll('h4')].find((x) => x.textContent.includes('Log aktivitas sinkron'));
    if (!h) return 'TANPA-PANEL-LOG';
    return h.parentElement.parentElement.innerText.replace(/\\s+/g, ' ').trim().slice(0, 700); })()`);
  await closeSettings(dev);
  return rows;
}

async function findUserBy(name) {
  const snap = await f.getDocs(f.collection(dbAdmin, 'users'));
  return snap.docs.find((d) => (d.data().displayName || '') === name);
}

// Saksi independen untuk tulisan yang "tidak sampai": REST emulator membaca isi
// database tanpa SDK klien dan tanpa aturan, jadi ia bisa membedakan "browser
// tidak pernah mengirim" dari "pembacaan tes yang sedang basi".
const nilaiRest = (v) => {
  if (!v || typeof v !== 'object') return '';
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('nullValue' in v) return null;
  if (v.mapValue) {
    return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, nilaiRest(x)]));
  }
  if (v.arrayValue) return (v.arrayValue.values || []).map(nilaiRest);
  return JSON.stringify(v);
};
function restDocs(collection) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 8899,
        method: 'GET',
        path: `/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?pageSize=300`,
        headers: { authorization: 'Bearer owner' },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            const docs = (JSON.parse(body).documents || []).map((d) => {
              const fields = d.fields || {};
              const out = { id: d.name.split('/').pop() };
              for (const [k, v] of Object.entries(fields)) out[k] = nilaiRest(v);
              return out;
            });
            resolve({ docs });
          } catch (err) {
            resolve({ err: String(err.message || err).slice(0, 120), body: body.slice(0, 160) });
          }
        });
      }
    );
    req.on('error', (err) => resolve({ err: String(err.message || err).slice(0, 120) }));
    req.end();
  });
}

const phases = [];
function phase(name, fn) {
  phases.push({ name, fn });
}

// Rumus pelengkap pohon diambil dari src apa adanya (esbuild hanya melepas tipe).
// Harness sengaja tidak punya dugaan sendiri tentang ambangnya: kalau rumusnya
// berubah, uji di bawah ikut berubah, bukan diam-diam menuduh aplikasi salah.
let treeCraftMod = null;
function tree() {
  if (!treeCraftMod) {
    const source = fs.readFileSync(`${REPO}/src/lib/treeCraft.ts`, 'utf8');
    const { transformSync } = require('esbuild');
    const js = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
    fs.mkdirSync(WORK, { recursive: true });
    const file = path.join(WORK, 'treeCraft.harness.cjs');
    const mod = new Module(file, null);
    mod.filename = file;
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    mod._compile(js, file);
    treeCraftMod = mod.exports;
  }
  return treeCraftMod;
}

// dev.wait hanya mengembalikan true/false. Perayaan pelukan menutup dirinya sendiri
// setelah 9 detik, jadi isinya harus ditangkap pada saat yang sama dengan
// keberadaannya — bukan dibaca setelahnya.
async function pollValue(dev, expression, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  for (;;) {
    try {
      last = await dev.t(expression);
      if (last) return last;
    } catch {
      last = 'EVALUATE-GAGAL';
    }
    if (Date.now() > deadline) return last;
    await sleep(400);
  }
}

// -----------------------------------------------------------------------------
phase('masuk & pasangan', async () => {
  check('perangkat A membuka layar kode ruang', await A.text('Masuk dengan Kode Ruang', 40000));
  check('perangkat B membuka layar kode ruang', await B.text('Masuk dengan Kode Ruang', 40000));
  const marker = await A.t(`(() => { const m = document.body.innerText.match(/GrowTogether v[\\d.]+/); return m ? m[0] : ''; })()`);
  check(`penanda versi di layar masuk = v${APP_VERSION}`, marker === `GrowTogether v${APP_VERSION}`, marker);

  // A membuat ruang.
  const nameA = await A.fill(`document.querySelector('#room-display-name')`, 'Rafi');
  check('A bisa mengetik namanya sendiri', nameA === 'Rafi', nameA);
  const createBtn = await A.clickText('Buat Ruang Baru');
  const roomA = await A.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !!(s.couple && s.couple.id); } catch { return false; } })()`, 40000);
  check('A membuat ruang dan masuk ke dalamnya', createBtn === 'ok' && roomA, { createBtn, roomA });

  let userA = null;
  const profileDeadline = Date.now() + 40000;
  while (Date.now() < profileDeadline && !userA) {
    userA = await findUserBy('Rafi');
    if (!userA) await sleep(1000);
  }
  check('profil A tercatat di server dengan uid anonim', !!userA, userA && userA.id.slice(0, 12));
  if (!userA) throw new Error('tanpa profil A tidak ada ruang yang bisa dilacak');
  const uidA = userA.id;
  const coupleId = userA.data().coupleId;
  const roomDoc = (await f.getDoc(f.doc(dbAdmin, 'couples', coupleId))).data();
  const code = roomDoc.roomCode;
  check('ruang A punya kode ruang 4-12 karakter', /^[A-Z0-9]{4,12}$/.test(String(code || '')), code);
  check('slot kedua ruang A masih kosong', !roomDoc.user2Id, roomDoc.user2Id || 'kosong');
  A.uid = uidA; A.coupleId = coupleId; A.code = code;

  // B mencoba kode salah dulu — pesan kesalahan harus muncul, bukan diam-diam.
  const nameB = await B.fill(`document.querySelector('#room-display-name')`, 'Shinta');
  check('B bisa mengetik namanya sendiri', nameB === 'Shinta', nameB);
  const wrongFill = await B.fill(`document.querySelector('#partner-room-code')`, 'ZZZZ99');
  check('B bisa mengetik kode ruang', wrongFill === 'ZZZZ99', wrongFill);
  const btnReady = () => B.wait(`(() => { const b = [...document.querySelectorAll('button')]
      .find(x => x.textContent.trim() === 'Gabung Sekarang'); return !!b && !b.disabled; })()`, 25000);
  const wrongClick = await B.click(B.byText('Gabung Sekarang'));
  await btnReady();
  const wrongAlertOk = await B.text('tidak dikenali', 20000);
  const wrongAlert = await B.t(`(() => { const p = [...document.querySelectorAll('[role="alert"]')].map(x => x.textContent).join(' | '); return p; })()`);
  check('kode salah menghasilkan pesan yang terbaca di layar', wrongAlertOk && /tidak dikenali/i.test(wrongAlert), { wrongClick, wrongAlert });

  // B bergabung dengan kode benar.
  const rightFill = await B.fill(`document.querySelector('#partner-room-code')`, code);
  check('B mengetik kode ruang milik A', rightFill === code, rightFill);
  const readyAgain = await btnReady();
  const joinClick = await B.click(B.byText('Gabung Sekarang'));
  // couple.id di snapshot lokal B dibaca dulu, baru dibandingkan — kalau tidak
  // sama, detailnya harus menunjukkan kedua sisi, bukan cuma 'false'.
  const localCoupleId = () => B.t(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}');
    return (s.couple && s.couple.id) || 'KOSONG'; } catch { return 'BACA-GAGAL'; } })()`);
  let inRoomB = false;
  let seenIdB = '';
  const roomDeadline = Date.now() + 45000;
  while (Date.now() < roomDeadline) {
    seenIdB = await localCoupleId();
    if (seenIdB === coupleId) { inRoomB = true; break; }
    await sleep(1000);
  }
  check('B masuk ke ruang yang sama dengan A', inRoomB, {
    readyAgain, joinClick, idDiServer: coupleId, idDiLokalB: seenIdB, state: await B.state(),
  });
  if (!inRoomB) throw new Error(`B tidak masuk ruang — layar B: ${JSON.stringify((await B.body()).slice(0, 600))}`);
  let userB = await findUserBy('Shinta');
  const bDeadline = Date.now() + 30000;
  while (Date.now() < bDeadline && !userB) {
    await sleep(1000);
    userB = await findUserBy('Shinta');
  }
  B.uid = userB ? userB.id : '';
  B.coupleId = coupleId;
  check('dua uid berbeda benar-benar dua perangkat', !!B.uid && B.uid !== uidA, { uidA: uidA.slice(0, 10), uidB: (B.uid || '').slice(0, 10) });

  const fresh = (await f.getDoc(f.doc(dbAdmin, 'couples', coupleId))).data();
  check('server menyimpan kedua anggota ruang', fresh.user1Id === uidA && fresh.user2Id === B.uid, { u1: !!fresh.user1Id, u2: !!fresh.user2Id });

  // Nama pasangan harus muncul di layar sebelah (sumber: dokumen profil pasangan).
  const goCoupleA = await A.gotoTab('couple');
  const goCoupleB = await B.gotoTab('couple');
  await A.text('Kode Pasangan', 25000);
  await B.text('Kode Pasangan', 25000);
  const subA = await A.clickText('Kode Pasangan');
  const subB = await B.clickText('Kode Pasangan');
  const shown = await A.wait(`(() => { const t = document.body.innerText.toUpperCase();
    return t.includes('KODE RUANG INI') && t.includes(${JSON.stringify(String(code).toUpperCase())}); })()`, 20000);
  check('tab Kode Pasangan menampilkan kode yang sama dengan server', shown, { subA, subB, whereA: await A.where(), code });
  const pairedA = await A.text('Kalian sudah terhubung', 15000);
  const pairedB = await B.text('Kalian sudah terhubung', 15000);
  check('panel pasangan mengonfirmasi sudah terhubung di kedua perangkat', pairedA && pairedB,
    { pairedA, pairedB, goCoupleA, goCoupleB, subA, subB, whereB: await B.where() });
  const seesB = await A.has('Shinta');
  const seesA = await B.has('Rafi');
  check('A melihat nama pasangan dari perangkat lain', seesB, await A.body());
  check('B melihat nama pasangan dari perangkat lain', seesA, await B.body());
  await A.gotoTab('today');
  await B.gotoTab('today');
});

phase('habit & privasi di dua layar', async () => {
  const addHabit = async (dev, title, minutes, isPrivate) => {
    await dev.gotoTab('today');
    const opened = await dev.clickText('Tambah habit');
    const dlg = await dev.text('Buat habit baru', 15000);
    if (opened !== 'ok' || !dlg) return { opened, dlg };
    await dev.fill(`document.querySelector('#habit-title')`, title);
    await dev.fill(`document.querySelector('#habit-minutes')`, minutes);
    if (isPrivate) {
      await dev.click(`[...document.querySelectorAll('[role="dialog"] label')].find(l => l.textContent.includes('Privat (hanya kamu'))`);
    }
    const saved = await dev.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')].find(b => b.textContent.includes('Simpan habit'))`);
    let bukti = null;
    if (saved !== 'ok') {
      bukti = await dev.t(`(() => ({ dialog: document.querySelectorAll('[role="dialog"]').length, tombol: [...document.querySelectorAll('[role="dialog"] button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()).slice(0, 12), alert: [...document.querySelectorAll('[role="alert"]')].map(a => a.innerText.replace(/\\s+/g, ' ')).join(' | '), teks: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200) }))()`);
    }
    return { opened, dlg, saved, bukti };
  };

  const pub = await addHabit(A, 'Olahar Pagi QA', 20, false);
  check('A menyimpan habit bersama lewat dialog', pub.saved === 'ok', pub);
  const priv = await addHabit(A, 'Curhat Pagi QA', 0, true);
  check('A menyimpan habit privat lewat dialog', priv.saved === 'ok', priv);

  const seenOnB = await B.text('Olahar Pagi QA', 30000);
  check('habit bersama muncul di layar B tanpa reload', seenOnB, await B.state());
  await sleep(2500);
  const leakOnB = await B.has('Curhat Pagi QA');
  const stillOnA = await A.has('Curhat Pagi QA');
  check('habit privat TIDAK muncul di layar B', !leakOnB && stillOnA, { bocorDiB: leakOnB, tampilDiA: stillOnA });

  // Kebalikan: habit milik B juga terlihat oleh A.
  await addHabit(B, 'Baca Malam QA', 15, false);
  const bSeenOnA = await A.text('Baca Malam QA', 30000);
  check('habit bersama milik B muncul di layar A', bSeenOnA);

  await openSettings(B, 'Sinkronisasi');
  const counts = await B.t(`(() => { const rows = [...document.querySelectorAll('[role="dialog"] [role="tabpanel"] div')].map(d => d.textContent);
    const find = (label) => { const el = [...document.querySelectorAll('[role="dialog"] *')].filter(n => n.children.length === 0).find(n => n.textContent.trim() === label);
      return el ? (el.nextElementSibling ? el.nextElementSibling.textContent.trim() : '') : ''; };
    return { pasangan: find('Pasangan'), terlihat: find('Habit pasangan yang terlihat') }; })()`);
  await closeSettings(B);
  check('tabel Sinkronisasi B menyebut pasangan + habit yang terlihat', /Rafi/.test(counts.pasangan || '') && Number(counts.terlihat) >= 1, counts);

  // Habit "bersama" memang bisa disentuh pasangan; yang harus dijamin adalah centang
  // B hanya mencatat penyelesaian B, tidak pernah menyelesaikan habit milik A.
  await B.gotoTab('today');
  await A.gotoTab('today');
  const tickOnB = await B.click(`[...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('Tandai selesai: Olahar Pagi QA'))`);
  const bMarked = await B.wait(`(() => { const b=[...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('Batalkan: Olahar Pagi QA')); return !!b; })()`, 20000);
  await sleep(3000);
  const aStillUntouched = await A.t(`(() => { const b=[...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').includes('Tandai selesai: Olahar Pagi QA')); return b ? 'belum-sentuh' : 'sudah-sentuh'; })()`);
  // Tulisan berjalan di latar belakang, jadi membaca sekali pada detik ke-3 hanya
  // akan menuduh latensi. Saksinya REST emulator (bukan SDK tes yang bisa basi),
  // dan kalau baris B tidak pernah muncul, jejak sinkron B mencatat sebabnya.
  const ringkas = (d) => ({ id: d.id, userId: (d.userId || '').slice(0, 8), coupleId: (d.coupleId || '').slice(0, 22), vis: d.visibility, selesai: d.completed });
  let restLog = { docs: [], err: 'belum-baca' };
  const lDeadline = Date.now() + 30000;
  for (;;) {
    restLog = await restDocs('logs');
    if (restLog.err || (restLog.docs || []).some((d) => d.userId === B.uid)) break;
    if (Date.now() > lDeadline) break;
    await sleep(2000);
  }
  const barisB = restLog.err ? [] : restLog.docs.filter((d) => d.userId === B.uid);
  const barisA = restLog.err ? [] : restLog.docs.filter((d) => d.userId === A.uid);
  const sdkB = restLog.err ? 'n/a' : (await f.getDocs(f.query(f.collection(dbAdmin, 'logs'),
    f.where('coupleId', '==', A.coupleId), f.where('userId', '==', B.uid)))).docs.length;
  const jejakB = barisB.length ? '' : await syncTrail(B);
  check('centang B atas habit bersama hanya menyelesaikan milik B, bukan milik A',
    tickOnB === 'ok' && bMarked && aStillUntouched === 'belum-sentuh' && barisA.length === 0 && barisB.length >= 1,
    { tickOnB, bMarked, aStillUntouched, logA: barisA.length, logB: barisB.length,
      restErr: restLog.err || null, semuaLog: (restLog.docs || []).map(ringkas).slice(0, 8), sdkTahuBaris: sdkB, jejakSinkronB: jejakB });
});

phase('XP, streak, dan reaksi', async () => {
  await A.gotoTab('today');
  // Penulisan ke server berjalan di latar belakang, jadi angka dasar baru boleh
  // diambil setelah layar A, layar B, dan server menunjukkan angka yang sama.
  const xpTiga = async () => {
    const a = await A.xpNow();
    const b = await B.xpNow();
    const srvRaw = (await f.getDoc(f.doc(dbAdmin, 'couples', A.coupleId))).data().levelXp;
    return { a, b, srv: srvRaw % 200, srvRaw };
  };
  const xpSettle = async () => {
    const batas = Date.now() + 30000;
    for (;;) {
      const x = await xpTiga();
      if (x.a === x.b && x.a === x.srv) return { ...x, setimbang: true };
      if (Date.now() > batas) return { ...x, setimbang: false };
      await sleep(700);
    }
  };
  const dasar = await xpSettle();
  const before = dasar.a;
  const target = (before + 10) % 200;
  check('XP layar A = layar B = server sebelum uji', dasar.setimbang, dasar);
  await A.click(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Tandai selesai: Olahar Pagi QA')`);
  const afterA = await A.wait(`(() => { const el = document.querySelector('[aria-label="Progres XP menuju level berikutnya"]'); return el && Number(el.getAttribute('aria-valuenow')) === ${target}; })()`, 25000);
  const afterB = await B.wait(`(() => { const el = document.querySelector('[aria-label="Progres XP menuju level berikutnya"]'); return el && Number(el.getAttribute('aria-valuenow')) === ${target}; })()`, 25000);
  check('selesai 1 habit = +10 XP dan muncul di kedua perangkat', afterA && afterB, { before, afterA: await A.xpNow(), afterB: await B.xpNow() });
  const konvergen = await xpSettle();
  check('XP yang tampil di layar = XP di server', konvergen.setimbang && konvergen.a === target, { konvergen, before, target });

  const undoClick = await A.click(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Batalkan: Olahar Pagi QA')`);
  const undoA = await A.wait(`(() => { const el = document.querySelector('[aria-label="Progres XP menuju level berikutnya"]'); return el && Number(el.getAttribute('aria-valuenow')) === ${before}; })()`, 25000);
  const undoB = await B.wait(`(() => { const el = document.querySelector('[aria-label="Progres XP menuju level berikutnya"]'); return el && Number(el.getAttribute('aria-valuenow')) === ${before}; })()`, 25000);
  const balik = await xpSettle();
  check('batal habit mengurangi XP di kedua perangkat', undoClick === 'ok' && undoA && undoB && balik.setimbang && balik.a === before, {
    undoClick, balik, before,
  });

  // Streak gabungan: kedua log (A dan B) dihitung, kedua layar harus angka sama.
  await A.click(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Tandai selesai: Olahar Pagi QA')`);
  await B.click(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Tandai selesai: Baca Malam QA')`);
  await sleep(2500);
  const garden = async (dev) => {
    await dev.gotoTab('garden');
    await dev.clickText('2D Aksesibel');
    const ok = await dev.text('Hari Streak', 20000);
    const n = await dev.t(`document.body ? ((document.body.innerText.match(/(\\d+)\\s*Hari Streak/) || ['',''])[1]) : ''`);
    return { ok, n };
  };
  const gA = await garden(A);
  const gB = await garden(B);
  check('taman 2D terbuka di kedua perangkat', gA.ok && gB.ok, { gA, gB });
  check('streak A dan B sama (satu hari bersama)', gA.n === gB.n && Number(gA.n) >= 1, { a: gA.n, b: gB.n });

  // Reaksi: kirim dari A, harus sampai ke B lewat server + notifikasi lokal.
  // Reaksi sengaja tidak ikut disimpan di localStorage (server satu-satunya sumber),
  // jadi buktinya dokumen server + angka di panel Sinkronisasi, bukan gt_state_v1.
  await A.gotoTab('today');
  // Tab B dilatarbelakangi lebih dulu: aplikasi sengaja tidak melepas notifikasi
  // sistem ketika jendelanya sedang terlihat, jadi inilah kondisi ponsel sungguhan.
  const visBefore = await B.decoy(true);
  const sentA = await A.clickAria('Kirim reaksi ❤️');
  check('A bisa mengirim reaksi', sentA === 'ok');

  // Sisi pengirim: mengirim kabar harus TERLIHAT pergi dari tangan, bukan cuma
  // tombol berkedip. Ledakan + status "Terkirim" adalah umpan yang bikin kirim lagi.
  const burstChip = await pollValue(A, `(() => { const b = document.querySelector('[data-hug-burst]');
    return b ? b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 120) : ''; })()`, 20000);
  check('pengirim melihat ledakan pelukan + status terkirim', /Terkirim|Dibuka/.test(String(burstChip)), { burstChip });

  // Sisi penerima: kabar harus jadi perayaan layar penuh, bukan toast 3 detik.
  // Perayaan ditangkap bersamaan dengan loop server karena emulator bisa butuh
  // 15-20 detik untuk satu bolak-balik tulis; kalau menunggu dokumen dulu,
  // perayaannya sudah menutup diri sebelum sempat dilihat.
  const [capB, reaksiServer] = await Promise.all([
    pollValue(B, `(() => { const c = document.querySelector('[data-hug-celebration]'); if (!c) return '';
      const badge = document.querySelector('[data-nav-badge]');
      return JSON.stringify({ teks: c.innerText.replace(/\\s+/g, ' ').trim().slice(0, 200),
        badge: badge ? badge.getAttribute('data-nav-badge') : 'tanpa' }); })()`, 70000),
    (async () => {
      // Reaksi sengaja tidak ikut disimpan di localStorage (server satu-satunya
      // sumber), jadi buktinya dokumen server, bukan gt_state_v1.
      const deadline = Date.now() + 70000;
      for (;;) {
        const docs = (await f.getDocs(f.query(f.collection(dbAdmin, 'reactions'),
          f.where('coupleId', '==', A.coupleId)))).docs;
        if (docs.some((d) => d.data().senderId === A.uid) || Date.now() > deadline) return docs;
        await sleep(1500);
      }
    })(),
  ]);
  const capBJson = (() => { try { return JSON.parse(capB); } catch { return { teks: String(capB), badge: 'tangkap-gagal' }; } })();
  check('B mendapat perayaan layar penuh berisi kabar pasangan', /Rafi mengirim pelukan/.test(capBJson.teks), { capB });
  check('tab "Kita" di perangkat B diberi titik kabar belum dibuka', Number(capBJson.badge) >= 1, { badge: capBJson.badge });
  check('reaksi A tersimpan di server ruang', reaksiServer.some((d) => d.data().senderId === A.uid), {
    jumlah: reaksiServer.length,
    pengirim: reaksiServer.map((d) => (d.data().senderId || '').slice(0, 8)),
  });

  // Tanda baca: penerima menulis seenAt, jadi pengirim tahu pelukannya benar-benar
  // dibuka — dan kalau tidak, itu bukan salah aplikasinya tapi salah izin HP.
  // Tanda baca: saksi REST juga, supaya yang diukur adalah isi database dan bukan
  // cache klien tes.
  let openedAt = '';
  let reDocs = [];
  let reErr = null;
  // Tanda baca ditulis di latar belakang tanpa menunggu akui server, jadi di mesin
  // yang sedang penuh ia bisa butuh lebih dari semenit. Yang diuji di sini adalah
  // "tanda baca akhirnya tercatat", jadi tunggu sampai konvergen — bukan dipercepat.
  const oDeadline = Date.now() + 150000;
  while (Date.now() < oDeadline && !openedAt) {
    const res = await restDocs('reactions');
    reErr = res.err || null;
    reDocs = (res.docs || []).map((d) => ({ id: d.id, pengirim: (d.senderId || '').slice(0, 8), penerima: (d.receiverId || '').slice(0, 8), emoji: d.emoji, adaSeenAt: !!d.seenAt }));
    const punyaA = (res.docs || []).find((d) => d.senderId === A.uid);
    openedAt = punyaA ? String(punyaA.seenAt || '') : '';
    if (!openedAt) await sleep(1500);
  }
  const jejakSeen = openedAt ? '' : await syncTrail(B);
  check('perangkat B mencatat tanda baca "sudah dibuka" di server', !!openedAt,
    openedAt || { alasan: 'belum ada seenAt', restErr: reErr, reaksiDiServer: reDocs.slice(0, 6), idB: (B.uid || '').slice(0, 8), jejakSinkronB: jejakSeen });
  const chipDibuka = await A.wait(`(() => { const b = document.querySelector('[data-hug-burst]');
    return !!b && b.innerText.includes('Dibuka pasanganmu'); })()`, 70000);
  check('layar pengirim berubah menjadi "Dibuka pasanganmu"', chipDibuka, { chip: await A.t(`(() => { const b = document.querySelector('[data-hug-burst]'); return b ? b.innerText.replace(/\\s+/g, ' ').trim() : 'TANPA-BURST'; })()`) });
  await openSettings(B, 'Sinkronisasi');
  const readReCount = () => B.t(`(() => { const el = [...document.querySelectorAll('[role="dialog"] *')].filter(n => n.children.length === 0)
      .find(n => n.textContent.trim() === 'Reaksi tersinkron');
    return el && el.nextElementSibling ? el.nextElementSibling.textContent.trim() : 'TIDAK_ADA_BARIS'; })()`);
  // Dibaca berulang sampai 30 detik: kalau angka akhirnya naik, yang tadi cuma
  // latensi listener; kalau tetap 0 padahal server sudah punya dokumennya, itu cacat.
  let reCount = await readReCount();
  const cDeadline = Date.now() + 30000;
  while (Date.now() < cDeadline && !(Number(reCount) >= 1)) {
    await sleep(2000);
    reCount = await readReCount();
  }
  // Semua angka panel Sinkronisasi B sekaligus, supaya ketahuan apakah hanya
  // reaksi yang kosong atau seluruh listener server di perangkat B.
  const tableB = await B.t(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return 'TANPA-DIALOG';
    return [...d.querySelectorAll('*')].filter(n => n.children.length === 0 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ~ ').slice(0, 900); })()`);
  await closeSettings(B);
  check('perangkat B membaca reaksi pasangan dari server', Number(reCount) >= 1, {
    reCount, sentA, tableB, idLokalB: await B.t(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return (s.couple && s.couple.id) || 'KOSONG'; } catch { return 'BACA-GAGAL'; } })()`),
  });
  let notifB = '';
  const nDeadline = Date.now() + 30000;
  while (Date.now() < nDeadline) {
    notifB = await B.t(`(async () => { if (!('serviceWorker' in navigator)) return 'no-sw'; const r = await navigator.serviceWorker.getRegistration(); if (!r) return 'no-reg'; const l = await r.getNotifications(); return l.length + '|' + (l[0] ? l[0].title + '::' + l[0].body : '') + '|izin=' + Notification.permission; })()`);
    if (!/^0\|/.test(String(notifB))) break;
    await sleep(1500);
  }
  // Kalau halaman sedang terlihat, aplikasi sengaja memakai toast alih-alih
  // notifikasi — jadi kondisi visibilitas ikut dicatat supaya tidak salah vonis.
  const visB = await B.t(`(() => document.visibilityState + '/focus=' + document.hasFocus())()`);
  check('perangkat B benar-benar menampilkan notifikasi reaksi', !/^(0\||no-)/.test(String(notifB)), { notifB, visB, visBSaatKirim: visBefore });
  // Tab aplikasi harus kembali ke depan sebelum fase berikutnya.
  const visPulih = await B.decoy(false);
  console.log(`DIAG tab B dipulihkan=${JSON.stringify(visPulih)}`);
});

// Pelukan/semangat adalah alasan orang membuka aplikasi lagi. Fase ini membuktikan
// seluruh lingkarannya: kirim -> perayaan -> tanda baca -> balasan -> kabar yang
// tetap sampai walau HP pasangannya sedang tertutup.
phase('pelukan: balasan & kabar tertinggal', async () => {
  const goCouple = await A.gotoTab('couple');
  const chipUp = await A.text('Kirim Pelukan', 25000);
  check('layar pasangan punya tombol pelukan', goCouple && chipUp, { goCouple, chipUp, where: await A.where() });

  const counter = await A.t(`(() => { const m = document.body.innerText.match(/(\\d+)\\s*hari ini/); return m ? m[1] : ''; })()`);
  check('pengirim dihitung sudah mengirim berapa pelukan hari ini', Number(counter) >= 1, { counter });

  const gateAbsen = await A.t(`!!document.querySelector('[data-notif-gate]')`);
  check('gerbang izin notifikasi tidak muncul lagi setelah izin granted', gateAbsen === false, { gateAbsen });

  const channelCard = await (async () => {
    await openSettings(A, 'Notifikasi');
    // Kirim notifikasi contoh lewat tombol resmi: kalau saluran ini benar-benar
    // bisa dipakai, jejak pengiriman harus mencatat hasilnya.
    const dites = await A.click(A.byText('Kirim notifikasi contoh', '[role="dialog"]'));
    await sleep(3000);
    const rows = await A.t(`(() => { const d = document.querySelector('[data-notif-channel]');
      return d ? d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 600) : 'TANPA-KARTU-SALURAN'; })()`);
    const log = await A.t(`(() => { const d = document.querySelector('[data-notif-log]');
      return d ? d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 400) : 'TANPA-JEJAK'; })()`);
    const pushCard = await A.t(`(() => { const d = document.querySelector('[data-notif-push]');
      return d ? d.getAttribute('data-notif-push') + '::' + d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 300) : 'TANPA-KARTU-PUSH'; })()`);
    const pushApi = await A.t(`'PushManager' in navigator`);
    await closeSettings(A);
    return { dites, rows, log, pushCard, pushApi };
  })();
  check(
    'pengaturan menjelaskan kanal push apa adanya di tabel saluran',
    /Alamat perangkat terdaftar di server push/.test(channelCard.rows)
      && /Kabar saat HP tertutup/.test(channelCard.rows)
      && !/belum — perlu pengirim push dari server/.test(channelCard.rows),
    channelCard.rows
  );
  check('tes notifikasi tercatat di jejak pengiriman perangkat', channelCard.dites === 'ok' && channelCard.log !== 'TANPA-JEJAK', { dites: channelCard.dites, log: channelCard.log });

  // Kartu push: perangkat harus sudah menyerahkan alamatnya ke server, atau
  // mengatakan kenapa belum. Alamat yang benar-benar terdaftar harus terbaca di
  // Firestore dengan bentuk yang dipakai fungsi pengirim (ownerId + keys + prefs).
  let subDocs = [];
  const subDeadline = Date.now() + 30000;
  while (Date.now() < subDeadline) {
    const docs = (await f.getDocs(f.query(f.collection(dbAdmin, 'pushSubscriptions'),
      f.where('ownerId', '==', A.uid)))).docs;
    subDocs = docs.map((d) => {
      const data = d.data();
      return {
        service: String(data.endpoint || '').replace(/^https:\/\//, '').slice(0, 34),
        kunci: !!(data.keys && data.keys.p256dh && data.keys.auth),
        jenis: Object.keys(data.prefs || {}).length,
      };
    });
    if (subDocs.length) break;
    await sleep(2000);
  }
  console.log('DIAG langganan push perangkat A:', JSON.stringify({ pushCard: channelCard.pushCard, subDocs, pushApi: channelCard.pushApi }));
  check('kartu kanal push ada dan menjelaskan keadaannya', channelCard.pushCard !== 'TANPA-KARTU-PUSH', { pushCard: channelCard.pushCard });
  if (channelCard.pushApi === true && !channelCard.pushCard.startsWith('subscribed')) {
    // Build ini membawa kunci (dibuktikan oleh build itu sendiri), jadi menyalahkan
    // paket aplikasi saat browser yang mampu berarti kartu sedang berbohong.
    check(
      'kalau browsernya mampu, kartu tidak menyalahkan build atas belum berlangganan',
      !/tidak membawa kunci push/.test(channelCard.pushCard),
      { pushApi: channelCard.pushApi, pushCard: channelCard.pushCard.slice(0, 130) }
    );
  }
  if (channelCard.pushCard.startsWith('subscribed')) {
    check('alamat push perangkat benar-benar tersimpan di server', subDocs.length >= 1 && subDocs.every((s) => s.kunci && s.jenis === 6), { subDocs });
  } else {
    check(
      'kalau belum berlangganan, kartu menyebut alasannya alih-alih pura-pura siap',
      /belum|tidak|kunci|tolak/i.test(channelCard.pushCard),
      { pushCard: channelCard.pushCard.slice(0, 140) }
    );
  }

  // Kirim dari layar pasangan sementara B benar-benar di latar (ponsel dikantongi).
  await B.decoy(true);
  const dikirim = await A.click(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('💪'))`);
  check('chip cepat "Semangat" bisa dipakai sekali tekan', dikirim === 'ok', dikirim);

  const bCeleb = await B.wait(`!!document.querySelector('[data-hug-celebration]')`, 30000);
  const bBody = await B.t(`(() => { const c = document.querySelector('[data-hug-celebration]');
    return c ? c.innerText.replace(/\\s+/g, ' ').trim().slice(0, 240) : 'TANPA-CELEBRATION'; })()`);
  check('penerima melihat perayaan walau tab-nya sedang di latar', bCeleb && /Rafi mengirim pelukan/.test(bBody), { bCeleb, bBody });

  // Satu tekan "Balas sekarang" harus langsung membalas dan terbang ke pengirim.
  const balas = await B.click(`[...document.querySelectorAll('[data-hug-celebration] button')].find(b => b.textContent.trim() === 'Balas sekarang')`);
  const aCeleb = await A.wait(`(() => { const c = document.querySelector('[data-hug-celebration]');
    return !!c && c.innerText.includes('Shinta mengirim pelukan'); })()`, 30000);
  check('balasan satu tekan sampai ke pengirim sebagai perayaan', balas === 'ok' && aCeleb, { balas, aCeleb, where: await A.where() });

  let adaBalasan = false;
  const bDeadline = Date.now() + 25000;
  while (Date.now() < bDeadline && !adaBalasan) {
    const docs = (await f.getDocs(f.query(f.collection(dbAdmin, 'reactions'),
      f.where('coupleId', '==', A.coupleId)))).docs;
    adaBalasan = docs.some((d) => d.data().senderId === B.uid && d.data().message === 'Balik peluk!');
    if (!adaBalasan) await sleep(1500);
  }
  check('balasan pasangan tersimpan di server ruang', adaBalasan);

  await A.click(`[...document.querySelectorAll('[data-hug-celebration] button')].find(b => b.textContent.trim() === 'Nanti')`);
  const dibuka = await A.text('Pelukan terakhirmu sudah dibuka pasangan.', 30000);
  check('pengirim melihat kabar terbacanya terbuka di layar pasangan', dibuka, { where: await A.where() });

  // Kabar saat aplikasi pasangan sedang TERTUTUP: tidak ada notifikasi yang bisa
  // ditampilkan, tapi kabar tidak boleh hilang — harus disambut saat dibuka lagi.
  await B.cdp.send('Page.navigate', { url: 'about:blank' }, B.sid);
  await sleep(2500);
  const kirimLagi = await A.click(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('🤗'))`);
  check('chip cepat "Peluk" terkirim ke pasangan yang sedang menutup aplikasi', kirimLagi === 'ok', kirimLagi);
  let pelukTersimpan = false;
  const sDeadline = Date.now() + 25000;
  while (Date.now() < sDeadline) {
    const docs = (await f.getDocs(f.query(f.collection(dbAdmin, 'reactions'),
      f.where('coupleId', '==', A.coupleId)))).docs;
    pelukTersimpan = docs.some((d) => d.data().senderId === A.uid && d.data().emoji === '🤗');
    if (pelukTersimpan) break;
    await sleep(1500);
  }
  await B.go(`${ORIGIN}/?tab=today`);
  await B.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !!(s.couple && s.couple.id); } catch { return false; } })()`, 40000);
  const recap = await B.wait(`(() => { const c = document.querySelector('[data-hug-celebration]');
    return !!c && c.innerText.includes('Rafi mengirim pelukan'); })()`, 30000);
  check('kabar yang tiba saat aplikasi tertutup tetap disambut saat dibuka lagi', recap, { pelukTersimpan, where: await B.where() });
  await B.click(`[...document.querySelectorAll('[data-hug-celebration] button')].find(b => b.textContent.trim() === 'Nanti')`);
  await B.decoy(false);
  await A.gotoTab('today');
});

// relay Telegram diuji terhadap bot TIRUAN di loopback: aplikasi diarahkan ke
// sana lewat window.__GT_RELAY_API__, yang hanya mau menerima 127.0.0.1/localhost.
// Tidak ada satu pun pesan QA yang bisa keluar ke Telegram sungguhan.
phase('relay Telegram: kabar ke HP yang tertutup', async () => {
  const RELAY_PORT = Number(process.env.GT_RELAY_PORT || 9412);
  const API_ROOT = `http://127.0.0.1:${RELAY_PORT}`;
  const TOKEN_QA = '7654321:AAtokenqarelay00000000000000000000000000';
  const CHAT_A = '-100111223344';
  const CHAT_B = '-100555666777';
  const posts = [];
  const relayStub = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const fields = Object.fromEntries(new URLSearchParams(raw).entries());
      posts.push({ url: req.url, fields, raw });
      // Yang menekan /start lebih dulu adalah pemilik chat pertama.
      const giliran = posts.filter((p) => p.url.endsWith('/getUpdates')).length;
      const chat = giliran === 1 ? { id: CHAT_A, title: 'HP Rafi QA' } : { id: CHAT_B, title: 'HP Shinta QA' };
      const body = req.url.endsWith('/getUpdates')
        ? { ok: true, result: [{ update_id: 1, message: { date: 1000, chat } }] }
        : { ok: true, result: { message_id: posts.length } };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise((resolve) => relayStub.listen(RELAY_PORT, '127.0.0.1', resolve));

  const arahkan = (dev) => dev.t(`window.__GT_RELAY_API__ = ${JSON.stringify(API_ROOT)}; 'ok'`);
  const kartu = (dev) => dev.t(`(() => { const d = document.querySelector('[data-relay-state]');
    return d ? d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 1400) : 'TANPA-KARTU-RELAY'; })()`);
  // Jawaban kartu (baris role="status") adalah satu-satunya tempat aplikasi
  // menceritakan alasan gagal — jangan sampai terpotong oleh slice kartu.
  const jawaban = (dev) => dev.t(`(() => { const d = document.querySelector('[data-relay-state] [role="status"]');
    return d ? d.innerText.replace(/\\s+/g, ' ').trim() : 'TANPA-JAWABAN'; })()`);
  const chipPeluk = `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('🤗'))`;
  // Muat ulang perangkat + arahkan ke bot tiruan + tunggu chip pelukan siap.
  const siapKirim = async (dev) => {
    await dev.go(`${ORIGIN}/?tab=couple`);
    await dev.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !!(s.couple && s.couple.id); } catch { return false; } })()`, 40000);
    await dev.closeDialogs();
    const ada = await dev.wait(`!!(${chipPeluk})`, 30000);
    await arahkan(dev);
    return ada;
  };
  // Mengikat chat lewat UI sungguhan: tempel token -> simpan -> deteksi chat.
  const ikatTelegram = async (dev) => {
    await arahkan(dev);
    await openSettings(dev, 'Notifikasi');
    const ada = await dev.t(`!!document.querySelector('[data-relay-state]')`);
    await dev.fill(`document.querySelector('#relay-token')`, TOKEN_QA);
    const simpan = await dev.clickText('Simpan token', `[role="dialog"]`);
    await sleep(500);
    const deteksi = await dev.clickText('Deteksi chat saya', `[role="dialog"]`);
    const siap = await dev.wait(`(() => { const d = document.querySelector('[data-relay-status]');
      return !!d && /terhubung ke/.test(d.innerText); })()`, 25000);
    const teks = await kartu(dev);
    const jawab = await jawaban(dev);
    await closeSettings(dev);
    return { ada, simpan, deteksi, siap, teks, jawab };
  };
  const ikatanServer = async (uid) => {
    const d = await f.getDoc(f.doc(dbAdmin, 'telegramBindings', uid));
    return d.exists() ? d.data() : null;
  };
  // Baris pasangan di kartu baru berarti setelah bacaan servernya benar-benar
  // selesai, jadi tunggu penandanya sebelum membaca teks — dan sebelum menekan
  // chip, karena pengirim tidak akan mengirim apa pun tanpa ikatan terbaca.
  const kartuSiap = async (dev) => {
    await openSettings(dev, 'Notifikasi');
    const terbaca = await dev.wait(
      `(() => { const d = document.querySelector('[data-relay-partner]');
        return !!d && d.getAttribute('data-relay-partner') === 'siap'; })()`,
      25000
    );
    const partner = await dev.t(`(() => { const d = document.querySelector('[data-relay-partner]');
      return d ? d.getAttribute('data-relay-partner') : 'TANPA-BARIS'; })()`);
    const teks = await kartu(dev);
    await closeSettings(dev);
    return { terbaca, partner, teks };
  };

  try {
    const ikatA = await ikatTelegram(A);
    check('kartu relay muncul di Pengaturan dan chat A bisa diikat lewat UI',
      ikatA.ada === true && ikatA.simpan === 'ok' && ikatA.deteksi === 'ok' && ikatA.siap, ikatA);
    const ikatB = await ikatTelegram(B);
    check('perangkat pasangan bisa mengikat chatnya dengan cara yang sama', ikatB.siap, ikatB);

    const ikatanA = await ikatanServer(A.uid);
    const ikatanB = await ikatanServer(B.uid);
    check('ikatan chat mendarat di server dengan bentuk yang dipakai pengirim',
      !!ikatanA && ikatanA.chatId === CHAT_A && ikatanA.coupleId === A.coupleId && ikatanA.enabled === true
        && !!ikatanB && ikatanB.chatId === CHAT_B,
      { A: ikatanA, B: ikatanB });
    check('dua perangkat terikat ke dua chat yang berbeda',
      !!ikatanA && !!ikatanB && ikatanA.chatId !== ikatanB.chatId,
      { chatA: ikatanA && ikatanA.chatId, chatB: ikatanB && ikatanB.chatId });

    const lihat1 = await kartuSiap(A);
    // Kalau kartu bilang pasangan belum pasang, bedakan " Aplikasinya memang
    // belum membaca apa-apa" dari "yang dibaca uid yang salah": bawa identitas
    // ruang yang tersimpan di perangkat A sebagai saksi.
    const saksiA = await A.t(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}');
      const c = s.couple || {}; return { id: c.id || '', u1: c.user1Id || '', u2: c.user2Id || '' }; }
      catch (e) { return { galat: String(e) }; } })()`);
    check('kartu pengirim melihat HP pasangan benar-benar siap dibangunkan',
      lihat1.partner === 'siap' && /bisa dibangunkan/.test(lihat1.teks),
      { ...lihat1, harusnya: { pasangan: B.uid, ruang: A.coupleId }, Alihat: saksiA });

    // B menutup aplikasinya, lalu jam kehadirannya dimundurkan — setara dua menit
    // berlalu tanpa menunggu dua menit di dunia nyata.
    await B.cdp.send('Page.navigate', { url: 'about:blank' }, B.sid);
    await sleep(1500);
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await f.setDoc(f.doc(ctx.firestore(), 'telegramBindings', B.uid), { seenAt: Date.now() - 120000 }, { merge: true });
    });

    const siapSatu = await siapKirim(A);
    const lihat2 = await kartuSiap(A);
    posts.length = 0;
    const peluk = await A.click(chipPeluk);
    let terbangun = false;
    const rDeadline = Date.now() + 30000;
    while (Date.now() < rDeadline) {
      terbangun = posts.some((p) => p.url.endsWith('/sendMessage') && p.fields.chat_id === CHAT_B);
      if (terbangun) break;
      await sleep(1500);
    }
    const keluar = posts.filter((p) => p.url.endsWith('/sendMessage'));
    const teksKabar = keluar.length ? String(keluar[0].fields.text) : '';
    check('pelukan membangunkan HP pasangan lewat relay walau aplikasinya tertutup',
      peluk === 'ok' && terbangun, { peluk, siapSatu, partner: lihat2.partner, teksKabar, jumlah: keluar.length });
    check('yang keluar hanya kalimat baku tanpa isi privat',
      keluar.length === 1 && /mengirim pelukan untukmu/.test(teksKabar) && !/QA|Olahar|Termodinamika/.test(teksKabar),
      { teksKabar, jumlah: keluar.length });
    check('pengirim tidak membangunkan dirinya sendiri',
      !keluar.some((p) => p.fields.chat_id === CHAT_A), keluar.map((p) => p.fields.chat_id));

    // B kembali menggenggam HP-nya: kabar cukup lewat notifikasi di layar, bukan getar.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await f.setDoc(f.doc(ctx.firestore(), 'telegramBindings', B.uid), { seenAt: Date.now() }, { merge: true });
    });
    const siapDua = await siapKirim(A);
    posts.length = 0;
    const pelukLagi = await A.click(chipPeluk);
    await sleep(12000);
    const waktuAktif = posts.filter((p) => p.url.endsWith('/sendMessage'));
    check('pasangan yang sedang aktif tidak dibangunkan lewat Telegram',
      siapDua && pelukLagi === 'ok' && waktuAktif.length === 0, { pelukLagi, siapDua, keluar: waktuAktif.map((p) => p.fields.text) });

    // Pasangan memilih tidak lagi dibangunkan, lewat sakelarnya sendiri.
    await B.go(`${ORIGIN}/?tab=today`);
    await B.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !!(s.couple && s.couple.id); } catch { return false; } })()`, 40000);
    await B.closeDialogs();
    await arahkan(B);
    await openSettings(B, 'Notifikasi');
    const sakelar = await B.click(`[...document.querySelectorAll('[data-relay-state] input[type="checkbox"]')][0]`);
    // Menyimpan sakelar berarti menulis ke server dulu, jadi kartunya baru berubah
    // setelah tulisan itu diakui — di mesin yang penuh bisa beberapa detik. Tunggu
    // sampai baris statusnya benar-benar berubah, jangan baca pada jam sekian buta.
    const konvergen = await B.wait(`(() => { const d = document.querySelector('[data-relay-status]');
      return !!d && /sedang dimatikan/.test(d.innerText); })()`, 25000);
    const statusB = await B.t(`(() => { const d = document.querySelector('[data-relay-status]');
      return d ? d.innerText.replace(/\\s+/g, ' ').trim().slice(0, 400) : 'TANPA-STATUS'; })()`);
    await closeSettings(B);
    check('pasangan bisa mematikan bangunannya dari sakelar sendiri',
      sakelar === 'ok' && /sedang dimatikan/.test(statusB), { sakelar, konvergen, statusB });

    const siapTiga = await siapKirim(A);
    const menolak = await kartuSiap(A);
    check('ikatan yang dimatikan pasangan terbaca apa adanya di kartu pengirim',
      siapTiga && menolak.terbaca && /tidak dibangunkan|memilih/i.test(menolak.teks), { siapTiga, ...menolak });

    // Bersih-bersih: token dan ikatan QA dihapus supaya fase sesudahnya tidak
    // lagi mencoba mengirim ke bot tiruan yang akan ditutup.
    for (const dev of [A, B]) {
      await dev.t(`localStorage.removeItem('gt_relay_token_v1'); localStorage.removeItem('gt_relay_link_v1'); localStorage.removeItem('gt_relay_trail_v1'); 'ok'`);
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await f.deleteDoc(f.doc(ctx.firestore(), 'telegramBindings', dev.uid));
      });
    }
    const sisa = [await ikatanServer(A.uid), await ikatanServer(B.uid)];
    check('jejak relay QA dibersihkan dari server dan perangkat', sisa.every((x) => x === null), sisa);
  } finally {
    relayStub.close();
  }
});

phase('timer fokus', async () => {
  const goT = await A.gotoTab('timer');
  const clockUp = await A.wait(`!!document.querySelector('[aria-label^="Sisa waktu"]')`, 25000);
  check('layar timer memuat jam hitung mundur', goT && clockUp, { goT, clockUp, where: await A.where() });

  const rainOn = await A.clickAria('Suara rintik hujan');
  const pressedRain = await A.wait(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'') === 'Suara rintik hujan');
    return !!b && b.getAttribute('aria-pressed') === 'true'; })()`, 8000);
  check('suara ambien hujan menyala saat ditekan', rainOn === 'ok' && pressedRain, { rainOn, pressedRain });

  const sessionCount = async () => (await f.getDocs(f.query(f.collection(dbAdmin, 'sessions'),
    f.where('coupleId', '==', A.coupleId)))).docs.length;
  const sebelumCepat = await sessionCount();

  // Sesi di bawah 1 menit dibuang oleh TimerView.tsx:163-169. Cek: apakah
  // penggunanya diberi tahu, dan apakah suara ambien ikut dimatikan.
  const startedCepat = await A.clickIncludes('Mulai fokus');
  await sleep(4000);
  const discarded = await A.clickAria('Selesaikan dan simpan sesi (minimal 1 menit)');
  await sleep(2500);
  const dlgCepat = await A.t(`!!document.querySelector('[role="dialog"]')`);
  const feedbackCepat = await A.t(`(() => { const n = [...document.querySelectorAll('[role="status"],[role="alert"],[role="toast"]')];
    return n.map(x => x.innerText.replace(/\\s+/g, ' ').trim()).filter(Boolean).join(' | ') || 'TANPA-ELEMENT-PESAN'; })()`);
  const rainSetelahBatal = await A.t(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'') === 'Suara rintik hujan');
    return b ? b.getAttribute('aria-pressed') : 'TANPA-TOMBOL'; })()`);
  const sesudahCepat = await sessionCount();
  const adaPeringatan = /minimal 1 menit|belum dihitung/i.test(feedbackCepat);
  check('sesi di bawah 1 menit dibuang dengan peringatan dan suara ambien dimatikan',
    startedCepat === 'ok' && discarded === 'ok' && dlgCepat === false && rainSetelahBatal === 'false' && adaPeringatan,
    { startedCepat, discarded, dialogMuncul: dlgCepat, pesanYangTampil: feedbackCepat, adaPeringatan, ariaPressedHujan: rainSetelahBatal, sesiSebelum: sebelumCepat, sesiSesudah: sesudahCepat });

  // Sesi sungguhan: jalankan 66 detik, simpan, lalu buktikan sampai ke perangkat B.
  const SESI = `Sesi QA-${STAMP}`;
  const started = await A.clickIncludes('Mulai fokus');
  say('menunggu 66 detik agar sesi melewati ambang 1 menit ...');
  await sleep(66000);
  const completeClick = await A.clickAria('Selesaikan dan simpan sesi (minimal 1 menit)');
  const logDlg = await A.dlg('Sesi selesai', 15000);
  check('sesi >= 1 menit membuka pencatatan', started === 'ok' && completeClick === 'ok' && logDlg,
    { started, completeClick, logDlg, suaraMati: await A.t(`(() => { const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'') === 'Suara rintik hujan'); return b ? b.getAttribute('aria-pressed') : 'TANPA-TOMBOL'; })()`) });
  const filledTitle = await A.fill(`document.querySelector('#session-title')`, SESI);
  // Textarea refleksi ikut wajib (required di TimerView.tsx) — tanpa ini browser
  // memblokir submit diam-diam dan sesi tidak pernah terkirim.
  const filledTakeaway = await A.fill(`document.querySelector('#session-takeaway')`, 'Belajar konsisten 1 menit penuh');
  const valueAfterFill = await A.t(`(() => { const el = document.querySelector('#session-title'); const ta = document.querySelector('#session-takeaway');
    return el ? el.value + '/valid=' + el.checkValidity() + '/takeaway-valid=' + (ta ? ta.checkValidity() : 'tanpa-takeaway') : 'TANPA-INPUT'; })()`);
  const saveLog = await A.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  await sleep(2500);
  const dialogMasihBuka = await A.t(`(() => { const d = document.querySelector('[role="dialog"]'); return d ? d.innerText.replace(/\\s+/g, ' ').slice(0, 120) : 'DIALOG-TUTUP'; })()`);
  const alertA = await A.alerts();
  let sesiDocs = [];
  const sDeadline = Date.now() + 25000;
  while (Date.now() < sDeadline) {
    const snap = await f.getDocs(f.query(f.collection(dbAdmin, 'sessions'), f.where('coupleId', '==', A.coupleId)));
    sesiDocs = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    if (sesiDocs.some((s) => s.title === SESI)) break;
    await sleep(2000);
  }
  // Kalau query ber-predikat kosong, dibaca tanpa predikat: tahu apakah dokumennya
  // benar-benar tidak ada atau hanya coupleId-nya yang beda.
  const semuaSesi = sesiDocs.length ? [] : (await f.getDocs(f.collection(dbAdmin, 'sessions'))).docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) })).slice(0, 5);
  const sesiKita = sesiDocs.find((s) => s.title === SESI) || {};
  check('sesi fokus A tersimpan di server dengan identitas pengirim yang benar',
    saveLog === 'ok' && sesiKita.userId === A.uid && Number(sesiKita.durationSeconds) >= 60,
    { saveLog, id: sesiKita.id, userId: (sesiKita.userId || '').slice(0, 10), durasi: sesiKita.durationSeconds, visibilitas: sesiKita.visibility, jumlahSesi: sesiDocs.length,
      titleDiisi: filledTitle, takeawayDiisi: filledTakeaway, nilaiInput: valueAfterFill, dialogSetelahSimpan: dialogMasihBuka, alertA, sesiSemuaRuang: semuaSesi.map((s) => ({ id: s.id, coupleId: s.coupleId, title: s.title, durasi: s.durationSeconds })) });

  const goPA = await A.gotoTab('progress');
  const terlihatA = await A.text(SESI, 12000);
  console.log(`DIAG sesi tampil di layar A=${JSON.stringify({ goPA, terlihatA })}`);
  const goPB = await B.gotoTab('progress');
  const terlihatB = await B.wait(`(() => !document.body.innerText.includes('Belum ada sesi fokus tercatat'))()`, 30000);
  check('progres B menghitung sesi fokus pasangan', goPB && terlihatB, { goPB, terlihatB, potongan: (await B.body()).slice(0, 220) });

  // Catatan sesi fokus harus bisa dibaca pasangan, bukan hanya dihitung angkanya.
  const goCB = await B.gotoTab('couple');
  const catatanB = await B.wait(
    `(() => document.body.innerText.includes('Catatan Sesi Fokus Berdua') &&
      document.body.innerText.includes(${JSON.stringify(SESI)}))()`,
    30000
  );
  const terlihatCatatanB = catatanB;
  check('catatan sesi fokus A terbaca di layar B', goCB && terlihatCatatanB, { goCB, terlihatCatatanB, potongan: (await B.body()).slice(0, 260) });
});

phase('buku, jurnal, check-in', async () => {
  // Judul unik per sapuan: kalau data lama masih tertinggal di emulator, dokumen
  // dengan judul sama tidak bisa lagi membuat vonis "suntingan tidak tersimpan".
  const BOOK = `Atomic Habits QA-${STAMP}`;
  const goC = await A.gotoTab('couple');
  await A.text('Buku Kita', 25000);
  const tabBukuA = await A.clickText('Buku Kita');
  const bookBtn = await A.click(A.byIncludes('Tambah Buku'));
  const dlg = await A.dlg('Tambah Buku', 15000);
  check('dialog buku terbuka', goC && tabBukuA === 'ok' && bookBtn === 'ok' && dlg,
    { goC, tabBukuA, bookBtn, dlg, whereA: await A.where(), bannerA: await A.text('Sinkronisasi bermasalah', 1000) });
  await A.fill(`[...document.querySelectorAll('[role="dialog"] input')][0]`, BOOK);
  await A.fill(`[...document.querySelectorAll('[role="dialog"] input')][1]`, 'James Clear');
  await A.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  const tabBukuB = await (async () => {
    await B.gotoTab('couple');
    return B.clickText('Buku Kita');
  })();
  const bookOnB = await B.text(BOOK, 30000);
  check('buku yang ditambahkan A muncul di rak B', bookOnB,
    { tabBukuB, whereB: await B.where(), state: await B.state() });

  //Galat 'kode ZZZZ99' dari fase masuk dibiarkan menempel di banner. Setelah
  //puluhan operasi sukses, banner itu seharusnya sudah bersih.
  const bannerBersih = await B.wait(`(() => !document.body.innerText.includes('Sinkronisasi bermasalah'))()`, 20000);
  check('banner galat lama hilang setelah rangkaian operasi sukses di B', bannerBersih, { alertB: await B.alerts() });

  // Sunting silang: B mengubah status buku, perubahan itu harus sampai ke server.
  const editOnB = await B.clickAria(`Edit buku ${BOOK}`);
  const editDlg = await B.dlg('Edit Buku', 15000);
  // Isi dialog dicatat: kalau select[0] ternyata bukan status, itu keterbatasan
  // locator harness, bukan perilaku aplikasi.
  const editFields = await B.t(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return 'TANPA-DIALOG';
    return [...d.querySelectorAll('select')].map((s, i) => i + ':' + (s.labels && s.labels[0] ? s.labels[0].textContent.trim() : s.getAttribute('aria-label') || '?') + '=' + s.value).join(' | '); })()`);
  const pickStatus = await B.fill(`[...document.querySelectorAll('[role="dialog"] select')][0]`, 'completed');
  await sleep(700);
  // Nilai select dibaca ulang: kalau kembali ke 'reading', React tidak menerima
  // perubahan dari setter native (keterbatasan harness), bukan cacat aplikasi.
  const stillValue = await B.t(`(() => { const s = [...document.querySelectorAll('[role="dialog"] select')][0]; return s ? s.value : 'TANPA-SELECT'; })()`);
  const submitEdit = await B.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  const seenByA = await A.wait(`(() => document.body.innerText.includes(${JSON.stringify(BOOK)}))()`, 15000);
  // Server dibaca berulang: status 'completed' bisa tertunda beberapa detik.
  let status = '';
  let bookDump = [];
  const bDeadline = Date.now() + 20000;
  while (Date.now() < bDeadline) {
    const bookDocs = await f.getDocs(f.query(f.collection(dbAdmin, 'books'), f.where('title', '==', BOOK)));
    bookDump = bookDocs.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    status = bookDocs.docs.length ? String(bookDocs.docs[0].data().status || '') : '';
    if (status === 'completed') break;
    await sleep(2000);
  }
  check('suntingan buku dari B tersimpan di server', editOnB === 'ok' && editDlg && status === 'completed',
    { status, sunting: editOnB, editDlg, selectDiDialog: editFields, nilaiSelect: pickStatus, masihSetelah700ms: stillValue, submitEdit, seenByA, jumlahDoc: bookDump.length, server: bookDump.map((b) => ({ id: b.id, status: b.status, coupleId: b.coupleId })), alertB: await B.alerts() });

  // Jurnal refleksi: berbagi lalu diswit jadi privat.
  const tabJurnalA = await A.clickText('Jurnal Refleksi');
  const newJournalA = await A.click(A.byIncludes('Refleksi Pekan Ini'));
  const jDlg = await A.dlg('Refleksi', 15000);
  check('dialog refleksi terbuka', tabJurnalA === 'ok' && newJournalA === 'ok' && jDlg, { tabJurnalA, newJournalA, jDlg });
  await A.fill(`[...document.querySelectorAll('[role="dialog"] textarea')][0]`, 'Konsisten olahraga QA-HARAPAN');
  await A.fill(`[...document.querySelectorAll('[role="dialog"] textarea')][1]`, 'Sering begadang');
  await A.fill(`[...document.querySelectorAll('[role="dialog"] textarea')][2]`, 'Tidur lebih awal');
  await A.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  const tabJurnalB = await (async () => {
    await B.gotoTab('couple');
    return B.clickText('Jurnal Refleksi');
  })();
  const jOnB = await B.text('QA-HARAPAN', 30000);
  check('refleksi bersama A terbaca di perangkat B', jOnB, { tabJurnalB, whereB: await B.where(), state: await B.state() });

  await A.gotoTab('couple');
  await A.clickText('Jurnal Refleksi');
  const madePrivate = await A.click(A.byText('Jadikan privat'));
  await sleep(3000);
  const goneFromB = await B.has('QA-HARAPAN');
  const stillA = await A.has('QA-HARAPAN');
  check('refleksi yang dibuat privat hilang dari layar B', madePrivate === 'ok' && !goneFromB && stillA, { madePrivate, goneFromB, stillA });

  // Check-in malam dari A → harus dibaca sebagai milik A di perangkat B.
  const tabRitualA = await A.clickText('Ritual Berdua');
  const openCheckIn = await A.click(A.byText('Tulis Check-in Hari Ini'));
  const ciDlg = await A.dlg('Check-in', 15000);
  check('dialog check-in terbuka', tabRitualA === 'ok' && openCheckIn === 'ok' && ciDlg, { tabRitualA, openCheckIn, ciDlg });
  await A.click(`[...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes('Luar Biasa'))`);
  await A.fill(`document.querySelector('[role="dialog"] textarea')`, 'Check-in QA dari perangkat A');
  await A.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  const ciDocs = (await f.getDocs(f.query(f.collection(dbAdmin, 'checkins'),
    f.where('coupleId', '==', A.coupleId)))).docs;
  const tabRitualB = await (async () => {
    await B.gotoTab('couple');
    return B.clickText('Ritual Berdua');
  })();
  const ciOnB = await B.text('Check-in QA dari perangkat A', 30000);
  check('check-in A terbaca di layar ritual B', ciOnB,
    { tabRitualB, serverCheckins: ciDocs.length, shared: ciDocs.map((d) => d.data().isShared), state: await B.state() });
});

phase('kesepakatan & sanksi lintas perangkat', async () => {
  const goAgrA = await A.gotoTab('agreements');
  await A.text('Buat Sanksi', 25000);
  const createClick = await A.clickText('Buat Sanksi');
  const dlg = await A.dlg('Buat Sanksi Sehat', 15000);
  check('dialog pembuatan sanksi terbuka', goAgrA && createClick === 'ok' && dlg, { goAgrA, createClick, dlg, whereA: await A.where() });
  await A.fill(`[...document.querySelectorAll('[role="dialog"] textarea')][0]`, 'Traktir es krim QA');
  await A.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  const askedOnB = await (async () => {
    await B.gotoTab('agreements');
    return B.text('Traktir es krim QA', 30000);
  })();
  check('usulan sanksi A muncul di layar B', askedOnB);
  const approveUp = await B.wait(`!!${B.byText('Setujui')}`, 20000);
  check('B mendapat tombol Setujui untuk usulan pasangannya', approveUp);
  await B.clickText('Setujui');
  const activeOnA = await A.wait(`(() => { const t = document.body.innerText; return t.includes('Traktir es krim QA') && !t.includes('Menunggu Persetujuan'); })()`, 25000);
  check('persetujuan B aktifkan sanksi di layar A', activeOnA, await A.body());

  // Pemicuan + keringanan dua arah.
  const simUp = await A.wait(`!!${A.byText('Simulasi Terpicu')}`, 25000);
  await A.clickText('Simulasi Terpicu');
  const yaSimulasi = await A.askYes('picu sekarang');
  await sleep(1500);
  const triggeredOnB = await (async () => {
    await B.gotoTab('agreements');
    return B.text('Buka Aksi Sanksi', 30000);
  })();
  check('pemicuan sanksi dari A terlihat di B', simUp && triggeredOnB, { simUp, yaSimulasi, konfirmasi: A.confirmations.slice(-1) });
  const modal = await B.clickText('Buka Aksi Sanksi');
  const actDlg = await B.dlg('Tindakan sanksi', 15000);
  check('modal tindakan sanksi terbuka di B', modal === 'ok' && actDlg, { modal, actDlg });

  // Kartu "Tukar Tantangan Baru": tombol Ajukan Perubahan tidak pernah dimatikan,
  // padahal handleSwapChallenge langsung return saat usulan kosong (SanctionActionModal.tsx:50).
  const swapCard = await B.clickIncludes('Tukar Tantangan Baru');
  const swapSubmit = await B.clickIncludes('Ajukan Perubahan');
  await sleep(3000);
  const agrSnap = await f.getDocs(f.query(f.collection(dbAdmin, 'agreements'), f.where('coupleId', '==', A.coupleId)));
  const agr = agrSnap.docs.length ? agrSnap.docs[0].data() : {};
  const swapTerjelasan = await B.t(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return 'DIALOG-TUTUP';
    return /menunggu|terkirim|isi|kosong|wajib/i.test(d.innerText) + '|' + d.innerText.replace(/\\s+/g, ' ').slice(0, 160); })()`);
  check('usulan tantangan pengganti kosong menolak dengan penjelasan (bukan diam-diam)',
    swapCard === 'ok' && swapSubmit === 'ok' && (agr.pendingAction === 'swap' || String(swapTerjelasan).startsWith('true')),
    { swapCard, swapSubmit, pendingActionServer: agr.pendingAction || 'kosong', statusServer: agr.status, feedbackDialog: swapTerjelasan });
  await B.clickIncludes('Batal');
  await sleep(1200);

  const reliefForm = await B.clickIncludes('Minta Keringanan');
  // Kalau tombolnya tidak ketemu, label di dalam modal dicetak supaya vonisnya
  // jelas: locator harness atau memang aplikasi yang tidak menampilkan aksinya.
  const modalBtns = reliefForm === 'ok' ? '' : await B.t(`(() => { const d = document.querySelector('[role="dialog"]');
    return d ? [...d.querySelectorAll('button')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()).join(' / ') : 'TANPA-DIALOG'; })()`);
  await B.fill(`[...document.querySelectorAll('[role="dialog"] textarea')][0]`, 'Sedang demam QA');
  await B.clickIncludes('Kirim Permohonan');
  const askOnA = await (async () => {
    await A.gotoTab('agreements');
    return A.text('Setujui Keringanan', 30000);
  })();
  check('permohonan keringanan B sampai ke layar A', reliefForm === 'ok' && askOnA === true, { reliefForm, askOnA, modalBtns });
  const approveRelief = await A.clickIncludes('Setujui Keringanan');
  // Hanya bernilai kalau permohonan B benar-benar terkirim; kalau tidak, layar A
  // memang tidak pernah memilikinya dan ini bukan bukti apa-apa.
  const settledOnB = reliefForm !== 'ok' ? false
    : await B.wait(`(() => { const t = document.body.innerText; return !t.includes('Setujui Keringanan') && !t.includes('Menunggu jawaban pasangan'); })()`, 25000);
  check('persetujuan keringanan A mengubah layar B', reliefForm === 'ok' && approveRelief === 'ok' && settledOnB,
    { reliefForm, approveRelief, settledOnB, layarA: await A.text('Traktir es krim QA', 2000) });

  // Jeda semua sanksi adalah milik ruang, jadi kedua layar berubah.
  await A.gotoTab('agreements');
  await A.clickText('Jeda Semua Sanksi');
  const pausedB = await (async () => {
    await B.gotoTab('agreements');
    return B.text('Lanjutkan Sanksi', 25000);
  })();
  const pausedA = await A.text('Lanjutkan Sanksi', 15000);
  check('jeda sanksi berlaku di kedua perangkat', pausedA && pausedB);
  await A.clickText('Lanjutkan Sanksi');
});

phase('grace day & hadiah bersama', async () => {
  const coupleField = async (name) => {
    const snap = await f.getDoc(f.doc(dbAdmin, 'couples', A.coupleId));
    return String((snap.data() || {})[name]);
  };

  const goPrA = await A.gotoTab('progress');
  const graceUp = await A.wait(`!!${A.byIncludes('Aktifkan Grace Day')}`, 25000);
  const graceClick = await A.clickIncludes('Aktifkan Grace Day');
  let graceNilai = await coupleField('graceDayUsedThisWeek');
  const gDeadline = Date.now() + 20000;
  while (Date.now() < gDeadline && graceNilai !== 'true') {
    await sleep(1500);
    graceNilai = await coupleField('graceDayUsedThisWeek');
  }
  const goPrB = await B.gotoTab('progress');
  const graceDiB = await B.text('Grace Day Sedang Aktif', 25000);
  check('grace day yang diaktifkan A terlihat sampai ke perangkat B',
    goPrA && graceUp && graceClick === 'ok' && graceNilai === 'true' && goPrB && graceDiB,
    { goPrA, graceUp, graceClick, graceNilai, goPrB, graceDiB });

  const matikan = await A.clickIncludes('Grace Day Sedang Aktif');
  let graceKembali = await coupleField('graceDayUsedThisWeek');
  const kDeadline = Date.now() + 20000;
  while (Date.now() < kDeadline && graceKembali !== 'false') {
    await sleep(1500);
    graceKembali = await coupleField('graceDayUsedThisWeek');
  }
  check('grace day bisa dimatikan lagi dan nilainya ikut di server', matikan === 'ok' && graceKembali === 'false', { matikan, graceKembali });

  // Hadiah bersama memakai alur usulan-persetujuan yang sama dengan sanksi.
  const HADIAH = `Hadiah QA-${STAMP}`;
  const goAgA = await A.gotoTab('agreements');
  const tabHadiah = await A.clickIncludes('Hadiah Bersama / Reward');
  const buatHadiah = await A.clickIncludes('Buat Hadiah');
  const dlgHadiah = await A.dlg('Buat Hadiah Bersama', 15000);
  check('dialog pembuatan hadiah bersama terbuka dari tab hadiah',
    goAgA && tabHadiah === 'ok' && buatHadiah === 'ok' && dlgHadiah,
    { goAgA, tabHadiah, buatHadiah, dlgHadiah, whereA: await A.where() });
  await A.fill(`[...document.querySelectorAll('[role="dialog"] textarea')][0]`, HADIAH);
  const submitHadiah = await A.click(`[...document.querySelectorAll('[role="dialog"] button[type="submit"]')][0]`);
  const hadiahDiB = await (async () => {
    await B.gotoTab('agreements');
    const tabB = await B.clickIncludes('Hadiah Bersama / Reward');
    const found = await B.text(HADIAH, 30000);
    return { tabB, found };
  })();
  const setujuiH = await B.clickText('Setujui');
  const hadiahAktifDiA = await (async () => {
    await A.gotoTab('agreements');
    await A.clickIncludes('Hadiah Bersama / Reward');
    return A.text('MENUNGGU PERSETUJUAN', 3000);
  })();
  check('usulan hadiah A muncul di B lalu bisa disetujui',
    submitHadiah === 'ok' && hadiahDiB.found === true && setujuiH === 'ok',
    { submitHadiah, hadiahDiB, setujuiH, masihMenungguDiA: hadiahAktifDiA });
});

phase('taman, cuaca, dan toko dekorasi', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.setDoc(f.doc(ctx.firestore(), 'couples', A.coupleId), { levelXp: 900 }, { merge: true });
  });
  const goGA = await A.gotoTab('garden');
  const goGB = await B.gotoTab('garden');
  const shopA = await A.wait(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi')); return !!b && b.textContent.includes('(900 XP)'); })()`, 25000);
  const shopB = await B.wait(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi')); return !!b && b.textContent.includes('(900 XP)'); })()`, 25000);
  check('saldo XP ruang tampil di tombol toko kedua perangkat', goGA && goGB && shopA && shopB,
    { goGA, goGB, shopA, shopB, whereA: await A.where() });

  const openShop = await A.clickIncludes('Toko Dekorasi (900 XP)');
  const upModal = await A.text('XP Pasangan Saat Ini', 15000);
  check('modal toko terbuka dari taman', openShop === 'ok' && upModal, { openShop, upModal });
  const hasilKlikBeli = await A.click(`[...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes('Buka 200 XP'))`);
  // Pembelian berjalan sebagai transaksi: status modal baru terisi setelah server
  // menjawab, dan saldo yang benar dibaca di database — bukan di layar saja.
  let statusA = '';
  const sDeadline = Date.now() + 20000;
  while (Date.now() < sDeadline && !statusA) {
    statusA = await A.t(`(() => [...document.querySelectorAll('p[role="status"]')].map((p) => p.textContent).join(' | ').slice(0, 200))()`);
    if (!statusA) await sleep(1000);
  }
  const dropB = await B.wait(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi')); return !!b && b.textContent.includes('(700 XP)'); })()`, 40000);
  let ruangServer = {};
  const xDeadline = Date.now() + 45000;
  for (;;) {
    const res = await restDocs('couples');
    ruangServer = (res.docs || []).find((d) => d.id === A.coupleId) || { err: res.err || 'ruang-tidak-ketemu' };
    if (Number(ruangServer.levelXp) === 700 || Date.now() > xDeadline) break;
    await sleep(1500);
  }
  const jejakBeli = dropB ? '' : await syncTrail(A);
  check('beli dekorasi 200 XP → saldo jadi 700 XP di perangkat lain', hasilKlikBeli === 'ok' && dropB,
    { hasilKlikBeli, statusA, store: (await B.state()).decor, xpServer: ruangServer.levelXp, jejakSinkronA: jejakBeli });
  const serverCouple = ruangServer;
  check('server menyimpan XP 700 dan 1 dekorasi terbuka', Number(serverCouple.levelXp) === 700 && (serverCouple.unlockedDecorations || []).length === 1, { xp: serverCouple.levelXp, decor: serverCouple.unlockedDecorations, statusA });
  await A.esc();
  const shopClosed = await A.wait(`!document.querySelector('[role="dialog"]')`, 15000);
  check('modal toko bisa ditutup dengan Escape', shopClosed);

  const gerimis = await A.clickText('🌧️ Gerimis');
  // Kata 'Gerimis' selalu ada di deretan tombol cuaca, jadi teks layar bukan bukti.
  // Yang dibaca: tombol mana yang menyala (state aplikasi) dan apa yang ada di
  // server (isi database). Kombinasi keduanya memisahkan 'klik tidak mengubah
  // apa-apa' dari 'berubah di sini tapi tulisannya tidak sampai'.
  const nyalaDi = (dev) => dev.wait(`(() => { const b = [...document.querySelectorAll('button')]
      .filter((x) => /Cerah|Gerimis|Pelangi/.test(x.textContent));
      return !!b.find((x) => x.className.includes('bg-stone-900') && x.textContent.includes('Gerimis')); })()`, 8000);
  const nyalaA = await nyalaDi(A);
  let cuacaServer = '';
  let lamaCuacaMs = -1;
  // Stream emulator kadang sempat putus (lihat catatan ECONNRESET di log). Aplikasi
  // mengetahuinya dan mengirim ulang tulisannya, jadi yang diuji adalah 'sampai atau
  // tidak', bukan 'sampai di bawah 25 detik'.
  const wDeadline = Date.now() + 60000;
  const wMulai = Date.now();
  while (Date.now() < wDeadline) {
    cuacaServer = (await f.getDoc(f.doc(dbAdmin, 'couples', A.coupleId))).data().selectedWeather;
    if (cuacaServer === 'rain') { lamaCuacaMs = Date.now() - wMulai; break; }
    await sleep(1000);
  }
  const goGardenB = await B.gotoTab('garden');
  const rainOnB = await nyalaDi(B);
  const jejakCuaca = cuacaServer === 'rain' ? '' : await syncTrail(A);
  check('cuaca yang dipilih A tersimpan untuk berdua dan tampak di taman B',
    gerimis === 'ok' && cuacaServer === 'rain' && goGardenB && rainOnB,
    { gerimis, nyalaA, cuacaServer, lamaCuacaMs, goGardenB, rainOnB, cuacaB: (await B.state()).weather, jejakSinkronA: jejakCuaca });

  const malam = await A.clickText('Malam');
  let timeServer = '';
  const tDeadline = Date.now() + 60000;
  while (Date.now() < tDeadline) {
    timeServer = (await f.getDoc(f.doc(dbAdmin, 'couples', A.coupleId))).data().selectedTimeOfDay;
    if (timeServer === 'night') break;
    await sleep(1000);
  }
  const timeOnB = await B.wait(`(() => { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}');
    return s.couple && s.couple.selectedTimeOfDay === 'night'; })()`, 25000);
  check('waktu taman (Malam) tersimpan ke server untuk berdua', malam === 'ok' && timeServer === 'night' && timeOnB,
    { malam, timeServer, timeOnB });

  // Pohon yang makin lengkap. Yang bikin uji ini berarti bukan kedua layar saling
  // cocok (dua-duanya bisa salah sama rata), tapi daftar bagian yang dibandingkan
  // dengan hasil rumus dari misi yang benar-benar ada di database.
  const bagianDi = async (dev, mode) => {
    const goG = await dev.gotoTab('garden');
    await dev.clickText(mode === '2D' ? '2D Aksesibel' : '3D WebGL');
    const ada = await dev.wait(`!!document.querySelector('[data-craft]')`, 25000);
    const nilai = await dev.t(`(() => { const r = document.querySelector('[data-craft]');
      return { teks: r ? r.getAttribute('data-craft') : 'TANPA-CRAFT',
        bagian: [...document.querySelectorAll('[data-part]')].map((g) => g.getAttribute('data-part')).join(',') }; })()`);
    return { goG, ada, teks: nilai.teks, bagian: nilai.bagian };
  };
  const daftar = (s) => String(s || '').split(',').filter(Boolean);
  const misiServer = async () => {
    const res = await restDocs('logs');
    const misi = new Set();
    const privat = new Set();
    for (const d of res.docs || []) {
      if (d.coupleId !== A.coupleId || !d.completed) continue;
      const kunci = `${d.userId}|${d.habitId}|${d.date}`;
      if (d.visibility === 'private') privat.add(kunci);
      else misi.add(kunci);
    }
    return { err: res.err || null, misi: misi.size, privat: privat.size, bagian: tree().openPartIds(misi.size) };
  };

  const s0 = await misiServer();
  const cA = await bagianDi(A, '2D');
  const cB = await bagianDi(B, '2D');
  const listA = daftar(cA.bagian);
  const listB = daftar(cB.bagian);
  check('pohon 2D kedua perangkat menumbuhkan bagian yang sama persis',
    cA.goG && cA.ada && cB.ada && listA.length >= 1 && listA.join(',') === listB.join(','),
    { a: listA, b: listB, teksA: cA.teks, teksB: cB.teks, server: s0, whereA: await A.where() });
  check('bagian pohon = rumus dari misi di database, bukan hanya cocok antar layar',
    !s0.err && listA.join(',') === s0.bagian.join(','), { server: s0, layar: listA });
  const c3 = await bagianDi(A, '3D');
  check('mode 3D dan 2D menyebut jumlah pelengkap yang sama',
    c3.teks === cA.teks && c3.teks !== 'TANPA-CRAFT', { tigaDimensi: c3.teks, duaDimensi: cA.teks });

  // Satu baris privat yang benar-benar tuntas ditanam dari sisi server: pohon
  // berdua tidak boleh bertumbuh karena hal yang pasangannya tidak lihat.
  const idPrivat = `qa_pohon_privat_${STAMP}`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.setDoc(f.doc(ctx.firestore(), 'logs', idPrivat), {
      habitId: 'qa_pohon_habit', userId: A.uid, coupleId: A.coupleId,
      date: new Date().toISOString().slice(0, 10), completed: true, durationMinutes: 5, visibility: 'private',
    });
  });
  const tibaDiA = await A.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}');
    return (s.logs||[]).some((l) => l.id === ${JSON.stringify(idPrivat)} && l.completed === true && l.visibility === 'private'); } catch { return false; } })()`, 25000);
  const cSetelah = await bagianDi(A, '2D');
  const s1 = await misiServer();
  check('misi privat yang tuntas tidak menambah satu bagian pun pada pohon',
    daftar(cSetelah.bagian).join(',') === listA.join(',') && s1.misi === s0.misi && s1.privat >= 1,
    { sebelum: listA.length, sesudah: daftar(cSetelah.bagian).length, tibaDiPeladenA: tibaDiA, server: s1 });
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.deleteDoc(f.doc(ctx.firestore(), 'logs', idPrivat));
  });

  const goT = await A.gotoTab('today');
  const legenda = await A.t(`(() => { const el = document.querySelector('[data-tree-craft]');
    return el ? { misi: Number(el.getAttribute('data-tree-craft')), buka: Number(el.getAttribute('data-tree-open')),
      total: Number(el.getAttribute('data-tree-total')), berikut: el.getAttribute('data-tree-next') } : null; })()`);
  check('legend Pohon Kita menyebut angka database dan bagian berikutnya',
    goT && !!legenda && legenda.misi === s0.misi && legenda.buka === s0.bagian.length &&
    legenda.total === tree().TREE_PARTS.length && /:[0-9]+$/.test(String(legenda.berikut || '')), legenda);
});

phase('pengaturan, tes sinkron, tampilan', async () => {
  const tabs = [
    ['Profil Kamu', 'Warna aksen karakter'],
    ['Hubungkan Pasangan', 'Kode ruangmu'],
    ['Sinkronisasi', 'Jalankan Tes'],
    ['Notifikasi', 'Izin notifikasi'],
    ['Tampilan & Uji Coba', 'Prinsip desain'],
    ['Instal Aplikasi', 'Pasang di perangkat ini'],
    ['Kelola Data', 'Masuk ke Ruang Lain'],
  ];
  for (const [dev, name] of [[A, 'A'], [B, 'B']]) {
    await dev.gotoTab('today');
    const opened = await openSettings(dev, 'Profil Kamu');
    let allOk = opened;
    const seen = [];
    for (const [tab] of tabs) {
      await dev.click(`[...document.querySelectorAll('[role="dialog"] button[role="tab"]')].find(b => b.textContent.includes(${JSON.stringify(tab)}))`);
      const heading = await dev.has(tabs.find((x) => x[0] === tab)[1]);
      seen.push(`${tab}:${heading ? 'ok' : 'KOSONG'}`);
      if (!heading) allOk = false;
    }
    check(`ketujuh tab pengaturan ${name} menampilkan isinya`, allOk, seen.join(' '));

    // Tes sinkronisasi nyata dari tombol di tab Sinkronisasi.
    await dev.click(`[...document.querySelectorAll('[role="dialog"] button[role="tab"]')].find(b => b.textContent.includes('Sinkronisasi'))`);
    await dev.click(dev.byText('Jalankan Tes'));
    const report = await dev.wait(`(() => { const p = [...document.querySelectorAll('[role="dialog"] p[role="status"]')].map(x=>x.textContent).join(' | '); return /ms\\.|tidak kembali|Sesi|belum/i.test(p); })()`, 30000);
    const detail = await dev.t(`[...document.querySelectorAll('[role="dialog"] p[role="status"]')].map(x=>x.textContent).join(' | ')`);
    check(`tes sinkronisasi ${name} memberi laporan dari server`, report && /menerima dan mengembalikan/.test(detail), detail.slice(0, 160));
    await closeSettings(dev);
  }

  // Mode gelap di A: kelas html + bertahan setelah muat ulang.
  await A.clickAria('Beralih ke mode gelap');
  const darkNow = await A.t(`document.documentElement.classList.contains('dark')`);
  const tersimpanGelap = await A.t(`localStorage.getItem('gt_dark')`);
  await A.go(`${ORIGIN}/?tab=today`);
  await A.wait(`!!document.body`, 30000);
  // Kelas dark dipasang setelah React hydrate, jadi diberi waktu — membacanya
  // sepersekian detik setelah body ada hanya menghasilkan kompetisi harness.
  const darkKept = await A.wait(`document.documentElement.classList.contains('dark')`, 15000);
  check('mode gelap A aktif dan tetap aktif setelah muat ulang', darkNow === true && darkKept === true, { darkNow, tersimpanGelap, darkKept });
  await A.clickAria('Beralih ke mode terang');
});

phase('tautan dalam, muat ulang, dan luring', async () => {
  // Perangkat B membuka tautan tab langsung (PWA harus membuka tab yang diminta).
  for (const [tab, text] of [['progress', 'Grace Day'], ['agreements', 'Sanksi'], ['garden', 'Taman Pertumbuhan'], ['timer', 'fokus']]) {
    await B.go(`${ORIGIN}/?tab=${tab}`);
    const ok = await B.text(text, 30000);
    check(`tautan langsung ?tab=${tab} membuka layar yang benar di B`, ok, ok ? '' : await B.body().catch(() => ''));
  }

  // Setelah muat ulang penuh, data harus datang dari server, bukan hanya cache.
  await A.go(`${ORIGIN}/?tab=today`);
  await A.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !!(s.couple && s.couple.id); } catch { return false; } })()`, 40000);
  const reloadA = await A.text('Olahar Pagi QA', 30000);
  const reloadState = await A.state();
  check('muat ulang A mempertahankan ruang + habit + reaksi dari server', reloadA && reloadState.habits >= 2, reloadState);
  await B.go(`${ORIGIN}/?tab=today`);
  const reloadB = await B.text('Baca Malam QA', 30000);
  check('muat ulang B mempertahankan habit miliknya', reloadB, await B.state());

  // Luring: indikator harus muncul dan hilang, aplikasi tidak boleh hancur.
  await A.cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, A.sid);
  const offlineShown = await A.wait(`(() => [...document.querySelectorAll('[role="status"]')].some(e => /Mode offline/i.test(e.textContent)))()`, 20000);
  await A.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, A.sid);
  const offlineGone = await A.wait(`(() => ![...document.querySelectorAll('[role="status"]')].some(e => /Mode offline/i.test(e.textContent)))()`, 20000);
  check('perangkat A menampilkan penanda luring lalu menghapusnya saat online lagi', offlineShown && offlineGone, { offlineShown, offlineGone });
});

phase('keluar pasangan lalu gabung lagi', async () => {
  // B keluar; A harus melihat ruangnya jadi satu orang, lalu B masuk lagi dengan kode.
  await openSettings(B, 'Hubungkan Pasangan');
  const leaveBtn = await B.click(B.byText('Keluar dari Pasangan'));
  await B.clickText('Ya, Keluar dari Pasangan');
  const leftB = await B.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !(s.couple && s.couple.id); } catch { return false; } })()`, 40000);
  check('B bisa keluar dari ruang dari Pengaturan', leaveBtn === 'ok' && leftB, { leaveBtn, leftB });
  await A.go(`${ORIGIN}/?tab=today`);
  await A.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return s.couple && s.couple.user1Id; } catch { return false; } })()`, 40000);
  const solo = await A.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return !(s.couple.user2Id); } catch { return false; } })()`, 30000);
  check('A melihat ruangnya kembali satu orang setelah B keluar', solo, await A.state());

  await B.text('Masuk dengan Kode Ruang', 30000);
  await B.fill(`document.querySelector('#partner-room-code')`, A.code);
  await B.fill(`document.querySelector('#room-display-name')`, 'Shinta');
  await B.click(B.byText('Gabung Sekarang'));
  const rejoined = await B.wait(`(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1')||'{}'); return (s.couple && s.couple.id) === ${JSON.stringify(A.coupleId)}; } catch { return false; } })()`, 40000);
  check('B bisa masuk lagi ke ruang yang sama dengan kode', rejoined, await B.state());
  const dataBack = await B.text('Olahar Pagi QA', 30000);
  check('data ruang lama utuh kembali di perangkat B', dataBack);
});

phase('log konsol & peringatan', async () => {
  for (const dev of [A, B]) {
    const all = dev.exceptions.concat(dev.warns.filter((w) => /Firestore|permission|undefined is not|Cannot read|invariant|Warning:/i.test(w)));
    // Fase luring MEMUTUS jaringan dengan sengaja, jadi Firestore pasti melepas
    // pesan 'transport errored'. Yang di sini diuji adalah galat di luar itu.
    const provoked = all.filter((m) => /transport errored|Failed to fetch|unavailable|offline/i.test(m));
    const bad = all.filter((m) => !/transport errored|Failed to fetch|unavailable|offline/i.test(m));
    check(`perangkat ${dev.label}: tidak ada galat runtime selain fase luring yang disengaja`, bad.length === 0, bad.slice(0, 4));
    if (provoked.length) console.log(`DIAG ${dev.label} pesan akibat fase luring=${JSON.stringify(provoked.slice(0, 3))}`);
  }
  console.log('DIAG A console=' + JSON.stringify(A.consoleLines.slice(-12)));
  console.log('DIAG B console=' + JSON.stringify(B.consoleLines.slice(-12)));
  console.log('DIAG confirm dialog tercapai=' + JSON.stringify({ A: A.confirmations, B: B.confirmations }));
});

async function main() {
  for (const [label, dir] of [['GT_JDK', JDK], ['GT_CLI', CLI], ['GT_SYNCTEST', SYNCTEST]]) {
    if (!fs.existsSync(dir)) throw new Error(`${label} tidak ditemukan di ${dir}`);
  }
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome tidak ditemukan di ${CHROME}`);
  if (!CONNECT) {
    // Sisa emulator suite lain sering terlihat "bebas" sedetik lalu hidup lagi:
    // port harus benar-benar kosong sebelum emulator baru dinyalakan. Server
    // preview sisa run lama juga membuat tes diam-diam menguji build lama.
    for (const port of [8899, 9199, PORT]) {
      if (!(await waitForFreePort(port))) throw new Error(`masih ada yang memegang port ${port}, matikan dulu`);
    }
  }
  fs.mkdirSync(WORK, { recursive: true });

  if (!CONNECT) {
    say('menyalakan emulator firestore + auth');
    start(
      process.execPath,
      ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT, '--config', `${REPO}/firebase.json`],
      {
        cwd: CLI,
        log: `${WORK}/emulator-live.log`,
        env: { ...process.env, JAVA_HOME: JDK, PATH: `${JDK}/bin;${process.env.PATH}` },
      }
    );
    const ready = (await waitForPort(8899)) && (await waitForPort(9199));
    check('emulator hidup', ready);
    if (!ready) throw new Error('emulator tidak siap');
    // Port terbuka dulu, gRPC siap menerima belakangan; klien di dalam Chrome
    // menyerah dalam 10 detik kalau dihubungkan terlalu cepat.
    await sleep(6000);
  }

  const testing = require(`${SYNCTEST}/node_modules/@firebase/rules-unit-testing`);
  f = require(`${SYNCTEST}/node_modules/@firebase/firestore`);
  testEnv = await testing.initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8899, rules: LOOSE_RULES },
  });
  dbAdmin = testEnv.authenticatedContext('seedAdmin').firestore();

  if (!CONNECT) {
    say('build versi emulator + server preview');
    const build = await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-emulator'], {
      cwd: REPO,
      env: { ...process.env, VITE_FIREBASE_EMULATOR: '1' },
    });
    if (build.code !== 0) {
      console.log(build.out.slice(-2500));
      throw new Error('build emulator gagal');
    }
    start(
      process.execPath,
      ['node_modules/vite/bin/vite.js', 'preview', '--outDir', 'dist-emulator', '--port', String(PORT), '--host', '127.0.0.1'],
      { cwd: REPO, log: `${WORK}/preview-live.log` }
    );
    if (!(await waitForPort(PORT, 60000))) throw new Error('preview tidak hidup');
  }

  say(CONNECT ? 'menempel ke DUA Chrome yang sudah jalan' : 'menyalakan DUA Chrome (dua perangkat terpisah)');
  A = await makeDevice('A', DEV_A.port, DEV_A.width, DEV_A.navWhere, DEV_A.navLabels);
  B = await makeDevice('B', DEV_B.port, DEV_B.width, DEV_B.navWhere, DEV_B.navLabels);
  if (!CONNECT) {
    await seedFresh(A);
    await seedFresh(B);
  }
  if (CONNECT) {
    const s = await A.state();
    A.coupleId = s.coupleId;
    B.coupleId = s.coupleId;
  }

  for (const p of phases) {
    if (ONLY.length && !ONLY.some((needle) => p.name.includes(needle))) {
      console.log(`(lewat fase "${p.name}")`);
      continue;
    }
    console.log(`\n===== ${p.name} =====`);
    if (!A.coupleId && p.name !== 'masuk & pasangan') {
      console.log('SKIP  fase ini dilewati — ruang belum berhasil terbentuk');
      continue;
    }
    try {
      await A.closeDialogs();
      await B.closeDialogs();
      await p.fn();
    } catch (err) {
      failures++;
      console.log(`FAIL  fase "${p.name}" berhenti karena galat: ${err && err.message ? err.message : err}`);
    }
  }

  console.log(`\nRINGKASAN dua perangkat: ${passes} PASS, ${failures} FAIL`);
  if (process.env.GT_HOLD) {
    console.log('HOLD: lingkungan dibiarkan hidup untuk probe lanjutan.');
    await new Promise(() => undefined);
  }
}

main()
  .then(() => stopEverything().then(() => process.exit(failures ? 1 : 0)))
  .catch(async (err) => {
    console.log('RUN GAGAL: ' + (err && err.stack ? err.stack : String(err)));
    await stopEverything();
    process.exit(1);
  });
