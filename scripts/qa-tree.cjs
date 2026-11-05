// QA pelengkap pohon: src/lib/treeCraft.ts diuji sebagai fungsi murni, tanpa
// browser dan tanpa Firestore. Modul ini yang memegang janji "makin banyak misi
// yang tuntas, makin lengkap pohonnya", jadi rumusnya dibuktikan apa adanya.
//
// Yang dibuktikan:
//   - satu misi = satu habit milik satu orang pada satu hari
//   - baris log yang datang dua kali (tembolok lalu server) hanya sekali dihitung
//   - kebiasaan privat tidak pernah menumbuhkan pohon: pasangannya tidak melihat
//     habit itu, jadi pohon berdua tidak boleh bertumbuh karenanya
//   - satu bagian terbuka TEPAT pada ambangnya, tidak sebelum dan tidak sesudah
//   - jumlah bagian tidak pernah turun ketika misi bertambah, dan setiap ambang
//     menambahkan tepat satu bagian
//   - sesudah bagian terakhir tidak ada ambang palsu yang menunggu
//   - tiap bagian punya nama dan deskripsi yang bisa dibaca pengguna
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const REPO = process.env.GT_REPO || 'C:/Users/WINDOWS 11/Downloads/growtogether-improved';
const WORK = path.join(process.env.TMP || os.tmpdir(), 'gt-qa');

let failures = 0;
let passes = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (ok) passes++;
  else failures++;
}

// Modul dipakai apa adanya (esbuild hanya melepas tipe), supaya yang diuji adalah
// rumus yang benar-benar di-bundle ke aplikasi, bukan salinannya.
function loadTreeCraft() {
  const source = fs.readFileSync(`${REPO}/src/lib/treeCraft.ts`, 'utf8');
  const { transformSync } = require('esbuild');
  const js = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  fs.mkdirSync(WORK, { recursive: true });
  const file = path.join(WORK, 'treeCraft.qa.cjs');
  const mod = new Module(file, null);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(js, file);
  return mod.exports;
}

const { TREE_PARTS, coupleMissionsDone, openParts, openPartIds, nextPart, partLabel } = loadTreeCraft();

let seq = 0;
const log = (over = {}) => ({
  id: `log_${++seq}`,
  habitId: 'habit_a',
  userId: 'user_A',
  coupleId: 'couple_qa',
  date: '2026-11-06',
  completed: true,
  durationMinutes: 10,
  visibility: 'couple',
  ...over,
});
const countOf = (logs) => coupleMissionsDone(logs);

// ---- bentuk daftar bagiannya --------------------------------------------------

check('daftar pelengkap berisi bagian, bukan nol', TREE_PARTS.length >= 8, TREE_PARTS.length);
const ids = TREE_PARTS.map((p) => p.id);
const labels = TREE_PARTS.map((p) => p.label);
check(
  'id dan nama bagian tidak ada yang kembar',
  new Set(ids).size === ids.length && new Set(labels).size === labels.length,
  { id: ids.length, nama: labels.length }
);
let ambangNaik = true;
for (let i = 1; i < TREE_PARTS.length; i++) {
  if (!(TREE_PARTS[i].misi > TREE_PARTS[i - 1].misi)) ambangNaik = false;
}
check('ambang bagian naik terus tanpa lompatan balik', ambangNaik, TREE_PARTS.map((p) => p.misi));
check('bagian pertama terbuka sejak misi pertama', TREE_PARTS[0].misi === 1, TREE_PARTS[0]);
check(
  'tiap bagian punya nama dan keterangan yang terbaca',
  TREE_PARTS.every((p) => p.label.trim().length > 2 && p.lihat.trim().length > 8 && /[a-z][a-z]/i.test(p.label)),
  TREE_PARTS.slice(0, 3)
);
check('ruang tunggu antar bagian melebar, tidak seragam', (() => {
  const jurang = TREE_PARTS.slice(1).map((p, i) => p.misi - TREE_PARTS[i].misi);
  return jurang[jurang.length - 1] > jurang[0] && Math.max(...jurang) <= 25;
})(), TREE_PARTS.slice(1).map((p, i) => p.misi - TREE_PARTS[i].misi));

// ---- hitungan misi dari log --------------------------------------------------

