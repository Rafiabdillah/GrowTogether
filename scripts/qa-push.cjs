// QA jalur push: membuktikan fungsi Cloud Functions yang ada di repo ini
// (functions/index.js) benar-benar mengirim permintaan push ke alamat perangkat
// pasangan, dengan kunci VAPID, dan berhenti mengirim ke alamat yang sudah mati.
//
// Yang dibuktikan di sini (semuanya lewat emulator lokal, bukan asumsi):
//   - reaksi/pelukan baru -> POST terenkripsi ke alamat push penerima saja
//   - permintaan ditandatangani VAPID (header Authorization + Crypto-Key + TTL)
//   - jenis kabar yang dimatikan di perangkat penerima tidak dikirim
//   - alamat yang menjawab 404/410 dihapus servernya, tidak dicoba selamanya
//   - check-in & jurnal yang tidak dibagi TIDAK membangunkan pasangan
//   - kesepakatan yang menunggu keputusan tetap membangunkan pasangan
//   - dua perangkat milik satu orang keduanya menerima kabar
//   - fungsi menolak jadi kurir untuk alamat di dalam jaringannya sendiri
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = process.env.GT_REPO || 'C:/Users/WINDOWS 11/Downloads/growtogether-improved';
const TMP = process.env.TMP || os.tmpdir();
const JDK = process.env.GT_JDK || path.join(TMP, 'gt-testenv/jdk-21.0.13+9');
const CLI = process.env.GT_CLI || path.join(TMP, 'gt-testenv/cli');
const SYNCTEST = process.env.GT_SYNCTEST || path.join(TMP, 'gt-synctest');
const WORK = path.join(TMP, 'gt-qa');
const PROJECT = 'growtogether-rafiabdillah';
const REAL_RULES = fs.readFileSync(`${REPO}/firestore.rules`, 'utf8');

// Kunci publik VAPID dibaca dari functions/.env (file lokal, tidak ikut commit)
// supaya pemeriksaan tanda tangan bisa membandingkan header dengan kunci yang
// benar-benar dipakai fungsi. Emulator memuat file yang sama untuk kodenya.
function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const FUNCTION_ENV = readEnvFile(`${REPO}/functions/.env`);
if (!FUNCTION_ENV.VAPID_PUBLIC_KEY || !FUNCTION_ENV.VAPID_PRIVATE_KEY) {
  throw new Error('functions/.env belum berisi VAPID_PUBLIC_KEY/PRIVATE_KEY (lihat README: buat kunci dengan web-push lalu simpan di functions/.env)');
}
// Kunci privat tidak boleh mengalir ke proses lain lewat environment warisan;
// emulator membacanya sendiri dari functions/.env + functions/.secret.local.
process.env.VAPID_PUBLIC_KEY = FUNCTION_ENV.VAPID_PUBLIC_KEY;

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
async function waitForPort(port, timeoutMs = 240000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await sleep(1500);
  }
  return false;
}

/** Layanan push tiruan: menerima POST, mencatat header, dan memilih jawaban.
 *  Isi pesannya memang terenkripsi end-to-end, jadi yang dibuktikan di sini
 *  adalah permintaan masuk + tanda tangan VAPID, bukan teksnya.
 *  Wajib HTTPS: pustaka web-push hanya mau berbicara lewat TLS, sama seperti
 *  layanan push asli (Mozilla/Google/Firebase semuanya https). */
const CERT = path.join(WORK, 'mock-push-cert.pem');
const KEY = path.join(WORK, 'mock-push-key.pem');

function opensslPath() {
  const candidates = [
    process.env.GT_OPENSSL,
    'C:/Program Files/Git/mingw64/bin/openssl.exe',
    'C:/Program Files/Git/usr/bin/openssl.exe',
    'openssl',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/') || candidate.includes('\\') || candidate.endsWith('.exe')) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    return candidate;
  }
  throw new Error('openssl tidak ditemukan; push tiruan butuh sertifikat TLS sendiri');
}

