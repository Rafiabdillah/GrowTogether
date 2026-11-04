// Proof for the decoration shop and the cross-feature relations around it.
//
// Phase 1 loads the repo's REAL firestore.rules and runs the exact writes the shop
// makes (a transaction that spends XP and appends one decoration), from both
// members and from a stranger, including the writes the rules must refuse.
// Phase 2 swaps the emulator to permissive rules and drives the built app in
// headless Chrome: buy two decorations through the modal, watch XP drop, watch the
// 2D garden grow, check that a streak built only from shared logs finally reaches
// the tree, keep a tab open past midnight and see the streak follow, and make the
// worker announce a newer build so the page offers a reload.
//
// Needs four things that cannot live in the repo; the first three are the ones the
// emulator was already installed with:
//   GT_JDK      a Java 21 home            (firebase-tools refuses older)
//   GT_CLI      folder holding node_modules/firebase-tools
//   GT_SYNCTEST folder holding @firebase/rules-unit-testing + @firebase/firestore
//   GT_CHROME   chrome.exe (optional)
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The repo is wherever this file lives, so the script works on any machine. The
// other four are heavyweight tools that cannot be committed; point them here or
// with GT_JDK / GT_CLI / GT_SYNCTEST / GT_CHROME.
const REPO = path.resolve(__dirname, '..');
const TMP = process.env.TMP || os.tmpdir();
const JDK = process.env.GT_JDK || path.join(TMP, 'gt-testenv/jdk-21.0.13+9');
const CLI = process.env.GT_CLI || path.join(TMP, 'gt-testenv/cli');
const SYNCTEST = process.env.GT_SYNCTEST || path.join(TMP, 'gt-synctest');
const CHROME = process.env.GT_CHROME
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WORK = path.join(TMP, 'gt-shop');
const PROFILE = path.join(WORK, 'chrome-shop');
const PORT = Number(process.env.GT_PORT || 4175);
const CDP_PORT = Number(process.env.GT_CDP_PORT || 9336);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PROJECT = 'growtogether-rafiabdillah';
const REAL_RULES = fs.readFileSync(`${REPO}/firestore.rules`, 'utf8');
// Every version string the app prints is read from package.json, so this harness
// never has to be edited again at release time.
const APP_VERSION = JSON.parse(fs.readFileSync(`${REPO}/package.json`, 'utf8')).version;
// A deliberately absurd number for the "a newer build arrived" test.
const NEXT_VERSION = '9.9.9';
const LOOSE_RULES = `service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}`;

// Documents fase 1 plants itself. Phase 2 must not mistake one of them for the
// anonymous device the browser just created: getDocs returns ids in name order,
// so "the first user" is only ever luck.
const plantedUids = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const children = [];
let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}
function say(msg) {
  console.log(`... ${msg}`);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}

function start(cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(400);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

async function waitForPort(port, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await sleep(1500);
  }
  return false;
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
        this.onEvent(message.method, message.params);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

// A typo in an injected expression otherwise surfaces as a confusing browser
// error, sometimes only after minutes of setup, so compile it first.
function compileCheck(expression) {
  let asExpression = null;
  try {
    new Function(`return (Promise.resolve(${expression}));`);
    asExpression = true;
  } catch {
    asExpression = false;
  }
  if (asExpression) return;
  try {
    new Function(expression);
  } catch (err) {
    throw new Error(`ekspresi tidak valid: ${err.message}\n${expression}`);
  }
}

async function evaluate(cdp, sessionId, expression) {
  compileCheck(expression);
  const result = await cdp.send(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception;
    throw new Error(`evaluate failed: ${detail ? detail.description : result.exceptionDetails.text}`);
  }
  return result.result.value;
}

async function waitFor(cdp, sessionId, expression, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // A reload can drop the execution context between polls; that is still "not yet".
    let value;
    try {
      value = await evaluate(cdp, sessionId, `Promise.resolve(${expression})`);
    } catch {
      value = false;
    }
    if (value) return true;
    if (Date.now() > deadline) return false;
    await sleep(400);
  }
}

// A navigation can blank the document between two polls, so every text assertion
// goes through this instead of touching document.body directly.
const hasText = (text) =>
  `(() => !!document.body && document.body.innerText.includes(${JSON.stringify(text)}))()`;