check('ruang baru tanpa log = nol misi', countOf([]) === 0, countOf([]));
check(
  'habit yang belum diselesaikan tidak dihitung',
  countOf([log({ completed: false }), log({ completed: false, habitId: 'habit_b' })]) === 0
);
check('satu habit orang A pada satu hari = satu misi', countOf([log()]) === 1);
check(
  'habit yang sama diselesaikan dua orang = dua misi',
  countOf([log(), log({ userId: 'user_B' })]) === 2
);
check(
  'habit yang sama pada dua hari berbeda = dua misi',
  countOf([log(), log({ date: '2026-11-05' })]) === 2
);
check(
  'baris ganda misi yang sama hanya dihitung sekali',
  countOf([log(), log({ id: 'log_van_server' })]) === 1,
  countOf([log(), log({ id: 'log_van_server' })])
);
check(
  'misi yang sama milik dua orang tidak ikut terlebur',
  countOf([log(), log({ userId: 'user_B' }), log({ userId: 'user_B' })]) === 2
);
const campuran = [
  log(),
  log({ userId: 'user_B' }),
  log({ habitId: 'habit_p', visibility: 'private', userId: 'user_A' }),
  log({ habitId: 'habit_p', visibility: 'private', userId: 'user_B' }),
  log({ habitId: 'habit_q', visibility: 'private', userId: 'user_A', completed: false }),
];
check('kebiasaan privat tidak ikut menghitung misi', countOf(campuran) === 2, countOf(campuran));
check(
  'baris privat tanpa label visibility = ikut, sama seperti habit bersama',
  countOf([log({ visibility: undefined })]) === 1
);
check(
  'urutan log tidak mengubah jumlah misi',
  countOf(campuran) === countOf([...campuran].reverse()),
  { maju: countOf(campuran), balik: countOf([...campuran].reverse()) }
);
check(
  'ruang lain tidak disaring di sini — state aplikasi yang sudah membatasi coupleId',
  countOf([log(), log({ coupleId: 'couple_lain', habitId: 'habit_z' })]) === 2
);

// ---- pembukaan bagian per ambang --------------------------------------------

check('nol misi -> pohon belum punya pelengkap', openPartIds(0).length === 0 && nextPart(0) !== null);
check(
  'satu misi -> hanya bagian pertama yang tumbuh',
  openPartIds(1).length === 1 && openPartIds(1)[0] === TREE_PARTS[0].id,
  openPartIds(1)
);

let tepatAmbang = true;
let salahSebelum = true;
for (const part of TREE_PARTS) {
  const diAmbang = openPartIds(part.misi);
  const sebelumnya = openPartIds(part.misi - 1);
  if (!diAmbang.includes(part.id)) tepatAmbang = false;
  if (sebelumnya.includes(part.id)) salahSebelum = false;
  if (diAmbang.length !== TREE_PARTS.filter((p) => p.misi <= part.misi).length) tepatAmbang = false;
}
check('tiap bagian tumbuh tepat pada ambangnya sendiri', tepatAmbang, TREE_PARTS.map((p) => [p.id, p.misi]));
check('tidak ada bagian yang bocor sebelum ambangnya', salahSebelum);

const ambangTerakhir = TREE_PARTS[TREE_PARTS.length - 1].misi;
let monoton = true;
let naikSatu = true;
let sebelumnya2 = 0;
let kenaikan = 0;
for (let m = 0; m <= ambangTerakhir + 10; m++) {
  const n = openPartIds(m).length;
  if (n < sebelumnya2) monoton = false;
  if (n - sebelumnya2 > 1) naikSatu = false;
  if (n > sebelumnya2) kenaikan++;
  sebelumnya2 = n;
}
check('misi bertambah -> bagian tidak pernah hilang', monoton);
check('satu ambang menambahkan tepat satu bagian', naikSatu && kenaikan === TREE_PARTS.length, { kenaikan });
check('setelah ambang terakhir pohon dinyatakan penuh', openParts(ambangTerakhir).length === TREE_PARTS.length);
check('misi jauh di atas ambang terakhir tidak menambah bagian baru', openPartIds(ambangTerakhir + 500).length === TREE_PARTS.length);

// ---- sisa perjalanan yang dibaca pengguna ------------------------------------

let sisaBenar = true;
for (let m = 0; m < ambangTerakhir; m++) {
  const nxt = nextPart(m);
  if (!nxt) { sisaBenar = false; break; }
  if (nxt.remaining !== nxt.part.misi - m || nxt.remaining < 1) { sisaBenar = false; break; }
  if (nxt.part.misi <= m) { sisaBenar = false; break; }
}
check('sisa misi menuju bagian berikutnya selalu benar', sisaBenar, {
  nol: nextPart(0), tiga: nextPart(3), terakhir: nextPart(ambangTerakhir - 1),
});
check('sudah penuh -> tidak ada bagian berikutnya yang dijanjikan', nextPart(ambangTerakhir) === null && nextPart(0) !== null);
check(
  'bagian berikutnya selalu yang belum terbuka',
  TREE_PARTS.slice(0, -1).every((p) => nextPart(p.misi).part.id === TREE_PARTS[TREE_PARTS.indexOf(p) + 1].id)
);

// ---- label untuk layar ------------------------------------------------------

check(
  'partLabel menyebut nama bagian yang sama dengan daftarnya',
  TREE_PARTS.every((p) => partLabel(p.id) === p.label),
  TREE_PARTS.slice(0, 2).map((p) => partLabel(p.id))
);
check('id asing -> partLabel jujur mengembalikan id itu sendiri', partLabel('bukan_bagian') === 'bukan_bagian');

console.log(`\nRINGKASAN pohon: ${passes} PASS, ${failures} FAIL`);
process.exit(failures ? 1 : 0);
