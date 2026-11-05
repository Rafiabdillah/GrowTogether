// QA jalur relay Telegram: modul pengirim (src/lib/telegramRelay.ts) diuji di
// dalam proses node terhadap bot Telegram TIRUAN di loopback — jadi harness ini
// tidak pernah menyentuh Telegram sungguhan dan tidak bisa mengirim pesan nyata.
//
// Yang dibuktikan:
//   - tanpa token / tanpa alamat chat, tidak ada satu permintaan pun keluar
//   - bentuk token divalidasi sebelum disimpan
//   - tiga kabar beruntun dilebur jadi SATU pesan, dan teksnya kalimat baku
//   - tidak ada konten privat yang ikut terkirim — body diperiksa apa adanya
//   - sesudah mengirim ada jeda, pasangan tidak dibombardir
//   - kabar yang tertahan tetap keluar, tidak hilang selamanya
//   - bot menolak dan jalur mati dicatat apa adanya di jejak, bukan sebagai sukses
//   - deteksi chat memakai pesan paling baru dan bilang jujur kalau belum ada
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const REPO = process.env.GT_REPO || 'C:/Users/WINDOWS 11/Downloads/growtogether-improved';
const WORK = path.join(process.env.TMP || os.tmpdir(), 'gt-qa');
const TOKEN = '1234567:AAtesttokenuntukqa0000000000000000000';
const PORT = Number(process.env.GT_RELAY_PORT || 9412);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
let passes = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (ok) passes++;
  else failures++;
}

// ---- jam palsu: antrian relay hidup dari setTimeout, tak mungkin ditunggu ----

let clock = Date.now();
const timers = [];
let timerSeq = 0;
function fakeSetTimeout(fn, ms) {
  const id = ++timerSeq;
  timers.push({ id, at: clock + Number(ms || 0), fn });
  return id;
}
function fakeClearTimeout(id) {
  const index = timers.findIndex((timer) => timer.id === id);
  if (index >= 0) timers.splice(index, 1);
}
// Maju per langkah kecil supaya request betulan punya kesempatan selesai.
async function advance(ms, step = 200) {
  const target = clock + ms;
  while (clock < target) {
    clock = Math.min(target, clock + step);
    const due = timers.filter((timer) => timer.at <= clock);
    for (const timer of due) {
      fakeClearTimeout(timer.id);
      timer.fn();
    }
    await sleep(3);
  }
}

// ---- bot tiruan ----

const seen = [];
const behaviour = {
  status: 200,
  // body(url, fields) -> objek jawaban; melempar = koneksi diputus
  body: () => ({ ok: true, result: { message_id: 1 } }),
};

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    const fields = Object.fromEntries(new URLSearchParams(raw).entries());
    seen.push({ url: req.url, raw, fields, contentType: req.headers['content-type'] });
    let payload;
    try {
      payload = JSON.stringify(behaviour.body(req.url, fields));
    } catch {
      res.socket?.destroy();
      return;
    }
    res.writeHead(behaviour.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(payload);
  });
});

function listen() {
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
}
function sendMessageCalls() {
  return seen.filter((entry) => entry.url.endsWith('/sendMessage'));
}

// ---- localStorage tiruan + muat modul TS apa adanya ----

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};

// Modul dipakai apa adanya (esbuild hanya melepas tipe), dengan setTimeout/clearTimeout
// yang dilihatnya diganti jam palsu — tanpa menyentuh timer global milik node.
function loadRelay() {
  const source = fs.readFileSync(`${REPO}/src/lib/telegramRelay.ts`, 'utf8');
  const { transformSync } = require('esbuild');
  const js = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  fs.mkdirSync(WORK, { recursive: true });
  const file = path.join(WORK, 'telegramRelay.qa.cjs');
  const mod = new Module(file, null);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(
    `const setTimeout = globalThis.__gtTimers.setTimeout;
     const clearTimeout = globalThis.__gtTimers.clearTimeout;\n${js}`,
    file
  );
  return mod.exports;
}

const RAHASIA = [
  'Belajar Termodinamika',
  'Minggu ini aku hampir menyerah',
  'Kapal malamku bocor',
  'Aku kangen kamu sekali',
  '❤',
];