// The shop banner carries both numbers the economy has to agree on: XP balance and
// how many decorations are installed.
async function balance(cdp, sessionId) {
  return evaluate(
    cdp,
    sessionId,
    `(() => { if (!document.body) return { xp: '', count: '' }; const t = document.body.innerText; return {
        xp: (t.match(/(\\d+) XP\\s*(·|•)?\\s*Level/) || t.match(/(\\d+) XP/) || [,''])[1],
        count: (t.match(/(\\d+) dari 5 Terpasang/) || [,''])[1],
      }; })()`
  );
}

// Poll until the banner itself reports the new numbers: that is the moment the
// write has round-tripped, so a purchase is never judged from a stale frame.
const bannerIs = (xp, count) =>
  `(() => { if (!document.body) return false; const t = document.body.innerText;
     return /(^|[^\\d])${xp} XP\\s*(·|•)?\\s*Level/.test(t) && t.includes('${count} dari 5 Terpasang'); })()`;

const statusText = (cdp, sessionId) =>
  evaluate(
    cdp,
    sessionId,
    `(() => { const p = document.querySelector('[role="dialog"] p[role="status"]'); return p ? p.textContent : ''; })()`
  );

const localDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function rulesPhase() {
  say('fase 1: aturan Firestore asli');
  const testing = require(`${SYNCTEST}/node_modules/@firebase/rules-unit-testing`);
  const fstore = require(`${SYNCTEST}/node_modules/@firebase/firestore`);
  const testEnv = await testing.initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8899, rules: REAL_RULES },
  });

  const stamp = Date.now().toString(36).toUpperCase().slice(0, 8);
  const uidP = `shopP${stamp}p111111111111111111`;
  const uidQ = `shopQ${stamp}q222222222222222222`;
  const uidZ = `shopZ${stamp}z333333333333333333`;
  const coupleId = `couple_shop_${stamp}`;
  const code = `SHOP${stamp}`;
  const nowIso = new Date().toISOString();
  plantedUids.push(uidP, uidQ, uidZ);

  // The room itself is created by the app in phase 2; here it is planted so the
  // shop writes have something real to spend against.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await fstore.setDoc(fstore.doc(db, 'couples', coupleId), {
      id: coupleId, user1Id: uidP, user2Id: uidQ, roomCode: code,
      levelXp: 900, levelNumber: 5, graceDayUsedThisWeek: false,
      weeklyReadingMinutesGoal: 300, weeklyStudyMinutesGoal: 200,
      jokerCardsUser1: 2, jokerCardsUser2: 2, allSanctionsPaused: false,
      unlockedDecorations: [], selectedTimeOfDay: 'auto', selectedWeather: 'clear',
      createdAt: nowIso, updatedAt: nowIso,
    });
    await fstore.setDoc(fstore.doc(db, 'users', uidP), { id: uidP, displayName: 'P', coupleId, inviteCode: code, colorTheme: 'coral', createdAt: nowIso, updatedAt: nowIso });
    await fstore.setDoc(fstore.doc(db, 'users', uidQ), { id: uidQ, displayName: 'Q', coupleId, inviteCode: `Q${stamp}`, colorTheme: 'teal', createdAt: nowIso, updatedAt: nowIso });
  });

  const dbP = testEnv.authenticatedContext(uidP).firestore();
  const dbQ = testEnv.authenticatedContext(uidQ).firestore();
  const dbZ = testEnv.authenticatedContext(uidZ).firestore();

  const spend = async (db, cost, decorationId) => {
    try {
      await fstore.runTransaction(db, async (tx) => {
        const ref = fstore.doc(db, 'couples', coupleId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('ruang hilang');
        const data = snap.data();
        const xp = data.levelXp ?? 0;
        if (xp < cost) throw new Error('xp-kurang');
        tx.update(ref, { levelXp: xp - cost, unlockedDecorations: [...(data.unlockedDecorations ?? []), decorationId] });
      });
      return 'OK';
    } catch (e) {
      return e.code || e.message;
    }
  };

  check('anggota 1 bisa membelanjakan XP lewat transaksi (setelah aturan asli)', (await spend(dbP, 200, 'lanterns')) === 'OK');
  let doc = await fstore.getDoc(fstore.doc(dbZ, 'couples', coupleId)).catch((e) => ({ err: e.code }));
  check('orang asing tidak bisa membaca ruang yang sudah terisi', doc.err === 'permission-denied' || doc.exists?.() === false, doc.err || 'read');
  check('anggota 2 juga boleh membelanjakan XP pasangan', (await spend(dbQ, 150, 'swing')) === 'OK');
  const after = (await fstore.getDoc(fstore.doc(dbP, 'couples', coupleId))).data();
  check('transaksi keduanya terhitung benar, tidak ada XP yang hilang', after.levelXp === 550, { levelXp: after.levelXp });
  check('daftar dekorasi bertambah dua, urutan tetap', JSON.stringify(after.unlockedDecorations) === JSON.stringify(['lanterns', 'swing']), after.unlockedDecorations);
  check('orang asing tidak bisa membeli dekorasi ruang lain', (await spend(dbZ, 200, 'pond')) === 'permission-denied');
  check('transaksi ditolak saat XP tidak cukup', (await spend(dbP, 5000, 'cottage')) === 'xp-kurang');

  // The rest of the room-level patches the garden and the habit loop depend on.
  const weather = await fstore
    .setDoc(fstore.doc(dbQ, 'couples', coupleId), { selectedWeather: 'rainbow' }, { merge: true })
    .then(() => 'OK')
    .catch((e) => e.code);
  check('cuaca pilihan pasangan bisa ditulis anggota', weather === 'OK', weather);
  const xpGain = await fstore
    .setDoc(fstore.doc(dbQ, 'couples', coupleId), { levelXp: fstore.increment(10) }, { merge: true })
    .then(() => 'OK')
    .catch((e) => e.code);
  check('habit selesai (+10 XP) lolos aturan penulisan ruang', xpGain === 'OK', xpGain);
  const balance = (await fstore.getDoc(fstore.doc(dbP, 'couples', coupleId))).data().levelXp;
  check('increment dan transaksi memakai saldo yang sama', balance === 560, { balance });

  // The room economy is now guarded: XP is also the currency, so a negative balance
  // would be free decorations, and a non-list would erase the garden.
  const patch = async (db, fields) =>
    fstore
      .setDoc(fstore.doc(db, 'couples', coupleId), fields, { merge: true })
      .then(() => 'OK')
      .catch((e) => e.code);

  check('saldo negatif ditolak aturan ruang', (await patch(dbP, { levelXp: -50 })) === 'permission-denied');
  check('undo habit yang melewati saldo ditolak (increment -600)', (await patch(dbP, { levelXp: fstore.increment(-600) })) === 'permission-denied');
  check('daftar dekorasi yang bukan daftar ditolak', (await patch(dbP, { unlockedDecorations: 'swing' })) === 'permission-denied');
  const untouched = (await fstore.getDoc(fstore.doc(dbP, 'couples', coupleId))).data();
  check('penulisan yang ditolak tidak mengubah dokumen', untouched.levelXp === 560, { levelXp: untouched.levelXp });
  check('increment yang tetap positif lolos', (await patch(dbP, { levelXp: fstore.increment(-10) })) === 'OK');
  check('saldo nol masih boleh dituliskan', (await patch(dbP, { levelXp: 0 })) === 'OK');
  check('penulisan ruang yang tidak menyentuh ekonomi tetap lolos', (await patch(dbQ, { selectedWeather: 'clear' })) === 'OK');
}

