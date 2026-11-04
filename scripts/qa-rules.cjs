// QA fase 1: aturan Firestore ASLI (firestore.rules repo) diuji dengan bentuk
// tulisan persis seperti yang dilakukan AppContext.tsx.
//
// Yang dibuktikan di sini:
//   - privasi per baris (habit privat, log/sesi private, jurnal & check-in unshared)
//   - isolasi antar ruang (pasangan lain tidak dapat membaca/menulis apa pun)
//   - pemalsuan identitas (userId/ownerId/creatorId milik orang lain)
//   - klaim slot pasangan + larangan merebut slot yang sudah terisi
//   - pointer kode ruang dan ekonomi XP
//   - default deny untuk koleksi yang tidak dikenal + sesi tanpa login
// Catatan: aturan "list" (query) sengaja hanya dilaporkan sebagai INFO karena
// emulator lokal menilai klausa list dengan cara yang berbeda dari produksi;
// semua checks pakai operasi per-dokumen yang bisa dibuktikan.
const { spawn } = require('node:child_process');
const net = require('node:net');
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
let failures = 0;
let passes = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail === undefined ? '' : `  -> ${JSON.stringify(detail)}`}`);
  if (ok) passes++;
  else failures++;
}
function info(label, detail) {
  console.log(`INFO  ${label}  -> ${JSON.stringify(detail)}`);
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
async function waitForPort(port, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return true;
    await sleep(1500);
  }
  return false;
}

// Mengembalikan kode error ('permission-denied', 'unavailable') atau 'OK'.
async function attempt(promise) {
  try {
    await promise;
    return 'OK';
  } catch (e) {
    return e.code || e.message;
  }
}

async function main() {
  for (const [label, dir] of [['GT_JDK', JDK], ['GT_CLI', CLI], ['GT_SYNCTEST', SYNCTEST]]) {
    if (!fs.existsSync(dir)) throw new Error(`${label} tidak ditemukan di ${dir}`);
  }
  if (await portOpen(8899)) throw new Error('emulator masih hidup di 8899, matikan dulu');
  fs.mkdirSync(WORK, { recursive: true });

  say('menyalakan emulator firestore + auth');
  start(
    process.execPath,
    ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:start', '--only', 'auth,firestore', '--project', PROJECT, '--config', `${REPO}/firebase.json`],
    {
      cwd: CLI,
      log: `${WORK}/emulator-rules.log`,
      env: { ...process.env, JAVA_HOME: JDK, PATH: `${JDK}/bin;${process.env.PATH}` },
    }
  );
  const ready = (await waitForPort(8899)) && (await waitForPort(9199));
  check('emulator hidup', ready);
  if (!ready) throw new Error('emulator tidak siap');

  const testing = require(`${SYNCTEST}/node_modules/@firebase/rules-unit-testing`);
  const f = require(`${SYNCTEST}/node_modules/@firebase/firestore`);
  const testEnv = await testing.initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { host: '127.0.0.1', port: 8899, rules: REAL_RULES },
  });

  const stamp = Date.now().toString(36).toUpperCase().slice(0, 7);
  const nowIso = new Date().toISOString();
  // Ruang A: dua anggota nyata. Ruang B: ruang lain untuk uji isolasi.
  // Ruang C: masih kosong (slot 2 kosong) untuk uji klaim.
  const a1 = `qaA1${stamp}aaaaaaaaaaaaaaaaaaaa`;
  const a2 = `qaA2${stamp}bbbbbbbbbbbbbbbbbbbbbb`;
  const b1 = `qaB1${stamp}cccccccccccccccccccccc`;
  const b2 = `qaB2${stamp}dddddddddddddddddddddd`;
  const c1 = `qaC1${stamp}eeeeeeeeeeeeeeeeeeeeee`;
  const d1 = `qaD1${stamp}ffffffffffffffffffffff`;
  const roomA = `couple_qaA_${stamp}`;
  const roomB = `couple_qaB_${stamp}`;
  const roomC = `couple_qaC_${stamp}`;
  const codeA = `QA${stamp}A`;
  const codeC = `QA${stamp}C`;

  const profile = (id, name, coupleId, inviteCode) => ({
    id, displayName: name, email: '', colorTheme: 'teal', inviteCode, coupleId,
    createdAt: nowIso, updatedAt: nowIso,
  });
  const room = (id, user1Id, user2Id, roomCode) => ({
    id, user1Id, user2Id, roomCode,
    user1Profile: profile(user1Id, 'Satu', id, roomCode),
    levelXp: 300, levelNumber: 3, graceDayUsedThisWeek: false,
    weeklyReadingMinutesGoal: 300, weeklyStudyMinutesGoal: 200,
    jokerCardsUser1: 2, jokerCardsUser2: 2, allSanctionsPaused: false,
    unlockedDecorations: [], selectedTimeOfDay: 'auto', selectedWeather: 'clear',
    createdAt: nowIso, updatedAt: nowIso,
  });

  // Bentuk dokumen per koleksi = persis objek yang ditulis AppContext.
  const rows = {
    'habits/h_pub': { id: 'h_pub', coupleId: roomA, ownerId: a1, title: 'Olahar pagi', category: 'kesehatan', targetMinutes: 20, frequency: 'daily', isShared: true, isPrivate: false, icon: 'Footprints', createdAt: nowIso },
    'habits/h_priv': { id: 'h_priv', coupleId: roomA, ownerId: a1, title: 'Doa rahasia', category: 'spiritual', targetMinutes: 5, frequency: 'daily', isShared: false, isPrivate: true, icon: 'HeartHandshake', createdAt: nowIso },
    'logs/l_pub': { id: 'l_pub', habitId: 'h_pub', userId: a1, coupleId: roomA, date: '2026-11-04', completed: true, durationMinutes: 20, completedAt: nowIso, visibility: 'couple' },
    'logs/l_priv': { id: 'l_priv', habitId: 'h_priv', userId: a1, coupleId: roomA, date: '2026-11-04', completed: true, durationMinutes: 5, completedAt: nowIso, visibility: 'private' },
    'logs/l_a2': { id: 'l_a2', habitId: 'h_pub', userId: a2, coupleId: roomA, date: '2026-11-04', completed: true, durationMinutes: 10, visibility: 'couple' },
    'sessions/s_pub': { id: 's_pub', coupleId: roomA, userId: a1, habitId: 'h_pub', durationSeconds: 600, title: 'Sesi publik', takeaway: 'x', category: 'kesehatan', timestamp: nowIso, visibility: 'couple' },
    'sessions/s_priv': { id: 's_priv', coupleId: roomA, userId: a1, habitId: 'h_priv', durationSeconds: 300, title: 'Sesi privat', takeaway: 'x', category: 'spiritual', timestamp: nowIso, visibility: 'private' },
    'journals/j_share': { id: 'j_share', coupleId: roomA, authorId: a1, weekLabel: 'Pekan 44', whatWorked: 'rutin', whatWasHard: 'begadang', nextWeekGoal: 'pagi', isShared: true, createdAt: nowIso },
    'journals/j_priv': { id: 'j_priv', coupleId: roomA, authorId: a1, weekLabel: 'Pekan 44', whatWorked: 'unan', whatWasHard: '', nextWeekGoal: '', isShared: false, createdAt: nowIso },
    'checkins/c_share': { id: 'c_share', coupleId: roomA, userId: a1, date: '2026-11-04', mood: 4, gratitude: 'teh hangat', isShared: true, createdAt: nowIso },
    'checkins/c_priv': { id: 'c_priv', coupleId: roomA, userId: a1, date: '2026-11-04', mood: 2, gratitude: 'unan saja', isShared: false, createdAt: nowIso },
    'books/bk': { id: 'bk', coupleId: roomA, addedById: a1, title: 'Atomic Habits', author: 'James Clear', status: 'reading', rating: 5, totalPages: 320, pagesRead: 40, quote: '', createdAt: nowIso, updatedAt: nowIso },
    'reactions/rc': { id: 'rc', coupleId: roomA, senderId: a1, senderName: 'Satu', receiverId: a2, emoji: '🙌', habitTitle: 'Olahar pagi', message: 'Keren!', createdAt: nowIso },
    'agreements/ag': { id: 'ag', coupleId: roomA, creatorId: a1, title: 'Traktir es krim', type: 'sanksi', description: 'kalau bolos', appliedTo: 'both', triggerType: 'miss_habit_count', triggerThreshold: 2, status: 'pending_approval', partnerApproved: false, timesTriggered: 0, timesCompleted: 0, isSafetyFilter: false, createdAt: nowIso, updatedAt: nowIso },
  };

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [ref, data] of Object.entries(rows)) {
      const [col, id] = ref.split('/');
      await f.setDoc(f.doc(db, col, id), data);
    }
    await f.setDoc(f.doc(db, 'couples', roomA), room(roomA, a1, a2, codeA));
    await f.setDoc(f.doc(db, 'couples', roomB), room(roomB, b1, b2, `QB${stamp}B`));
    await f.setDoc(f.doc(db, 'couples', roomC), { ...room(roomC, c1, '', codeC), levelXp: 0, levelNumber: 1 });
    await f.setDoc(f.doc(db, 'users', a1), profile(a1, 'Satu', roomA, codeA));
    await f.setDoc(f.doc(db, 'users', a2), profile(a2, 'Dua', roomA, `QA${stamp}X`));
    await f.setDoc(f.doc(db, 'users', b1), profile(b1, 'BSatu', roomB, `QB${stamp}Y`));
    await f.setDoc(f.doc(db, 'users', b2), profile(b2, 'BDua', roomB, `QB${stamp}Z`));
    await f.setDoc(f.doc(db, 'users', c1), profile(c1, 'CSatu', roomC, codeC));
    await f.setDoc(f.doc(db, 'inviteCodes', codeA), { userId: a1, coupleId: roomA, ownerName: 'Satu', colorTheme: 'teal', updatedAt: nowIso });
    await f.setDoc(f.doc(db, 'inviteCodes', codeC), { userId: c1, coupleId: roomC, ownerName: 'CSatu', colorTheme: 'teal', updatedAt: nowIso });
  });

  const dbA1 = testEnv.authenticatedContext(a1).firestore();
  const dbA2 = testEnv.authenticatedContext(a2).firestore();
  const dbB1 = testEnv.authenticatedContext(b1).firestore();
  const dbC1 = testEnv.authenticatedContext(c1).firestore();
  const dbD1 = testEnv.authenticatedContext(d1).firestore();
  const dbAnon = testEnv.unauthenticatedContext().firestore();
  // Petakan spesifikasi "koleksi/id" ke database milik pembaca yang sedang diuji.
  const dbs = { dbA1, dbA2, dbB1, dbC1, dbD1, dbAnon };
  const docIn = (who, spec) => {
    const [col, id] = spec.split('/');
    return f.doc(dbs[who], col, id);
  };

  say('privasi per baris di dalam satu ruang');
  for (const spec of ['habits/h_pub', 'logs/l_pub', 'sessions/s_pub', 'journals/j_share', 'checkins/c_share', 'books/bk', 'reactions/rc', 'agreements/ag']) {
    const snap = await f.getDoc(docIn('dbA2', spec)).catch((e) => ({ err: e.code }));
    check(`pasangan bisa membaca ${spec}`, !snap.err && snap.exists(), snap.err || 'exists');
  }
  for (const spec of ['habits/h_priv', 'logs/l_priv', 'sessions/s_priv', 'journals/j_priv', 'checkins/c_priv']) {
    const snap = await f.getDoc(docIn('dbA2', spec)).catch((e) => ({ err: e.code }));
    check(`pasangan TIDAK bisa membaca ${spec} (privat)`, snap.err === 'permission-denied', snap.err || (snap.exists ? 'TERBACA' : 'miss'));
  }
  const ownPrivate = await f.getDoc(docIn('dbA1', 'habits/h_priv')).catch((e) => ({ err: e.code }));
  check('pemilik tetap bisa membaca baris privat miliknya sendiri', !ownPrivate.err && ownPrivate.exists(), ownPrivate.err || 'exists');

  say('isolasi antar ruang');
  const roomSpecs = Object.keys(rows).concat(['couples/' + roomA, 'users/' + a1, 'users/' + a2]);
  let leak = 0;
  for (const spec of roomSpecs) {
    const snap = await f.getDoc(docIn('dbB1', spec)).catch((e) => ({ err: e.code }));
    if (!snap.err && snap.exists) leak++;
  }
  check(`ruang lain (B1) tidak bisa membaca satu pun dari ${roomSpecs.length} dokumen ruang A`, leak === 0, { bocor: leak });
  const bWrite = await attempt(f.setDoc(docIn('dbB1', 'books/bk'), { pagesRead: 999 }, { merge: true }));
  check('ruang lain tidak bisa menyunting buku ruang A', bWrite === 'permission-denied', bWrite);
  const bAgree = await attempt(f.setDoc(docIn('dbB1', 'agreements/ag'), { status: 'completed' }, { merge: true }));
  check('ruang lain tidak bisa mengubah kesepakatan ruang A', bAgree === 'permission-denied', bAgree);
  const bCouples = await attempt(f.setDoc(f.doc(dbB1, 'couples', roomA), { levelXp: 99999 }, { merge: true }));
  check('ruang lain tidak bisa menguras/mengisi XP ruang A', bCouples === 'permission-denied', bCouples);

  say('pemalsuan identitas saat membuat baris');
  const mkHabitOther = await attempt(f.setDoc(f.doc(dbA1, 'habits', `h_forge_${stamp}`), { ...rows['habits/h_pub'], id: `h_forge_${stamp}`, ownerId: a2 }));
  check('tidak bisa membuat habit atas nama pasangan', mkHabitOther === 'permission-denied', mkHabitOther);
  const mkLogOther = await attempt(f.setDoc(f.doc(dbA1, 'logs', `l_forge_${stamp}`), { ...rows['logs/l_pub'], id: `l_forge_${stamp}`, userId: a2 }));
  check('tidak bisa membuat log penyelesaian atas nama pasangan', mkLogOther === 'permission-denied', mkLogOther);
  const mkReactOther = await attempt(f.setDoc(f.doc(dbA1, 'reactions', `r_forge_${stamp}`), { ...rows['reactions/rc'], id: `r_forge_${stamp}`, senderId: a2 }));
  check('tidak bisa mengirim reaksi dengan senderId orang lain', mkReactOther === 'permission-denied', mkReactOther);
  const mkJournalOther = await attempt(f.setDoc(f.doc(dbA1, 'journals', `j_forge_${stamp}`), { ...rows['journals/j_share'], id: `j_forge_${stamp}`, authorId: a2 }));
  check('tidak bisa membuat jurnal atas nama pasangan', mkJournalOther === 'permission-denied', mkJournalOther);
  const mkAgreeOther = await attempt(f.setDoc(f.doc(dbA1, 'agreements', `a_forge_${stamp}`), { ...rows['agreements/ag'], id: `a_forge_${stamp}`, creatorId: b1 }));
  check('tidak bisa membuat kesepakatan mencatut nama orang lain', mkAgreeOther === 'permission-denied', mkAgreeOther);
  const mkHabitRoomB = await attempt(f.setDoc(f.doc(dbA1, 'habits', `h_intrude_${stamp}`), { ...rows['habits/h_pub'], id: `h_intrude_${stamp}`, coupleId: roomB }));
  check('tidak bisa menyisipkan habit ke ruang orang lain', mkHabitRoomB === 'permission-denied', mkHabitRoomB);
  const mkCoupleOther = await attempt(f.setDoc(f.doc(dbA1, 'couples', `couple_forge_${stamp}`), { ...room(`couple_forge_${stamp}`, b1, '', `QF${stamp}`), id: `couple_forge_${stamp}` }));
  check('tidak bisa membuat ruang yang mengaku milik orang lain', mkCoupleOther === 'permission-denied', mkCoupleOther);

  say('hak hapus / sunting antar anggota');
  const a2DelOwn = await attempt(f.deleteDoc(f.doc(dbA2, 'logs', 'l_a2')));
  check('anggota boleh menghapus log miliknya sendiri', a2DelOwn === 'OK', a2DelOwn);
  const a2DelHabit = await attempt(f.deleteDoc(f.doc(dbA2, 'habits', 'h_pub')));
  check('pasangan tidak bisa menghapus habit milik kita', a2DelHabit === 'permission-denied', a2DelHabit);
  const a2DelBook = await attempt(f.deleteDoc(f.doc(dbA2, 'books', 'bk')));
  check('pasangan tidak bisa menghapus buku yang kita tambahkan', a2DelBook === 'permission-denied', a2DelBook);
  const a2UpdBook = await attempt(f.setDoc(f.doc(dbA2, 'books', 'bk'), { pagesRead: 55 }, { merge: true }));
  check('rak buku bisa disunting berdua (progres bersama)', a2UpdBook === 'OK', a2UpdBook);
  const a2DelJournal = await attempt(f.deleteDoc(f.doc(dbA2, 'journals', 'j_share')));
  check('pasangan tidak bisa menghapus refleksi milik kita', a2DelJournal === 'permission-denied', a2DelJournal);
  const a2DelCheckin = await attempt(f.deleteDoc(f.doc(dbA2, 'checkins', 'c_share')));
  check('pasangan tidak bisa menghapus check-in milik kita', a2DelCheckin === 'permission-denied', a2DelCheckin);
  const a2DelAgree = await attempt(f.deleteDoc(f.doc(dbA2, 'agreements', 'ag')));
  check('pasangan tidak bisa menghapus kesepakatan pembuat lain', a2DelAgree === 'permission-denied', a2DelAgree);
  const a1DelAgree = await attempt(f.deleteDoc(f.doc(dbA1, 'agreements', 'ag')));
  check('pembuat boleh menghapus kesepakatan ruang sendiri', a1DelAgree === 'OK', a1DelAgree);
  const a1MoveHabit = await attempt(f.setDoc(f.doc(dbA1, 'habits', 'h_pub'), { coupleId: roomB }, { merge: true }));
  check('habit tidak bisa dipindahkan ke ruang lain', a1MoveHabit === 'permission-denied', a1MoveHabit);
  const a1Reassign = await attempt(f.setDoc(f.doc(dbA1, 'habits', 'h_pub'), { ownerId: a2 }, { merge: true }));
  check('kepemilikan habit tidak bisa direbut/dipindah', a1Reassign === 'permission-denied', a1Reassign);

  say('slot pasangan & kode ruang');
  const claimBusy = await attempt(f.setDoc(f.doc(dbD1, 'couples', roomA), { user2Id: d1, user2Profile: profile(d1, 'Perusuh', roomA, '') }, { merge: true }));
  check('orang asing tidak bisa merebut slot pasangan yang terisi', claimBusy === 'permission-denied', claimBusy);
  const swapOut = await attempt(f.setDoc(f.doc(dbA1, 'couples', roomA), { user2Id: b1 }, { merge: true }));
  check('anggota tidak bisa menukar pasangan dengan orang asing', swapOut === 'permission-denied', swapOut);
  const claimOpen = await attempt(f.setDoc(f.doc(dbD1, 'couples', roomC), { user2Id: d1, user2Profile: profile(d1, 'Empat', roomC, '') }, { merge: true }));
  check('ruang kosong boleh diklaim lewat jalur gabung (user2Id pengarang)', claimOpen === 'OK', claimOpen);
  const claimAfter = await attempt(f.setDoc(f.doc(dbC1, 'couples', roomC), { user2Id: c1 }, { merge: true }));
  check('setelah terisi, klaim slot kedua ditolak', claimAfter === 'permission-denied', claimAfter);
  const leaveHandover = await attempt(f.setDoc(f.doc(dbC1, 'couples', roomC), { user1Id: d1, user2Id: '' }, { merge: true }));
  check('pemilik yang keluar menyerahkan ruang ke pasangan yang tinggal', leaveHandover === 'OK', leaveHandover);
  const inviteForge = await attempt(f.setDoc(f.doc(dbB1, 'inviteCodes', codeA), { userId: b1, coupleId: roomB }, { merge: true }));
  check('tidak bisa merebut pointer kode ruang orang lain', inviteForge === 'permission-denied', inviteForge);
  const newCode = `QN${stamp}N`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await f.setDoc(f.doc(ctx.firestore(), 'users', a2), { inviteCode: newCode }, { merge: true });
  });
  const inviteOwn = await attempt(f.setDoc(f.doc(dbA2, 'inviteCodes', newCode), { userId: a2, coupleId: roomA, ownerName: 'Dua', colorTheme: 'teal', updatedAt: nowIso }, { merge: true }));
  check('anggota boleh menerbitkan pointer kode ruangnya sendiri', inviteOwn === 'OK', inviteOwn);
  const inviteWrong = await attempt(f.setDoc(f.doc(dbA1, 'inviteCodes', `QZ${stamp}Z`), { userId: a1, coupleId: roomA }, { merge: true }));
  check('pointer kode harus sama dengan inviteCode profil penulisnya', inviteWrong === 'permission-denied', inviteWrong);
  const codeFormat = await attempt(f.setDoc(f.doc(dbA1, 'inviteCodes', 'ab low'), { userId: a1, coupleId: roomA }, { merge: true }));
  check('kode ruang harus huruf besar/angka 4-12 karakter', codeFormat === 'permission-denied', codeFormat);
  const roomReadByAny = await f.getDoc(f.doc(dbD1, 'inviteCodes', codeA)).catch((e) => ({ err: e.code }));
  info('pointer kode ruang bisa dibaca siapa pun yang login (desain: kode tak terduga, bukan rahasia server)', { err: roomReadByAny.err || 'readable' });

  say('ekonomi ruang & profil');
  const negXp = await attempt(f.setDoc(f.doc(dbA1, 'couples', roomA), { levelXp: -1 }, { merge: true }));
  check('saldo XP negatif ditolak', negXp === 'permission-denied', negXp);
  const decorString = await attempt(f.setDoc(f.doc(dbA1, 'couples', roomA), { unlockedDecorations: 'lanterns' }, { merge: true }));
  check('daftar dekorasi yang bukan daftar ditolak', decorString === 'permission-denied', decorString);
  const spendOk = await attempt(f.setDoc(f.doc(dbA2, 'couples', roomA), { levelXp: f.increment(-200) }, { merge: true }));
  check('belanja dekorasi (increment negatif yang tetap >= 0) lolos', spendOk === 'OK', spendOk);
  const overSpend = await attempt(f.setDoc(f.doc(dbA2, 'couples', roomA), { levelXp: f.increment(-5000) }, { merge: true }));
  check('belanja yang membuat saldo menjadi negatif ditolak', overSpend === 'permission-denied', overSpend);
  const writeOtherProfile = await attempt(f.setDoc(f.doc(dbA1, 'users', a2), { displayName: 'Dua Baru' }, { merge: true }));
  check('tidak bisa menulis profil pasangan', writeOtherProfile === 'permission-denied', writeOtherProfile);
  const readOtherRoomProfile = await f.getDoc(f.doc(dbA1, 'users', b1)).catch((e) => ({ err: e.code }));
  check('tidak bisa membaca profil orang di ruang lain', (readOtherRoomProfile.err === 'permission-denied') || readOtherRoomProfile.exists === false, readOtherRoomProfile.err || 'TERBACA');
  const readPartner = await f.getDoc(f.doc(dbA1, 'users', a2)).catch((e) => ({ err: e.code }));
  check('profil pasangan satu ruang bisa dibaca (nama tampil di dua perangkat)', !readPartner.err && readPartner.exists(), readPartner.err || 'exists');

  say('default deny & sesi tanpa login');
  const stray = await attempt(f.setDoc(f.doc(dbA1, 'notifications', `n_${stamp}`), { coupleId: roomA, text: 'x' }));
  check('koleksi di luar daftar aplikasi ditolak total', stray === 'permission-denied', stray);
  const strayRead = await f.getDoc(f.doc(dbA1, 'users', c1)).catch((e) => ({ err: e.code }));
  check('profil anggota ruang kosong tidak bocor ke anggota ruang lain', (strayRead.err === 'permission-denied') || strayRead.exists === false, strayRead.err || 'TERBACA');
  const anonRead = await f.getDoc(f.doc(dbAnon, 'couples', roomA)).catch((e) => ({ err: e.code }));
  check('tanpa login sama sekali tidak bisa membaca ruang', anonRead.err === 'permission-denied', anonRead.err || 'TERBACA');
  const anonWrite = await attempt(f.setDoc(f.doc(dbAnon, 'couples', roomA), { levelXp: 1 }, { merge: true }));
  check('tanpa login tidak bisa menulis ruang', anonWrite === 'permission-denied', anonWrite);
  const enumHabits = await f.getDocs(f.collection(dbB1, 'habits')).catch((e) => ({ err: e.code }));
  info('enumerasi tanpa filter (list) di emulator', { hasil: enumHabits.err || `${enumHabits.size} baris` });
  const appQueryA2 = await f.getDocs(
    f.query(f.collection(dbA2, 'habits'), f.where('coupleId', '==', roomA), f.where('isPrivate', '==', false))
  ).catch((e) => ({ err: e.code }));
  info('query persis aplikasi (habits publik ruang A) di emulator', { hasil: appQueryA2.err || `${appQueryA2.size} baris` });
  const bareLogs = await f.getDocs(f.collection(dbA2, 'logs')).catch((e) => ({ err: e.code }));
  info('query log tanpa predikat di emulator', { hasil: bareLogs.err || `${bareLogs.size} baris` });
  const badId = await f.getDoc(f.doc(dbA1, 'habits', 'id salah!')).catch((e) => ({ err: e.code }));
  check('baca dokumen dengan id di luar pola (ruang/spasi) ditolak', (badId.err === 'permission-denied') || badId.exists === false, badId.err || 'TERBACA');

  // Setelah semua uji lain selesai: jalur "keluar dari pasangan" yang dipakai aplikasi.
  const outsiderLeaves = await attempt(f.setDoc(f.doc(dbB1, 'couples', roomA), { user2Id: '' }, { merge: true }));
  check('orang asing tidak bisa mengosongkan slot pasangan', outsiderLeaves === 'permission-denied', outsiderLeaves);
  const memberLeaves = await attempt(f.setDoc(f.doc(dbA2, 'couples', roomA), { user2Id: '' }, { merge: true }));
  check('anggota kedua boleh mengosongkan slotnya sendiri (keluar dari pasangan)', memberLeaves === 'OK', memberLeaves);
  const afterLeave = (await f.getDoc(f.doc(dbA1, 'couples', roomA))).data();
  check('ruang tetap ada + milik satu orang setelah pasangannya keluar', afterLeave.user1Id === a1 && !afterLeave.user2Id, { user1: !!afterLeave.user1Id, user2: afterLeave.user2Id || 'kosong' });

  console.log(`\nRINGKASAN aturan: ${passes} PASS, ${failures} FAIL`);
}

main()
  .then(() => stopEverything().then(() => process.exit(failures ? 1 : 0)))
  .catch(async (err) => {
    console.log('RUN GAGAL: ' + (err && err.stack ? err.stack : String(err)));
    await stopEverything();
    process.exit(1);
  });