async function main() {
  globalThis.__gtTimers = { setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout };
  globalThis.__GT_RELAY_API__ = `http://127.0.0.1:${PORT}`;
  await listen();
  const relay = loadRelay();
  const target = { chatId: '-1009876543210', chatName: 'HP Pasangan' };

  console.log('=== relay Telegram (bot tiruan di loopback, tidak pernah keluar) ===');

  try {
    // 1) belum ada token: tidak boleh ada satu permintaan pun
    const tanpaToken = relay.announceRelay('hug', 'Satu', target);
    await advance(10000);
    check('tanpa token, kabar ditolak dan tidak ada permintaan keluar',
      tanpaToken === 'no-token' && seen.length === 0, { tanpaToken, keluar: seen.length });

    // 2) bentuk token divalidasi sebelum disimpan
    const tokenSalah = relay.setRelayToken('bukan-token');
    check('token bot yang tidak berbentuk ditolak sebelum disimpan',
      tokenSalah === false && relay.relayToken() === '', { tokenSalah });
    const tokenBenar = relay.setRelayToken(TOKEN);
    check('token bot yang sah hanya tersimpan di perangkat ini',
      tokenBenar === true && relay.relayStatus().hasToken === true);

    // 3) tanpa alamat chat: masih belum ada permintaan
    const tanpaChat = relay.announceRelay('hug', 'Satu', null);
    await advance(10000);
    check('tanpa alamat chat pasangan, kabar berhenti sebelum kirim',
      tanpaChat === 'no-link' && seen.length === 0, { tanpaChat, keluar: seen.length });

    // 4) tiga kabar beruntun -> satu pesan
    const pertama = relay.announceRelay('hug', 'Satu', target);
    const kedua = relay.announceRelay('habit', 'Satu', target);
    const ketiga = relay.announceRelay('checkin', 'Satu', target);
    const keempat = relay.announceRelay('hug', 'Satu', target);
    await advance(6000);
    const burst = sendMessageCalls();
    const teks = burst[0] ? burst[0].fields.text : '';
    check('kabar beruntun diterima tanpa menggandakan antrian',
      pertama === 'queued' && kedua === 'merged' && ketiga === 'merged' && keempat === 'merged',
      { pertama, kedua, ketiga, keempat });
    check('tiga kabar beruntun jadi SATU pesan telegram', burst.length === 1, { jumlah: burst.length, teks });
    check('pesan gabungan menyebut jumlah, bukan isi',
      /^Ada 3 kabar dari Satu, termasuk pelukan\. /.test(teks) && teks.length < 160, teks);
    check('request berbentuk form tanpa header yang memicu preflight',
      burst.length === 1
        && /application\/x-www-form-urlencoded/.test(String(burst[0].contentType))
        && Object.keys(burst[0].fields).sort().join(',') === 'chat_id,disable_web_page_preview,text',
      burst[0] ? { tipe: burst[0].contentType, field: Object.keys(burst[0].fields) } : 'tidak ada');
    check('alamat tujuan dikirim sebagai field, bukan di path',
      !!burst[0] && burst[0].fields.chat_id === target.chatId, burst[0] && burst[0].fields.chat_id);

    // 5) tidak ada konten privat yang lolos
    const semuaBody = sendMessageCalls().map((entry) => entry.raw).join(' ');
    const bocor = RAHASIA.filter((kata) => semuaBody.includes(kata));
    check('tidak ada judul habit/jurnal/check-in/pesan yang ikut terkirim',
      bocor.length === 0, { bocor, cuplikan: semuaBody.slice(0, 120) });

    // 6) jeda setelah mengirim + kabar tertahan tetap keluar
    const jeda = relay.announceRelay('journal', 'Satu', target);
    await advance(1500);
    check('sesudah mengirim ada jeda, pasangan tidak dibombardir',
      jeda === 'queued' && sendMessageCalls().length === 1, { jeda, keluar: sendMessageCalls().length });
    await advance(120000);
    const sesudahJeda = sendMessageCalls();
    check('kabar yang tertahan tetap keluar, tidak hilang selamanya',
      sesudahJeda.length === 2 && /refleksi|kabar dari/.test(sesudahJeda[1].fields.text),
      { jumlah: sesudahJeda.length, teks: sesudahJeda[1] && sesudahJeda[1].fields.text });

    // 7) kabar tunggal + nama pengirim yang hilang
    relay.resetRelayQueue();
    seen.length = 0;
    relay.announceRelay('hug', 'Dua', target);
    await advance(6000);
    const tunggal = sendMessageCalls();
    check('kabar tunggal memakai kalimat baku jenisnya',
      tunggal.length === 1 && tunggal[0].fields.text === 'Dua mengirim pelukan untukmu. Buka GrowTogether untuk melihatnya.',
      tunggal[0] && tunggal[0].fields.text);

    relay.resetRelayQueue();
    seen.length = 0;
    relay.announceRelay('habit', '', target);
    await advance(6000);
    const tanpaNama = sendMessageCalls();
    check('nama pengirim kosong tidak menghasilkan kalimat rusak',
      tanpaNama.length === 1 && tanpaNama[0].fields.text.startsWith('pasanganmu baru menyelesaikan satu habit'),
      tanpaNama[0] && tanpaNama[0].fields.text);

    // 8) bot menolak -> tercatat jujur
    relay.resetRelayQueue();
    seen.length = 0;
    behaviour.status = 400;
    behaviour.body = () => ({ ok: false, description: 'chat not found' });
    relay.announceRelay('hug', 'Satu', target);
    await advance(6000);
    const jejakDitolak = relay.relayTrail()[0] || {};
    check('bot yang menolak tercatat sebagai ditolak, bukan terkirim',
      jejakDitolak.outcome === 'rejected' && jejakDitolak.detail === 'chat not found', jejakDitolak);

    // 9) koneksi diputus -> tercatat sebagai jaringan
    behaviour.status = 200;
    behaviour.body = () => { throw new Error('diputus'); };
    relay.resetRelayQueue();
    relay.announceRelay('hug', 'Satu', target);
    await advance(6000);
    const jejakJaringan = relay.relayTrail()[0] || {};
    check('jalur yang mati tercatat sebagai kegagalan, tidak pernah sebagai sukses',
      jejakJaringan.outcome === 'network' || jejakJaringan.outcome === 'rejected', jejakJaringan);

    // 10) deteksi chat
    behaviour.body = (url) => (url.endsWith('/getUpdates')
      ? {
          ok: true,
          result: [
            { update_id: 1, message: { date: 100, chat: { id: -100111, title: 'Chat Lama' } } },
            { update_id: 2, message: { date: 900, chat: { id: -100222, title: 'Chat Terbaru' } } },
          ],
        }
      : { ok: true, result: { message_id: 3 } });
    const ditemukan = await relay.discoverChat(TOKEN);
    check('deteksi chat memakai pesan paling baru',
      !!ditemukan.link && ditemukan.link.chatId === '-100222' && ditemukan.link.chatName === 'Chat Terbaru', ditemukan);

    behaviour.body = (url) => (url.endsWith('/getUpdates') ? { ok: true, result: [] } : { ok: true });
    const kosong = await relay.discoverChat(TOKEN);
    check('belum ada yang menekan /start dikatakan apa adanya',
      kosong.link === null && /start/.test(kosong.message), kosong);

    behaviour.body = () => ({ ok: false, description: 'Unauthorized' });
    const salahToken = await relay.discoverChat('9999999:AAtokenlaininyaaaaaaaaaaaaaaaaaaaaaaaaaa');
    check('token yang salah tidak menghasilkan alamat palsu',
      salahToken.link === null && salahToken.message === 'Unauthorized', salahToken);

    // 11) pesan tes manual: langsung, ke chat sendiri
    behaviour.body = () => ({ ok: true, result: { message_id: 4 } });
    relay.resetRelayQueue();
    seen.length = 0;
    relay.setRelayLink(target);
    const hasilTes = await relay.relayTest('Satu');
    const pesanTes = sendMessageCalls()[0];
    check('pesan tes terkirim tanpa menunggu antrian',
      hasilTes === 'sent' && sendMessageCalls().length === 1 && /pesan tes dari Satu/.test(pesanTes.fields.text),
      { hasilTes, teks: pesanTes && pesanTes.fields.text });

    // 12) status jujur untuk kartu pengaturan
    relay.setRelayToken('');
    relay.setRelayLink(null);
    const status = relay.relayStatus();
    check('token dibersihkan -> status menyebutkan blockersnya',
      status.hasToken === false && /token/.test(status.blocker), status);
    relay.setRelayToken(TOKEN);
    const statusBelumChat = relay.relayStatus();
    check('token ada tapi chat belum -> status belum mengaku siap',
      statusBelumChat.hasToken === true && statusBelumChat.link === null && /chat/.test(statusBelumChat.blocker),
      statusBelumChat);
  } finally {
    server.close();
  }

  console.log(`\nRINGKASAN relay: ${passes} PASS, ${failures} FAIL`);
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error('harness relay berhenti:', error);
  process.exit(1);
});