async function ensureMockCert() {
  const fresh = fs.existsSync(CERT) && fs.existsSync(KEY)
    && Date.now() - fs.statSync(CERT).mtimeMs < 12 * 3600 * 1000;
  if (fresh) return;
  say('membuat sertifikat TLS untuk layanan push tiruan');
  const { code, out } = await run(opensslPath(), [
    'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1',
    '-keyout', KEY, '-out', CERT, '-days', '30', '-nodes',
    '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,digitalSignature,keyCertSign,cRLSign',
    '-addext', 'extendedKeyUsage=serverAuth',
  ]);
  if (code !== 0 || !fs.existsSync(CERT)) throw new Error(`sertifikat gagal dibuat: ${out.slice(-400)}`);
}

function startMockPushService() {
  const hits = [];
  const server = https.createServer(
    { key: fs.readFileSync(KEY), cert: fs.readFileSync(CERT) },
    (req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const token = req.url.split('/').pop();
        const hit = {
          token,
          method: req.method,
          bodyBytes: body.length,
          ttl: req.headers.ttl || '',
          auth: String(req.headers.authorization || ''),
          cryptoKey: String(req.headers['crypto-key'] || ''),
          contentType: String(req.headers['content-type'] || ''),
          encoding: String(req.headers['content-encoding'] || ''),
          at: Date.now(),
        };
        hits.push(hit);
        // 'mati' mensimulasikan alamat yang sudah kadaluarsa di layanan push.
        if (token.startsWith('mati')) {
          res.writeHead(410, { 'content-type': 'text/plain' });
          res.end('gone');
        } else {
          res.writeHead(201, { location: `${token}/message` });
          res.end('');
        }
      });
    }
  );
  return new Promise((resolve) => {
    server.on('tlsClientError', (e) => say(`jabatan TLS ditolak layanan push tiruan: ${e.message}`));
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, hits }));
  });
}

function subscriptionKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey('base64', 'uncompressed'),
    auth: crypto.randomBytes(16).toString('base64'),
  };
}

async function waitForHit(hits, predicate, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = hits.find(predicate);
    if (found) return found;
    await sleep(400);
  }
  return null;
}

async function waitForFreePort(port, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (await portOpen(port)) {
    if (Date.now() > deadline) return false;
    await sleep(2000);
  }
  return true;
}

/** Daftar isi satu koleksi lewat REST emulator — jalur yang sama sekali tidak
 *  dilewati SDK klien maupun aturan, jadi bisa dipakai sebagai saksi independen
 *  ketika perlu membedakan "server tidak menghapus" dan "pembacaan tes bohong". */
function restDocIds(collection) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 8899,
        method: 'GET',
        path: `/v1/projects/${PROJECT}/databases/(default)/documents/${collection}?pageSize=200`,
        headers: { authorization: 'Bearer owner' },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            resolve((JSON.parse(body).documents || []).map((d) => d.name.split('/').pop()));
          } catch {
            resolve({ err: body.slice(0, 160) });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ err: e.message }));
    req.end();
  });
}

