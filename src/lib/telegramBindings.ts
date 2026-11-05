import { deleteDoc, doc, getDocFromServer, onSnapshot, setDoc } from 'firebase/firestore';
import type { DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// Telegram tidak mengizinkan bot mengirim pesan ke sembarang orang: chat harus
// memulai lebih dulu. Jadi tiap perangkat menyimpan alamat chat-nya sendiri di
// telegramBindings/{uid}, dan si pengirim cukup membaca dokumen pasangan untuk
// tahu ke mana kabar boleh dititip. Aturan Firestore melarang keras listing di
// koleksi ini — menebak-nebak chat id harus tetap gagal.

const SELF_KEY = 'gt_relay_self_v1';

/** Seberapa lama pasangan harus tampak tidak aktif sebelum kita bangunkan HP-nya. */
export const IDLE_BEFORE_NOTIFY_MS = 90_000;
/** Jantung detak: sehebat apa pun, Firestore tidak perlu ditikahi tiap detik. */
export const HEARTBEAT_MS = 60_000;

export interface TelegramBinding {
  coupleId: string;
  chatId: string;
  chatName: string;
  enabled: boolean;
  seenAt: number;
  updatedAt: number;
}

export interface BindingSnapshot {
  linked: boolean;
  chatName: string;
  enabled: boolean;
}

function readSelf(): TelegramBinding | null {
  try {
    const raw = localStorage.getItem(SELF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TelegramBinding>;
    if (typeof parsed?.chatId !== 'string' || !/^-?[0-9]{1,20}$/.test(parsed.chatId)) return null;
    return {
      coupleId: typeof parsed.coupleId === 'string' ? parsed.coupleId : '',
      chatId: parsed.chatId,
      chatName: typeof parsed.chatName === 'string' ? parsed.chatName.slice(0, 80) : 'chat ini',
      enabled: parsed.enabled === true,
      seenAt: typeof parsed.seenAt === 'number' ? parsed.seenAt : 0,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeSelf(binding: TelegramBinding | null) {
  try {
    if (binding) localStorage.setItem(SELF_KEY, JSON.stringify(binding));
    else localStorage.removeItem(SELF_KEY);
  } catch {
    // Mode privat: ikatan hanya hidup di server, perangkat ini tidak mencatatnya.
  }
}

export function ownBindingSnapshot(): BindingSnapshot {
  const self = readSelf();
  return { linked: !!self, chatName: self?.chatName ?? '', enabled: self?.enabled === true };
}

/**
 * Aturan Firestore menuntut coupleId, chatId, enabled, seenAt dan updatedAt ada di
 * setiap tulisan, jadi selalu tulis dokumen utuh — bukan sebagian — supaya
 * merge tidak pernah menghasilkan dokumen setengah yang ditolak server tanpa suara.
 */
async function put(userId: string, next: TelegramBinding): Promise<boolean> {
  if (!userId || !next.coupleId || !/^-?[0-9]{1,20}$/.test(next.chatId)) return false;
  try {
    await setDoc(doc(db, 'telegramBindings', userId), next, { merge: true });
    writeSelf(next);
    return true;
  } catch {
    return false;
  }
}

export async function bindOwnChat(
  userId: string,
  coupleId: string,
  chat: { chatId: string; chatName: string },
  enabled = true
): Promise<boolean> {
  const now = Date.now();
  return put(userId, {
    coupleId,
    chatId: chat.chatId,
    chatName: chat.chatName.slice(0, 80),
    enabled,
    seenAt: now,
    updatedAt: now,
  });
}

export async function setOwnBindingEnabled(userId: string, enabled: boolean): Promise<boolean> {
  const self = readSelf();
  if (!self) return false;
  return put(userId, { ...self, enabled, updatedAt: Date.now() });
}

/** Memberi tahu pasangan bahwa HP ini sedang dipakai, supaya tidak dibangunkan. */
export async function touchOwnSeen(userId: string): Promise<boolean> {
  const self = readSelf();
  if (!self) return false;
  return put(userId, { ...self, seenAt: Date.now() });
}

export async function unbindOwnChat(userId: string): Promise<boolean> {
  writeSelf(null);
  try {
    await deleteDoc(doc(db, 'telegramBindings', userId));
    return true;
  } catch {
    return false;
  }
}

export interface PartnerRead {
  binding: TelegramBinding | null;
  /** Alasan jujur kenapa pasangan belum bisa dibangunkan; kosong kalau terbaca. */
  blocker: string;
}

/** Keadaan awal dan keadaan "cuma cache": belum ada yang boleh diklaim. */
export const BLOCKER_MENUNGGU = 'belum terbaca dari server';

function readError(error: unknown): PartnerRead {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return { binding: null, blocker: 'server menolak membaca ikatannya' };
  return { binding: null, blocker: `gagal membaca dari server (${code || 'tanpa keterangan'})` };
}

function describe(found: DocumentSnapshot<DocumentData>): PartnerRead {
  if (!found.exists()) return { binding: null, blocker: 'belum memasang Telegram di aplikasinya' };
  const raw = found.data() as Partial<TelegramBinding>;
  if (typeof raw?.chatId !== 'string' || !/^-?[0-9]{1,20}$/.test(raw.chatId)) {
    return { binding: null, blocker: 'alamat chat-nya tercatat tidak lengkap' };
  }
  return {
    binding: {
      coupleId: typeof raw.coupleId === 'string' ? raw.coupleId : '',
      chatId: raw.chatId,
      chatName: typeof raw.chatName === 'string' ? raw.chatName : 'chat ini',
      enabled: raw.enabled === true,
      seenAt: typeof raw.seenAt === 'number' ? raw.seenAt : 0,
      updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    },
    blocker: '',
  };
}

/**
 * Ikatan pasangan dibaca hidup, bukan sekali saat halaman dibuka: pasangan bisa
 * memasang Telegram atau mematikan sakelarnya ketika aplikasi ini sudah menyala,
 * dan gerbang "jangan bangunkan HP yang sedang digenggam" hanya jujur kalau seenAt
 * yang dipakai benar-benar jam terakhir pasangan.
 *
 * Langganan saja tidak cukup. Stream Listen Firestore bisa putus tanpa suara dan
 * butuh puluhan detik untuk pulih; selama itu yang datang cuma baris cache, jadi
 * kartu dibuka dengan satu pembacaan langsung ke server lebih dulu. Baris cache
 * dibuang karena alamat chat yang basi akan mengirim pelukan ke HP yang salah.
 *
 * @returns fungsi lepas langganan
 */
export function watchBinding(userId: string, report: (read: PartnerRead) => void): () => void {
  if (!userId) {
    report({ binding: null, blocker: 'kamu belum masuk ruang kalian' });
    return () => undefined;
  }
  const ref = doc(db, 'telegramBindings', userId);
  let hidup = true;
  const berhenti = onSnapshot(
    ref,
    (found) => {
      if (hidup && !found.metadata.fromCache) report(describe(found));
    },
    (error) => {
      if (hidup) report(readError(error));
    }
  );
  void getDocFromServer(ref)
    .then((found) => {
      if (hidup) report(describe(found));
    })
    .catch((error) => {
      if (hidup) report(readError(error));
    });
  return () => {
    hidup = false;
    berhenti();
  };
}
