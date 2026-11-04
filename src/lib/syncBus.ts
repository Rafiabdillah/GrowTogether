export type SyncEventKind = 'write' | 'delete' | 'listen';

export interface SyncEvent {
  at: number;
  kind: SyncEventKind;
  target: string;
  ok: boolean;
  message?: string;
}

type Listener = (event: SyncEvent) => void;

const listeners = new Set<Listener>();

export function emitSyncEvent(event: SyncEvent) {
  for (const listener of Array.from(listeners)) listener(event);
}

export function subscribeSyncEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Halaman yang dimuat ulang kehilangan seluruh riwayat di memori. Pesan yang harus
// dibacakan SETELAH muat ulang dititipkan sebentar di sessionStorage supaya kegagalan
// "bersihkan salinan lokal" tidak hilang bersama halaman yang sedang ditutup.
const STASHED_NOTE_KEY = 'gt_sync_note_after_reload';

export function stashSyncNote(event: SyncEvent) {
  try {
    sessionStorage.setItem(STASHED_NOTE_KEY, JSON.stringify(event));
  } catch {
    // Private mode / storage penuh: pesan tetap ada di konsol, bukan blokade.
  }
}

export function takeStashedSyncNote(): SyncEvent | null {
  try {
    const raw = sessionStorage.getItem(STASHED_NOTE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STASHED_NOTE_KEY);
    const parsed = JSON.parse(raw) as SyncEvent;
    return typeof parsed?.at === 'number' && typeof parsed?.target === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

// `habits/h_17314543` berarti bagi kode, tetapi bukan bagi pasangan yang sedang
// melihat layarnya. Setiap koleksi punya nama Indonesia supaya banner bisa dibaca.
const COLLECTION_LABELS: Record<string, string> = {
  habits: 'kebiasaan',
  logs: 'ceklis habit',
  sessions: 'sesi fokus',
  journals: 'jurnal refleksi',
  books: 'rak buku',
  checkins: 'check-in malam',
  reactions: 'reaksi',
  agreements: 'kesepakatan',
  couples: 'ruang bersama',
  users: 'profil',
  inviteCodes: 'kode ruang',
};

export function friendlyTarget(target: string): string {
  const collection = target.split('/')[0];
  const label = COLLECTION_LABELS[collection];
  if (!label) return target;
  // Aksi ruang tertentu memakai id dokumen yang sama; cukup nama koleksinya.
  return label;
}

// Firestore error codes are useless on a phone screen, but they are the only
// clue a partner has when something does not arrive, so each one gets a plain
// Indonesian sentence plus the raw code.
export function explainSyncEvent(event: SyncEvent): string {
  const message = event.message ?? '';
  const target = friendlyTarget(event.target);
  // Seorang pengguna yang kode ruangnya salah tidak sedang "gagal menyimpan"
  // apa pun — kata kerja harus mengikuti jenis operasi.
  const verb =
    event.kind === 'write' ? 'menyimpan' : event.kind === 'delete' ? 'menghapus' : 'membaca';
  if (/unconfirmed/i.test(message)) {
    return `Perubahan pada ${target} masih tersimpan di perangkat ini dan belum diterima server. Data pasanganmu belum tentu melihatnya.`;
  }
  if (/permission-denied|Missing or insufficient/i.test(message)) {
    if (event.kind === 'listen') {
      return `Aturan Firestore menolak pembacaan ${target}. Aturan yang aktif di konsol Firebase kemungkinan bukan versi repo (firestore.rules).`;
    }
    if (/server menolak tulisan/.test(message)) {
      return `Server menolak ${verb} ${target} — aturan Firestore yang aktif tidak mengizinkan tulisan ini.`;
    }
    return `Akses ditolak aturan database saat ${verb} ${target}.`;
  }
  if (/unavailable|offline|network|Failed to get documentation/i.test(message)) {
    return `Koneksi ke Firebase terputus saat ${verb} ${target}.`
  }
  if (/not-found/i.test(message)) {
    return `Ruang bersama tidak ditemukan saat ${verb} ${target}.`;
  }
  if (/deadline/i.test(message)) {
    return `Waktu habis saat ${verb} ${target}. Coba lagi.`;
  }
  if (event.kind === 'listen') {
    return pesanYangSudahDibaca(message) ? message : `Belum berhasil memuat ${target}.`;
  }
  // Kalimat buatan aplikasi sendiri (penolakan kode ruang, misalnya) sudah
  // menjelaskan sebabnya. Membalutnya dengan "Gagal menyimpan ..." justru
  // menaruh kata kerja yang salah di depan informasi yang sebenarnya dicari.
  if (pesanYangSudahDibaca(message)) return message;
  return `Gagal ${verb} ${target}: ${message || 'kesalahan tidak dikenal'}`;
}

function pesanYangSudahDibaca(message: string) {
  const trimmed = message.trim();
  return trimmed.includes(' ') && /[a-z][a-z]/i.test(trimmed) && !/^[a-z-]+:/i.test(trimmed);
}

export function syncErrorCode(event: SyncEvent): string {
  const match = (event.message ?? '').match(/^[a-z-]+/i);
  return match ? match[0] : 'unknown';
}