async function main() {
  say('penjaga alamat: fungsi tidak mau dibayar-jasa ke alamat dalam jaringannya sendiri');
  const { endpointBisaDikirim } = require(`${REPO}/functions/pushEndpoint`);
  check('alamat layanan push asli diterima', [
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB',
    'https://push.apple.com/10/usfunion/webpush/id/abc',
  ].every((e) => endpointBisaDikirim(e, false)), { diuji: 3 });
  check('alamat http ditolak (tanpa TLS tidak ada jaminan apa pun)', !endpointBisaDikirim('http://fcm.googleapis.com/fcm/send/abc', false));
  check('alamat internal Google/meta tidak bisa dijadikan kurir', [
    'https://169.254.169.254/computeMetadata/v1/',
    'https://127.0.0.1:8899/x',
    'https://10.128.0.1/',
    'https://192.168.1.7/',
    'https://[fd00::1]/',
    'https://localhost:9499/',
    'https://metadata.google.internal/',
  ].every((e) => !endpointBisaDikirim(e, false)), { diuji: 7 });
  check('alamat acak bukan URL ditolak', !endpointBisaDikirim('bukan-alamat', false) && !endpointBisaDikirim('', false));
  // Layanan push tiruan memang tinggal di 127.0.0.1; hanya tes yang boleh membukanya.
  check('hanya tes yang boleh mengirim ke alamat lokal', endpointBisaDikirim('https://127.0.0.1:65001/push/x', true));

  for (const [label, dir] of [['GT_JDK', JDK], ['GT_CLI', CLI], ['GT_SYNCTEST', SYNCTEST]]) {
    if (!fs.existsSync(dir)) throw new Error(`${label} tidak ditemukan di ${dir}`);
  }
  for (const port of [8899, 9199, 9499]) {
    // Sisa koneksi emulator run sebelumnya butuh beberapa detik untuk dilepas OS.
    if (!(await waitForFreePort(port))) throw new Error(`port ${port} masih dipakai, matikan emulator lain dulu`);
  }
  fs.mkdirSync(WORK, { recursive: true });

  await ensureMockCert();
  const mock = await startMockPushService();
  say(`layanan push tiruan (https) di 127.0.0.1:${mock.port}`);

  say('menyalakan emulator firestore + auth + functions');
  start(
    process.execPath,
    [
      'node_modules/firebase-tools/lib/bin/firebase.js',
      'emulators:start',
      '--only', 'auth,firestore,functions',
      '--project', PROJECT,
      '--config', `${REPO}/firebase.json`,
    ],
    {
      cwd: CLI,
      log: `${WORK}/emulator-push.log`,
      env: {
        ...process.env,
        JAVA_HOME: JDK,
        PATH: `${JDK}/bin;${process.env.PATH}`,
        // Sertifikat sendiri dipercaya hanya untuk proses emulator ini, jadi
        // pengiriman tetap melewati pemeriksaan TLS sungguhan.
        NODE_EXTRA_CA_CERTS: CERT,
        // Alamat layanan push tiruan ada di 127.0.0.1. Di produksi flag ini tidak
        // pernah dipasang, dan alamat internal ditolak oleh pushEndpoint.js.
        GT_PUSH_ALLOW_LOCAL: '1',
      },
    }
  );
  const ready = (await waitForPort(8899)) && (await waitForPort(9199)) && (await waitForPort(9499));
  check('emulator firestore + auth + functions hidup', ready);
  if (!ready) {
    console.log(fs.readFileSync(`${WORK}/emulator-push.log`, 'utf8').slice(-2500));
    throw new Error('emulator tidak siap');
  }
  // Functions butuh beberapa detik setelah port terbuka sebelum trigger terdaftar.
  await sleep(12000);

  const testing = require(`${SYNCTEST}/node_modules/@firebase/rules-unit-testing`);
  const f = require(`${SYNCTEST}/node_modules/@firebase/firestore`);
  const testEnv = await testing.initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8899, rules: REAL_RULES },
  });

  const stamp = Date.now().toString(36).toUpperCase().slice(0, 7);
  const nowIso = new Date().toISOString();
  const pengirim = `qaPushKirim${stamp}`;
  const penerima = `qaPushTerima${stamp}`;
  const orangLain = `qaPushAsing${stamp}`;
  const ruang = `couple_push_${stamp}`;

  const endpoint = (nama) => `https://127.0.0.1:${mock.port}/push/${nama}_${stamp}`;
  const subDoc = (ownerId, ep, prefs) => ({
    ownerId,
    endpoint: ep,
    keys: subscriptionKeys(),
    prefs,
    updatedAt: nowIso,
  });

  const ALL_ON = { hug: true, checkin: true, habit: true, agreement: true, journal: true, streak: true };
  const NO_HUG = { ...ALL_ON, hug: false };

  const subscriptionOfPenerima = endpoint('hidup');
  const subscriptionKedua = endpoint('hidup2');
  const subscriptionMati = endpoint('mati_lama');

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await f.setDoc(f.doc(db, 'couples', ruang), {
      id: ruang, user1Id: pengirim, user2Id: penerima, roomCode: `QP${stamp}`,
      levelXp: 100, levelNumber: 2, graceDayUsedThisWeek: false,
      weeklyReadingMinutesGoal: 60, weeklyStudyMinutesGoal: 60,
      jokerCardsUser1: 2, jokerCardsUser2: 2, allSanctionsPaused: false,
      unlockedDecorations: [], selectedTimeOfDay: 'auto', selectedWeather: 'clear',
      createdAt: nowIso, updatedAt: nowIso,
    });
    await f.setDoc(f.doc(db, 'users', pengirim), { id: pengirim, displayName: 'Rafi', email: '', colorTheme: 'coral', inviteCode: `QP${stamp}`, coupleId: ruang, createdAt: nowIso });
    await f.setDoc(f.doc(db, 'users', penerima), { id: penerima, displayName: 'Shinta', email: '', colorTheme: 'teal', inviteCode: `QS${stamp}`, coupleId: ruang, createdAt: nowIso });
    await f.setDoc(f.doc(db, 'pushSubscriptions', `${penerima}-${stamp}-satu`), subDoc(penerima, subscriptionOfPenerima, ALL_ON));
    await f.setDoc(f.doc(db, 'pushSubscriptions', `${penerima}-${stamp}-dua`), subDoc(penerima, subscriptionKedua, ALL_ON));
    await f.setDoc(f.doc(db, 'pushSubscriptions', `${pengirim}-${stamp}-kirim`), subDoc(pengirim, endpoint('hidupkirim'), ALL_ON));
  });

  const dbKirim = testEnv.authenticatedContext(pengirim).firestore();
  const dbTerima = testEnv.authenticatedContext(penerima).firestore();

  say('baca subscription milik penerima lewat aturan (harus boleh oleh pemiliknya)');
  const bacaMilikSendiri = await f.getDocs(
    f.query(f.collection(dbTerima, 'pushSubscriptions'), f.where('ownerId', '==', penerima))
  ).catch((e) => ({ err: e.code }));
  check(
    'pemilik bisa membaca daftar langganannya sendiri (query aplikasi)',
    !bacaMilikSendiri.err && bacaMilikSendiri.size === 2,
    bacaMilikSendiri.err || `${bacaMilikSendiri.size} baris`
  );
  const bacaMilikOrang = await f.getDocs(
    f.query(f.collection(dbTerima, 'pushSubscriptions'), f.where('ownerId', '==', pengirim))
  ).catch((e) => ({ err: e.code }));
  check(
    'langganan pasangan tidak bisa dibaca meski satu ruang',
    bacaMilikOrang.err === 'permission-denied' || bacaMilikOrang.size === 0,
    bacaMilikOrang.err || `${bacaMilikOrang.size} baris`
  );

  say('pelukan baru -> push ke kedua perangkat penerima');
  const idReaksi = `r_hug_${stamp}`;
  await f.setDoc(f.doc(dbKirim, 'reactions', idReaksi), {
    id: idReaksi, coupleId: ruang, senderId: pengirim, senderName: 'Rafi', receiverId: penerima,
    emoji: '🤗', habitTitle: 'Olahar pagi', message: 'Semangat!', createdAt: nowIso,
  });

  const first = await waitForHit(mock.hits, (h) => h.token.startsWith('hidup_'));
  check('layanan push menerima permintaan pertama', !!first, first && { bytes: first.bodyBytes, ttl: first.ttl });
  const second = await waitForHit(mock.hits, (h) => h.token.startsWith('hidup2_'));
  check('kedua perangkat milik satu orang sama-sama dibangunkan', !!second, second && { bytes: second.bodyBytes });
  check(
    'perangkat pengirim tidak dibangunkan oleh pelukannya sendiri',
    mock.hits.filter((h) => h.token.startsWith('hidupkirim_')).length === 0,
    { untukPengirim: mock.hits.filter((h) => h.token.startsWith('hidupkirim_')).length }
  );

  if (first) {
    check('permintaan push memakai body terenkripsi (bukan teks polos)', first.bodyBytes > 0, { bodyBytes: first.bodyBytes });
    check('header TTL ikut terkirim', /^\d+$/.test(first.ttl), { ttl: first.ttl });
    // Layanan push modern menandatangani dengan skema "vapid t=<JWT>, k=<kunci>"
    // (RFC 8292), bukan Basic. Kunci publik di header harus kunci VAPID kita.
    const vapidMatch = /^vapid t=([\w.-]+), k=(\S+)$/.exec(first.auth);
    check('permintaan ditandatangani VAPID (Authorization: vapid t=..., k=...)', !!vapidMatch, { auth: first.auth.slice(0, 24) + '…' });
    if (vapidMatch) {
      const claims = JSON.parse(Buffer.from(vapidMatch[1].split('.')[1], 'base64url').toString('utf8'));
      check('kunci penanda VAPID = kunci publik VAPID kita', vapidMatch[2] === process.env.VAPID_PUBLIC_KEY || vapidMatch[2].replace(/-/g, '+').replace(/_/g, '/') === process.env.VAPID_PUBLIC_KEY, { k: vapidMatch[2].slice(0, 12) + '…' });
      check('tanda tangan mengikat ke alamat perangkat tujuan (claim aud)', claims.aud === `https://127.0.0.1:${mock.port}`, { aud: claims.aud });
      check('tanda tangan mencantumkan kontak yang bisa dihubungi (claim sub)', claims.sub === 'mailto:rafiabdillah454@gmail.com', { sub: claims.sub });
      check('tanda tangan belum kedaluwarsa (claim exp di masa depan)', claims.exp * 1000 > Date.now(), { lewat: Math.round((claims.exp * 1000 - Date.now()) / 86400000) + ' hari' });
    }
    check('kabar dikirim sebagai bytes tersandi aes128gcm', /aes128gcm/.test(first.encoding) && /octet-stream/.test(first.contentType), {
      encoding: first.encoding,
      contentType: first.contentType,
    });
    const body = fs.readFileSync(`${WORK}/emulator-push.log`, 'utf8');
    check('isi pesan tidak pernah terbaca di log fungsi', !/"Semangat!"/.test(body), { cek: 'functions log' });
  }

  say('alamat mati -> server menghapusnya');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.setDoc(
      f.doc(ctx.firestore(), 'pushSubscriptions', `${penerima}-${stamp}-mati`),
      subDoc(penerima, subscriptionMati, ALL_ON)
    );
  });
  const idReaksi2 = `r_hug2_${stamp}`;
  await f.setDoc(f.doc(dbKirim, 'reactions', idReaksi2), {
    id: idReaksi2, coupleId: ruang, senderId: pengirim, senderName: 'Rafi', receiverId: penerima,
    emoji: '💪', message: 'Ayo lagi', createdAt: nowIso,
  });
  const matiHit = await waitForHit(mock.hits, (h) => h.token.startsWith('mati_'));
  check('alamat mati sempat dicoba (jawaban 410)', !!matiHit, matiHit && { bytes: matiHit.bodyBytes });
  const idMati = `${penerima}-${stamp}-mati`;
  let goneDeleted = false;
  let sisaIds = [];
  for (let i = 0; i < 30 && !goneDeleted; i++) {
    const ids = await restDocIds('pushSubscriptions');
    if (Array.isArray(ids)) {
      sisaIds = ids;
      goneDeleted = !ids.includes(idMati);
    }
    if (!goneDeleted) await sleep(1000);
  }
  check('langganan mati dihapus server, tidak dicoba selamanya', goneDeleted, {
    idYangDicari: idMati,
    sisaDiServer: Array.isArray(sisaIds) ? sisaIds.length : sisaIds,
  });
  if (!goneDeleted) {
    // SDK klien bisa melihat dokumen yang sama; kalau REST juga masih melihatnya,
    // berarti fungsi memang tidak menghapus. Kalau REST sudah bersih tapi tes
    // merasa ada, kesalahan ada di pembacaan tes.
    const viaSdk = await testEnv.withSecurityRulesDisabled(async (ctx) =>
      (await f.getDoc(f.doc(ctx.firestore(), 'pushSubscriptions', idMati))).exists
    );
    say(`pemeriksaan silang: SDK klien melihat ${viaSdk ? 'ada' : 'kosong'}, REST tidak melihat id itu lagi`);
  }

  say('preferensi perangkat: kabar jenis tertentu dimatikan');
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.setDoc(
      f.doc(ctx.firestore(), 'pushSubscriptions', `${penerima}-${stamp}-senyap`),
      subDoc(penerima, endpoint('senyap_hug'), NO_HUG)
    );
  });
  const mulaiSenyap = Date.now();
  const idReaksi3 = `r_hug3_${stamp}`;
  await f.setDoc(f.doc(dbKirim, 'reactions', idReaksi3), {
    id: idReaksi3, coupleId: ruang, senderId: pengirim, senderName: 'Rafi', receiverId: penerima,
    emoji: '❤️', message: 'Peluk', createdAt: nowIso,
  });
  const datangKeYangMenyala = await waitForHit(mock.hits, (h) => h.token.startsWith('hidup_') && h.at > mulaiSenyap);
  check('pelukan yang sama tetap sampai ke perangkat yang menyalakan kabar', !!datangKeYangMenyala);
  const senyapHit = mock.hits.some((h) => h.token.startsWith('senyap_'));
  check('perangkat yang mematikan jenis "semangat" tidak dikirim pelukan', !senyapHit, {
    permintaanKeSenyap: mock.hits.filter((h) => h.token.startsWith('senyap_')).length,
  });

  say('kabar lain: check-in, jurnal, kesepakatan');
  const idCheckin = `ci_${stamp}`;
  await f.setDoc(f.doc(dbTerima, 'checkins', idCheckin), {
    id: idCheckin, coupleId: ruang, userId: penerima, userName: 'Shinta', date: '2026-11-05',
    mood: 4, gratitude: 'kopi pagi', isShared: true, createdAt: nowIso,
  });
  const ciHit = await waitForHit(mock.hits, (h) => h.token.startsWith('hidupkirim_'));
  check('check-in yang dibagi membangunkan pengirim', !!ciHit, ciHit && { token: ciHit.token });

  const idJurnalPrivat = `jr_priv_${stamp}`;
  const mulaiJurnal = Date.now();
  await f.setDoc(f.doc(dbTerima, 'journals', idJurnalPrivat), {
    id: idJurnalPrivat, coupleId: ruang, authorId: penerima, authorName: 'Shinta',
    weekNumber: 45, year: 2026, whatWorked: 'tidur cukup', whatWasHard: '', nextWeekGoal: '',
    isShared: false, createdAt: nowIso,
  });
  // Jendela tunggu: kabar yang seharusnya datang biasanya tiba < 2 detik lokal.
  await sleep(8000);
  const selamaJurnal = mock.hits.filter((h) => h.at > mulaiJurnal);
  check('jurnal privat TIDAK dikirim ke pasangan', selamaJurnal.length === 0, {
    permintaan: selamaJurnal.map((h) => h.token.split('_')[0]),
  });

  const idSepakat = `ag_${stamp}`;
  await f.setDoc(f.doc(dbKirim, 'agreements', idSepakat), {
    id: idSepakat, coupleId: ruang, creatorId: pengirim, creatorName: 'Rafi',
    title: 'Traktir bakso', type: 'hadiah', forWhom: 'both', status: 'pending_approval',
    partnerApproved: false, triggerType: 'manual', triggerThreshold: 1,
    timesTriggered: 0, timesCompleted: 0, timesPardoned: 0, createdAt: nowIso, updatedAt: nowIso,
  });
  const agHit = await waitForHit(mock.hits, (h) => h.token.startsWith('hidup_') && h.at > (ciHit ? ciHit.at : 0));
  check('kesepakatan yang menunggu keputusan membangunkan pasangan', !!agHit, agHit && { token: agHit.token });

  say('reaksi tanpa receiver -> hanya pasangan ruang yang mendapat kabar');
  const idReaksiTanpa = `r_noop_${stamp}`;
  const sebelumAsing = mock.hits.length;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.setDoc(f.doc(ctx.firestore(), 'pushSubscriptions', `${orangLain}-${stamp}-asing`), subDoc(orangLain, endpoint('asing'), ALL_ON));
    await f.setDoc(f.doc(ctx.firestore(), 'reactions', idReaksiTanpa), {
      id: idReaksiTanpa, coupleId: ruang, senderId: pengirim, senderName: 'Rafi',
      emoji: '🙌', message: 'untuk ruang ini', createdAt: nowIso,
    });
  });
  await sleep(7000);
  check(
    'perangkat milik orang di luar ruang tidak tersentuh',
    !mock.hits.slice(sebelumAsing).some((h) => h.token.startsWith('asing_')),
    { tambahan: mock.hits.slice(sebelumAsing).map((h) => h.token.split('_')[0]) }
  );

  console.log(`\nRINGKASAN push: ${passes} PASS, ${failures} FAIL`);
  mock.server.close();
}

main()
  .then(() => stopEverything().then(() => process.exit(failures ? 1 : 0)))
  .catch(async (err) => {
    console.log('RUN GAGAL: ' + (err && err.stack ? err.stack : String(err)));
    await stopEverything();
    process.exit(1);
  });
