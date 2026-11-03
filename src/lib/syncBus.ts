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

// Firestore error codes are useless on a phone screen, but they are the only
// clue a partner has when something does not arrive, so each one gets a plain
// Indonesian sentence plus the raw code.
export function explainSyncEvent(event: SyncEvent): string {
  const message = event.message ?? '';
  const target = event.kind === 'listen' ? `data ${event.target}` : event.target;
  if (/permission-denied|Missing or insufficient/i.test(message)) {
    return `Akses ditolak aturan database saat menyimpan ${target}.`;
  }
  if (/unavailable|offline|network|Failed to get documentation/i.test(message)) {
    return `Koneksi ke Firebase terputus saat menyimpan ${target}.`
  }
  if (/not-found/i.test(message)) {
    return `Ruang bersama tidak ditemukan saat menyimpan ${target}.`;
  }
  if (/deadline/i.test(message)) {
    return `Waktu habis saat menyimpan ${target}. Coba lagi.`;
  }
  return `Gagal menyimpan ${target}: ${message || 'kesalahan tidak dikenal'}`;
}

export function syncErrorCode(event: SyncEvent): string {
  const match = (event.message ?? '').match(/^[a-z-]+/i);
  return match ? match[0] : 'unknown';
}