async function browserPhase() {
  // The app's own list queries are stricter than this local emulator can judge, so
  // the browser run gets permissive rules; the real rules were proven in fase 1.
  const testing = require(`${SYNCTEST}/node_modules/@firebase/rules-unit-testing`);
  const fstore = require(`${SYNCTEST}/node_modules/@firebase/firestore`);
  const testEnv = await testing.initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8899, rules: LOOSE_RULES },
  });
  say('fase 2: aplikasi nyata di Chrome');

  fs.rmSync(PROFILE, { recursive: true, force: true });
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
    { cwd: REPO, log: `${WORK}/preview.log` }
  );
  if (!(await waitForPort(PORT, 60000))) throw new Error('preview tidak hidup');

  const chrome = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', 'about:blank'],
    { stdio: 'ignore' }
  );
  children.push(chrome);
  let cdp;
  for (let attempt = 0; attempt < 60 && !cdp; attempt++) {
    await sleep(400);
    try {
      const info = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
      cdp = new Connection(new WebSocket(info.webSocketDebuggerUrl));
      await sleep(200);
    } catch {
      // Chrome is still starting.
    }
  }
  if (!cdp) throw new Error('Chrome tidak menjawab');

  const warnings = [];
  const consoleLines = [];
  cdp.onEvent = (method, params) => {
    if (method === 'Runtime.exceptionThrown') {
      const detail = params.exceptionDetails;
      consoleLines.push(`EXC ${detail.exception ? detail.exception.description : detail.text}`);
      return;
    }
    if (method !== 'Runtime.consoleAPICalled') return;
    const text = (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    consoleLines.push(`${params.type} ${text}`);
    if (/Firestore|notifikasi gagal|Error/i.test(text)) warnings.push(text);
  };

  const page = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
  const sid = attached.sessionId;
  await cdp.send('Runtime.enable', {}, sid);
  await cdp.send('Page.enable', {}, sid);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sid);

  await cdp.send('Page.navigate', { url: `${ORIGIN}/` }, sid);
  await waitFor(cdp, sid, `location.href.startsWith('${ORIGIN}')`, 30000);
  await evaluate(cdp, sid, `localStorage.setItem('gt_visited_v1','true'); localStorage.setItem('gt_demo_mode','false'); 'ok'`);
  await cdp.send('Page.navigate', { url: `${ORIGIN}/` }, sid);

  // The entry screen is the phone's only chance to prove which build it loaded.
  const entryVisible = await waitFor(cdp, sid, hasText('Masuk dengan Kode Ruang'), 40000);
  check('layar masuk kode ruang terbuka', entryVisible);
  check(
    'layar masuk menampilkan penanda versi',
    await waitFor(cdp, sid, hasText(`GrowTogether v${APP_VERSION}`), 15000),
    await evaluate(cdp, sid, `document.body ? ((document.body.innerText.match(/GrowTogether v[\\d.]+/) || [''])[0]) : ''`)
  );

  // Discover the anonymous uid the app just created, then plant a room around it.
  const dbAdmin = testEnv.authenticatedContext('seedAdmin').firestore();
  let uid = '';
  const uidDeadline = Date.now() + 60000;
  while (Date.now() < uidDeadline && !uid) {
    const snap = await fstore.getDocs(fstore.collection(dbAdmin, 'users'));
    const found = snap.docs.find((d) => !plantedUids.includes(d.id));
    uid = found ? found.id : '';
    if (!uid) await sleep(1000);
  }
  check('perangkat punya identitas anonim di server', !!uid, uid);
  if (!uid) throw new Error('tanpa uid tidak ada ruang untuk diuji');

  const stamp = Date.now().toString(36).toUpperCase().slice(0, 8);
  const partnerUid = `partner${stamp}`;
  const coupleId = `couple_ui_${stamp}`;
  const code = `DEKO${stamp}`;
  const nowIso = new Date().toISOString();
  const partnerDb = testEnv.authenticatedContext(partnerUid).firestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await fstore.setDoc(fstore.doc(db, 'couples', coupleId), {
      id: coupleId, user1Id: partnerUid, user2Id: uid, roomCode: code,
      user1Profile: { id: partnerUid, displayName: 'Rama', email: '', colorTheme: 'coral', inviteCode: code },
      user2Profile: { id: uid, displayName: 'Sena', email: '', colorTheme: 'teal' },
      levelXp: 900, levelNumber: 5, graceDayUsedThisWeek: false,
      weeklyReadingMinutesGoal: 300, weeklyStudyMinutesGoal: 200,
      jokerCardsUser1: 2, jokerCardsUser2: 2, allSanctionsPaused: false,
      unlockedDecorations: [], selectedTimeOfDay: 'auto', selectedWeather: 'clear',
      createdAt: nowIso, updatedAt: nowIso,
    });
    await fstore.setDoc(fstore.doc(db, 'users', uid), { id: uid, displayName: 'Sena', coupleId, colorTheme: 'teal', inviteCode: 'SENA1', createdAt: nowIso, updatedAt: nowIso });
    await fstore.setDoc(fstore.doc(db, 'users', partnerUid), { id: partnerUid, displayName: 'Rama', coupleId, colorTheme: 'coral', inviteCode: code, createdAt: nowIso, updatedAt: nowIso });
    await fstore.setDoc(fstore.doc(db, 'inviteCodes', code), { userId: partnerUid, coupleId, ownerName: 'Rama', colorTheme: 'coral', updatedAt: nowIso });
  });

  // Eight consecutive couple-visible days: the streak has to be derived from these,
  // because nothing in the app has ever written couple.combinedStreak.
  for (let back = 0; back < 8; back++) {
    const date = localDate(back);
    await fstore.setDoc(fstore.doc(partnerDb, 'logs', `habit_seed_${date}_${partnerUid}`), {
      id: `habit_seed_${date}_${partnerUid}`,
      habitId: 'habit_seed',
      userId: partnerUid,
      coupleId,
      date,
      completed: true,
      durationMinutes: 30,
      visibility: 'couple',
    });
  }
  // A private day the partner cannot see must not change what either phone shows.
  await fstore.setDoc(fstore.doc(dbAdmin, 'logs', `habit_priv_${localDate(9)}_${partnerUid}`), {
    id: `habit_priv_${localDate(9)}_${partnerUid}`, habitId: 'habit_seed', userId: partnerUid, coupleId,
    date: localDate(9), completed: true, durationMinutes: 30, visibility: 'private',
  });

  await cdp.send('Page.navigate', { url: `${ORIGIN}/?tab=garden` }, sid);
  const inRoom = await waitFor(
    cdp,
    sid,
    `(() => { try { const s = JSON.parse(localStorage.getItem('gt_state_v1') || 'null'); return !!s && !!s.couple && s.couple.id === '${coupleId}'; } catch { return false; } })()`,
    45000
  );
  check('perangkat masuk ke ruang bersama', inRoom);
  if (!inRoom) {
    console.log('DIAG warnings=' + JSON.stringify(warnings.slice(-8)));
    throw new Error('tidak masuk ruang, sisa tes tidak berarti');
  }

  await waitFor(cdp, sid, hasText('Taman Pertumbuhan'), 20000);
  await evaluate(
    cdp,
    sid,
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '2D Aksesibel')?.click(); 'ok'`
  );
  const garden2d = await waitFor(cdp, sid, hasText('Hari Streak'), 15000);
  // The footer paints with whatever is in state first, so wait for the partner's
  // eight shared days to actually land before reading the number.
  const streakLanded = await waitFor(cdp, sid, hasText('8 Hari Streak'), 25000);
  const streakText = await evaluate(
    cdp,
    sid,
    `document.body ? ((document.body.innerText.match(/(\\d+)\\s*Hari Streak/) || ['',''])[1]) : ''`
  );
  check('taman 2D tampil', garden2d);
  const stateLogs = await evaluate(
    cdp,
    sid,
    `(() => { try {
        const s = JSON.parse(localStorage.getItem('gt_state_v1') || '{}');
        const rows = s.logs || [];
        return { total: rows.length, coupleVisible: rows.filter((l) => l.visibility === 'couple').length,
                 sample: rows.slice(0, 3).map((l) => l.date + ':' + l.visibility) };
      } catch (e) { return String(e); } })()`
  );
  check('streak 8 hari muncul di taman dari log pasangan', streakLanded && streakText === '8', {
    streakText,
    stateLogs,
  });

  const shopButton = await evaluate(
    cdp,
    sid,
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi')); return b ? b.textContent.trim() : ''; })()`
  );
  check('tombol toko menyebut saldo XP ruang', /Toko Dekorasi \(\d+ XP\)/.test(shopButton), shopButton);

  await evaluate(cdp, sid, `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Toko Dekorasi'))?.click(); 'ok'`);
  const modalUp = await waitFor(cdp, sid, hasText('XP Pasangan Saat Ini'), 15000);
  check('modal toko dekorasi terbuka', modalUp);
  const before = await balance(cdp, sid);
  check('modal menampilkan 900 XP dan 0 dari 5 terpasang', String(before.xp) === '900' && String(before.count) === '0', before);

  const buyByCost = async (cost, expectedXp, expectedCount) => {
    const clicked = await evaluate(
      cdp,
      sid,
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Buka ${cost} XP')); if (!b || b.disabled) return 'no'; b.click(); return 'ok'; })()`
    );
    if (clicked !== 'ok') return { clicked };
    const settled = await waitFor(cdp, sid, bannerIs(expectedXp, expectedCount), 25000);
    return { clicked, settled, status: await statusText(cdp, sid), after: await balance(cdp, sid) };
  };

  const lanterns = await buyByCost(200, 700, 1);
  check('beli lampion 200 XP berhasil dari antarmuka', lanterns.clicked === 'ok' && lanterns.settled === true, lanterns);

  const swing = await buyByCost(150, 550, 2);
  check('beli ayunan 150 XP berhasil', swing.clicked === 'ok' && swing.settled === true, swing);
  check('setelah dua belanja tersisa 550 XP dan 2 terpasang', String(swing.after?.xp) === '550' && String(swing.after?.count) === '2', swing.after);

  // Same XP the shop just spent has to be the number the server holds.
  let serverCouple = {};
  const serverDeadline = Date.now() + 20000;
  while (Date.now() < serverDeadline) {
    serverCouple = (await fstore.getDoc(fstore.doc(dbAdmin, 'couples', coupleId))).data() || {};
    if (serverCouple.levelXp === 550 && (serverCouple.unlockedDecorations || []).length === 2) break;
    await sleep(500);
  }
  check(
    'penulisan toko sampai ke server (XP + daftar dekorasi)',
    serverCouple.levelXp === 550 && JSON.stringify(serverCouple.unlockedDecorations) === JSON.stringify(['lanterns', 'swing']),
    { levelXp: serverCouple.levelXp, unlockedDecorations: serverCouple.unlockedDecorations }
  );

  await evaluate(cdp, sid, `document.querySelector('[role="dialog"][aria-label="Toko dekorasi taman"] button')?.click(); 'ok'`);
  const decorated = await waitFor(
    cdp,
    sid,
    `(() => { const t = [...document.querySelectorAll('svg title')].map(x => x.textContent).join('|');
       return t.includes('Lampion Bambu Bercahaya') && t.includes('Ayunan Kayu Berdua'); })()`,
    20000
  );
  const titles = await evaluate(cdp, sid, `[...document.querySelectorAll('svg title')].map(t => t.textContent).join('|')`);
  check(
    'taman 2D menampilkan dekorasi yang baru dibeli (dulu hanya 2 dari 5 yang digambar)',
    decorated,
    { titles }
  );

  // XP that is gone must not buy anything else.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fstore.setDoc(fstore.doc(ctx.firestore(), 'couples', coupleId), { levelXp: 100 }, { merge: true });
  });
  // The phone must first see the smaller balance, otherwise "nothing affordable"
  // would be proven against the old number.
  const sawNewBalance = await waitFor(
    cdp,
    sid,
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi'));
      return !!b && b.textContent.includes('(100 XP)'); })()`,
    20000
  );
  await evaluate(cdp, sid, `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Toko Dekorasi'))?.click(); 'ok'`);
  const tight = await waitFor(cdp, sid, hasText('XP Pasangan Saat Ini'), 15000);
  const lockState = await evaluate(
    cdp,
    sid,
    `(() => { const btns = [...document.querySelectorAll('button')].filter(b => /^(Buka )?(\\d+) XP$/.test(b.textContent.trim()));
      return { total: btns.length, enabled: btns.filter(b => !b.disabled).length, texts: btns.map(b => b.textContent.trim()) }; })()`
  );
  check('dengan 100 XP tidak ada item yang bisa dibuka', sawNewBalance && tight && lockState.enabled === 0, { sawNewBalance, ...lockState });

  // Atmosphere controls write to the same room document the garden reads back.
  await evaluate(cdp, sid, `document.querySelector('[role="dialog"][aria-label="Toko dekorasi taman"] button')?.click(); 'ok'`);
  await evaluate(cdp, sid, `(() => { const b=[...document.querySelectorAll('button')].find(x => x.textContent.includes('Pelangi')); if (b) b.click(); return 'ok'; })()`);
  let serverWeather = '';
  const weatherDeadline = Date.now() + 20000;
  while (Date.now() < weatherDeadline && serverWeather !== 'rainbow') {
    serverWeather = (await fstore.getDoc(fstore.doc(dbAdmin, 'couples', coupleId))).data()?.selectedWeather ?? '';
    if (serverWeather !== 'rainbow') await sleep(500);
  }
  check('cuaca pelangi tersimpan ke ruang bersama', serverWeather === 'rainbow', { serverWeather });

  // Version marker inside the app, where both phones can compare it.
  await evaluate(
    cdp,
    sid,
    `[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Buka pengaturan pasangan dan profil')?.click(); 'ok'`
  );
  const settingsUp = await waitFor(cdp, sid, hasText('Pengaturan pasangan'), 15000);
  check('pengaturan terbuka', settingsUp);
  await evaluate(
    cdp,
    sid,
    `[...document.querySelectorAll('button[role="tab"]')].find(b => b.textContent.includes('Sinkronisasi'))?.click(); 'ok'`
  );
  const versionShown = await waitFor(cdp, sid, hasText(`Versi aplikasi: v${APP_VERSION}`), 15000);
  check('tab Sinkronisasi menampilkan penanda versi', versionShown);

  // XP is also the currency, so a document that somehow holds a negative balance
  // must still read as zero on both phones instead of offering free purchases.
  await evaluate(cdp, sid, `document.querySelector('[role="dialog"][aria-label="Tutup pengaturan"]')?.click(); 'ok'`);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fstore.setDoc(fstore.doc(ctx.firestore(), 'couples', coupleId), { levelXp: -50 }, { merge: true });
  });
  await cdp.send('Page.navigate', { url: `${ORIGIN}/?tab=garden` }, sid);
  // The 2D island is what prints the streak number, and the choice resets per load.
  await waitFor(cdp, sid, `!!document.body && document.body.innerText.includes('Taman Pertumbuhan')`, 40000);
  await evaluate(
    cdp,
    sid,
    `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '2D Aksesibel')?.click(); 'ok'`
  );
  const negativeSeen = await waitFor(
    cdp,
    sid,
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi'));
      return !!b && b.textContent.includes('(0 XP)'); })()`,
    30000
  );
  const negativeShown = await evaluate(
    cdp,
    sid,
    `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Toko Dekorasi'));
      return { button: b ? b.textContent.trim() : '', minus: !!document.body && document.body.innerText.includes('-50') }; })()`
  );
  check('saldo negatif di server tampil sebagai 0 XP, bukan -50', negativeSeen && !negativeShown.minus, negativeShown);

  // A tab left open across midnight: the streak must wake into the new day. The
  // page is given a clock it can be moved with, starting at the real time so
  // nothing else in this run changes behaviour. Patching the live document is
  // enough because the app only reads Date when a day is asked for.
  const clockArmed = await evaluate(
    cdp,
    sid,
    `(() => {
      const Real = window.Date;
      let offset = 0;
      window.__gtShift = (ms) => { offset = ms; };
      class Fake extends Real {
        constructor(...args) { if (args.length === 0) super(Real.now() + offset); else super(...args); }
        static now() { return Real.now() + offset; }
      }
      window.Date = Fake;
      return typeof window.__gtShift === 'function' && new Date().getTime() === Real.now();
    })()`
  );
  check('halaman berjalan dengan jam yang bisa dimajukan', clockArmed === true, { clockArmed });

  // The partner finishes tomorrow's habit while this phone is still asleep on today.
  const tomorrow = localDate(-1);
  await fstore.setDoc(fstore.doc(partnerDb, 'logs', `habit_seed_${tomorrow}_${partnerUid}`), {
    id: `habit_seed_${tomorrow}_${partnerUid}`, habitId: 'habit_seed', userId: partnerUid,
    coupleId, date: tomorrow, completed: true, durationMinutes: 30, visibility: 'couple',
  });
  // Until the day actually turns, a log that lies ahead of today must not count.
  const beforeMidnight = await waitFor(cdp, sid, hasText('8 Hari Streak'), 30000);
  await sleep(1500);
  const midnight = await evaluate(
    cdp,
    sid,
    `(() => { window.__gtShift(24 * 60 * 60 * 1000); window.dispatchEvent(new Event('focus'));
      return { tomorrow: new Date().toLocaleDateString('sv') }; })()`
  );
  const afterMidnight = await waitFor(cdp, sid, hasText('9 Hari Streak'), 30000);
  const streakAfter = await evaluate(
    cdp,
    sid,
    `document.body ? ((document.body.innerText.match(/(\\d+)\\s*Hari Streak/) || ['',''])[1]) : ''`
  );
  check(
    'tab yang terbuka melewati tengah malam ikut hari baru (8 -> 9 hari)',
    beforeMidnight && afterMidnight && streakAfter === '9',
    { beforeMidnight, midnight, streakAfter }
  );
  // A newer build must announce itself instead of leaving this phone on old numbers.
  const packagePath = `${REPO}/package.json`;
  const originalPackage = fs.readFileSync(packagePath, 'utf8');
  try {
    fs.writeFileSync(packagePath, originalPackage.replace(`"version": "${APP_VERSION}"`, `"version": "${NEXT_VERSION}"`));
    const rebuild = await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', 'dist-emulator'], {
      cwd: REPO,
      env: { ...process.env, VITE_FIREBASE_EMULATOR: '1' },
    });
    check('build kedua dengan versi baru selesai', rebuild.code === 0, rebuild.code === 0 ? undefined : rebuild.out.slice(-800));
    // Bypass the HTTP cache so the update check really sees the new worker bytes.
    const updateAsked = await evaluate(
      cdp,
      sid,
      `fetch('/sw.js', { cache: 'reload' })
        .then(() => navigator.serviceWorker.getRegistration())
        .then((r) => r ? r.update() : null)
        .then((r) => !!r)`,
    );
    check('pemeriksaan pembaruan dijalankan', updateAsked === true, { updateAsked });
    const bannerUp = await waitFor(cdp, sid, hasText(`Versi baru v${NEXT_VERSION}`), 40000);
    const banner = await evaluate(
      cdp,
      sid,
      `(() => { const el = [...document.querySelectorAll('div[role="status"]')].find(d => d.innerText.includes('Versi baru')); return el ? el.innerText.replace(/\\s+/g, ' ').trim() : ''; })()`
    );
    check(
      'halaman yang masih memakai build lama menawarkan muat ulang dan menyebut kedua versi',
      bannerUp && banner.includes(`v${NEXT_VERSION}`) && banner.includes(`v${APP_VERSION}`),
      { banner }
    );
    // Mark this document, then let the banner's own button reload the page. The
    // marker being gone again is the proof that the reload really happened here.
    await evaluate(cdp, sid, `window.__gtOldBuild = true; 'ok'`);
    const reloaded = await evaluate(
      cdp,
      sid,
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Muat ulang'); if (!b) return 'no'; b.click(); return 'ok'; })()`
    );
    const pageReplaced = await waitFor(cdp, sid, `window.__gtOldBuild === undefined`, 40000);
    const backInRoom = await waitFor(cdp, sid, hasText('Taman Pertumbuhan'), 40000);
    await evaluate(
      cdp,
      sid,
      `[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Buka pengaturan pasangan dan profil')?.click(); 'ok'`
    );
    const settingsAgain = await waitFor(cdp, sid, hasText('Pengaturan pasangan'), 20000);
    await evaluate(
      cdp,
      sid,
      `[...document.querySelectorAll('button[role="tab"]')].find(b => b.textContent.includes('Sinkronisasi'))?.click(); 'ok'`
    );
    const newVersionShown = await waitFor(cdp, sid, hasText(`Versi aplikasi: v${NEXT_VERSION}`), 20000);
    const bannerGone = await evaluate(cdp, sid, `document.body ? !document.body.innerText.includes('Versi baru v') : false`);
    check(
      'muat ulang dari banner benar-benar memakai build baru',
      reloaded === 'ok' && pageReplaced && backInRoom && settingsAgain && newVersionShown && bannerGone,
      { reloaded, pageReplaced, backInRoom, settingsAgain, newVersionShown, bannerGone }
    );
  } finally {
    fs.writeFileSync(packagePath, originalPackage);
  }

  console.log('DIAG warnings=' + JSON.stringify(warnings.slice(-10)));
  console.log('DIAG console=' + JSON.stringify(consoleLines.slice(-25)));
}

async function main() {
  for (const [label, dir] of [['GT_JDK', JDK], ['GT_CLI', CLI], ['GT_SYNCTEST', SYNCTEST]]) {
    if (!fs.existsSync(dir)) throw new Error(`${label} tidak ditemukan di ${dir}`);
  }
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome tidak ditemukan di ${CHROME} (atur GT_CHROME)`);
  if (await portOpen(8899)) throw new Error('emulator masih hidup di 8899, matikan dulu');
  fs.mkdirSync(WORK, { recursive: true });
  say(`versi yang dibuktikan: v${APP_VERSION}`);

  say('menyalakan emulator firestore + auth');
  start(
    process.execPath,
    ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT, '--config', `${REPO}/firebase.json`],
    {
      cwd: CLI,
      log: `${WORK}/emulator.log`,
      env: { ...process.env, JAVA_HOME: JDK, PATH: `${JDK}/bin;${process.env.PATH}` },
    }
  );
  const ready = (await waitForPort(8899)) && (await waitForPort(9199));
  check('emulator hidup', ready);
  if (!ready) throw new Error('emulator tidak siap');

  await rulesPhase();
  await browserPhase();
}

main()
  .then(() => stopEverything().then(() => process.exit(failures ? 1 : 0)))
  .catch(async (err) => {
    console.log('RUN GAGAL: ' + (err && err.stack ? err.stack : String(err)));
    await stopEverything();
    process.exit(1);
  });
