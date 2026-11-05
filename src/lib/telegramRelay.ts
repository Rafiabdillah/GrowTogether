// GrowTogether membangunkan HP yang tertutup tanpa server sendiri: browser si
// pengirim menitipkan kabar ke bot Telegram milik kalian berdua. Satu bot dibuat
// lewat @BotFather, lalu token yang sama ditempel di kedua HP — token itu hanya
// hidup di localStorage perangkat, tidak pernah ikut tersinkron ke Firestore.
// Yang keluar dari perangkat hanyalah kalimat baku "ada kabar dari pasangan" —
// judul habit, isi jurnal, dan catatan check-in tidak pernah ikut terkirim.

const TOKEN_KEY = 'gt_relay_token_v1';
const LINK_KEY = 'gt_relay_link_v1';
const TRAIL_KEY = 'gt_relay_trail_v1';

export type RelayKind = 'hug' | 'checkin' | 'journal' | 'agreement' | 'habit';

export type RelayOutcome =
  | 'sent'
  | 'merged'
  | 'no-token'
  | 'no-link'
  | 'rejected'
  | 'network';

/** Yang boleh dilaporkan sebuah panggilan announce: diterima, dilebur, atau terhalang. */
export type RelayAccept = 'queued' | 'merged' | 'no-token' | 'no-link';

export interface RelayTrail {
  at: number;
  kind: RelayKind | 'test';
  outcome: RelayOutcome;
  detail: string;
}

export interface RelayLink {
  chatId: string;
  chatName: string;
}

const SENTENCE: Record<RelayKind, string> = {
  hug: '{name} mengirim pelukan untukmu',
  checkin: '{name} baru saja check-in malam',
  journal: '{name} menulis refleksi baru',
  agreement: '{name} mengusulkan kesepakatan yang menunggu keputusanmu',
  habit: '{name} baru menyelesaikan satu habit',
};

const TAIL = 'Buka GrowTogether untuk melihatnya.';

// Telegram menolak request yang memicu preflight CORS, jadi body-nya form biasa.
//
// Uji QA berjalan terhadap bot tiruan di loopback; jalur lain tidak boleh bisa
// dibelokkan, jadi override hanya diterima kalau adresnya 127.0.0.1/localhost.
function apiRoot(): string {
  const override = (globalThis as { __GT_RELAY_API__?: unknown }).__GT_RELAY_API__;
  if (typeof override === 'string' && /^https?:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(override)) {
    return override;
  }
  return 'https://api.telegram.org';
}

const API = (token: string, method: string) => `${apiRoot()}/bot${token}/${method}`;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Mode privat: relay berhenti diam-diam, tidak boleh merusak halaman.
  }
}

export function relaySupported(): boolean {
  return typeof fetch !== 'undefined' && typeof localStorage !== 'undefined';
}

export function relayToken(): string {
  return (readStorage(TOKEN_KEY) || '').trim();
}

/** Shape of a real bot token: <digits>:<35 chars of [-A-Za-z0-9_]>. */
export function isPlausibleToken(token: string): boolean {
  return /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token.trim());
}

export function setRelayToken(token: string): boolean {
  const value = token.trim();
  if (!value) {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // diabaikan
    }
    return true;
  }
  if (!isPlausibleToken(value)) return false;
  writeStorage(TOKEN_KEY, value);
  return true;
}

export function relayLink(): RelayLink | null {
  const raw = readStorage(LINK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RelayLink>;
    return parsed && typeof parsed.chatId === 'string' && parsed.chatId
      ? { chatId: parsed.chatId, chatName: typeof parsed.chatName === 'string' ? parsed.chatName : 'chat ini' }
      : null;
  } catch {
    return null;
  }
}

export function setRelayLink(link: RelayLink | null) {
  if (!link) {
    try {
      localStorage.removeItem(LINK_KEY);
    } catch {
      // diabaikan
    }
    return;
  }
  writeStorage(LINK_KEY, JSON.stringify(link));
}

export function relayTrail(): RelayTrail[] {
  const raw = readStorage(TRAIL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RelayTrail[]).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function noteTrail(entry: RelayTrail) {
  const next = [entry, ...relayTrail()].slice(0, 8);
  writeStorage(TRAIL_KEY, JSON.stringify(next));
}

async function call(token: string, method: string, body?: Record<string, string>, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(API(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body || {}).toString(),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string; result?: unknown }
      | null;
    return { httpOk: response.ok, apiOk: data?.ok === true, description: data?.description || '', result: data?.result };
  } catch (error) {
    return {
      httpOk: false,
      apiOk: false,
      description: error instanceof DOMException && error.name === 'AbortError' ? 'batas waktu' : String(error),
      result: undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mengambil chat yang terakhir mengirim pesan ke bot ini. Pasangan harus menekan
 * /start lebih dulu — Telegram tidak mengizinkan bot memulai percakapan sendiri.
 */
export async function discoverChat(token: string): Promise<{ link: RelayLink | null; message: string }> {
  const found = await call(token, 'getUpdates', {
    allowed_updates: JSON.stringify(['message']),
    timeout: '0',
  });
  if (!found.apiOk) {
    return { link: null, message: found.description || 'bot menolak permintaan' };
  }
  const updates = Array.isArray(found.result) ? (found.result as Array<Record<string, any>>) : [];
  const messages = updates
    .map((u) => u?.message || u?.channel_post)
    .filter((m) => m && m.chat && m.chat.id != null)
    .sort((a, b) => Number(a.date || 0) - Number(b.date || 0));
  const last = messages[messages.length - 1];
  if (!last) {
    return { link: null, message: 'bot belum menerima pesan apa pun — tekan /start di bot itu dulu' };
  }
  const chat = last.chat as Record<string, any>;
  const name = String(chat.title || chat.first_name || chat.username || 'chat ini');
  return { link: { chatId: String(chat.id), chatName: name }, message: `terhubung ke ${name}` };
}

/** Mengirim satu pesan. Yang dicatat di jejak adalah alasan gagal apa adanya,
 *  jadi layar pengaturan bisa menunjukkan sebabnya alih-alih hanya diam. */
async function deliver(
  text: string,
  kind: RelayKind | 'test',
  target: RelayLink | null
): Promise<{ outcome: RelayOutcome; detail: string }> {
  const token = relayToken();
  if (!isPlausibleToken(token)) return { outcome: 'no-token', detail: 'token belum dipasang' };
  if (!target) return { outcome: 'no-link', detail: 'chat pasangan belum terhubung' };
  const result = await call(token, 'sendMessage', {
    chat_id: target.chatId,
    text,
    disable_web_page_preview: 'true',
  });
  if (result.apiOk) return { outcome: 'sent', detail: '' };
  const jaringan = /timed out|batas waktu|abort|fetch failed|failed to fetch|network|econn|epipe|socket hang up|enotfound|unavailable/i.test(
    result.description
  );
  return {
    outcome: jaringan ? 'network' : 'rejected',
    detail: result.description || 'tidak ada jawaban dari bot',
  };
}

// ---- antrian pendek: tiga kabar beruntun tidak boleh jadi tiga notifikasi ----

const BURST_WINDOW_MS = 4000;
const COOLDOWN_MS = 45000;
const MAX_HOLD_MS = 180000;

let pending: RelayKind[] = [];
let pendingTarget: RelayLink | null = null;
let pendingName = 'pasanganmu';
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let openedAt = 0;
let lastFlush = 0;

function composeText(kinds: RelayKind[], name: string): string {
  if (kinds.length > 1) {
    const unique = Array.from(new Set(kinds));
    const subject = unique.includes('hug') ? 'termasuk pelukan' : 'dari kalian';
    return `Ada ${kinds.length} kabar dari ${name}, ${subject}. ${TAIL}`;
  }
  const sentence = SENTENCE[kinds[0]];
  return `${sentence.replace('{name}', name)}. ${TAIL}`;
}

function flush() {
  const kinds = pending;
  const target = pendingTarget;
  const name = pendingName;
  pending = [];
  pendingTarget = null;
  flushTimer = null;
  if (!kinds.length || !target) return;
  lastFlush = Date.now();
  void deliver(composeText(kinds, name), kinds[0], target).then((result) => {
    noteTrail({
      at: Date.now(),
      kind: kinds[0],
      outcome: result.outcome,
      detail: result.detail || kinds.join('+'),
    });
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  const now = Date.now();
  if (!openedAt) openedAt = now;
  const sinceLast = now - lastFlush;
  let wait = BURST_WINDOW_MS;
  // Setelah mengirim, tahan dulu supaya pasangan tidak dibombardir — tapi jangan
  // menahan selamanya, kabar yang antre tetap keluar satu pesan sebelum 3 menit.
  if (sinceLast < COOLDOWN_MS && now - openedAt < MAX_HOLD_MS) {
    wait = Math.max(wait, COOLDOWN_MS - sinceLast);
  } else {
    openedAt = 0;
    lastFlush = 0;
  }
  flushTimer = setTimeout(() => flush(), wait);
}

/**
 * Dipanggil saat ada kabar baru untuk pasangan. Tidak pernah mengirim konten —
 * hanya jenis kabarnya — dan kabar yang beruntun dilebur jadi satu pesan.
 * `target` adalah alamat chat pasangan hasil ikatan di ruang kalian.
 */
export function announceRelay(kind: RelayKind, senderName: string, target: RelayLink | null): RelayAccept {
  if (!isPlausibleToken(relayToken())) return 'no-token';
  if (!target) return 'no-link';
  if (pending.includes(kind)) return 'merged';
  const wasEmpty = pending.length === 0;
  pending.push(kind);
  pendingTarget = target;
  pendingName = senderName || 'pasanganmu';
  scheduleFlush();
  return wasEmpty ? 'queued' : 'merged';
}

export function relayStatus(): { hasToken: boolean; link: RelayLink | null; blocker: string } {
  const token = relayToken();
  const link = relayLink();
  if (!relaySupported()) return { hasToken: false, link: null, blocker: 'browser ini tidak mendukung relay' };
  if (!isPlausibleToken(token)) return { hasToken: false, link: null, blocker: 'token bot belum dipasang' };
  if (!link) return { hasToken: true, link: null, blocker: 'chat belum terhubung' };
  return { hasToken: true, link, blocker: '' };
}

/** Pesan tes manual, tanpa antrian, supaya layar pengaturan bisa membuktikan jalur. */
export async function relayTest(senderName: string): Promise<RelayOutcome> {
  const text = `GrowTogether: koneksi kabar kalian aktif. ${TAIL} (pesan tes dari ${senderName || 'kamu'})`;
  const result = await deliver(text, 'test', relayLink());
  noteTrail({
    at: Date.now(),
    kind: 'test',
    outcome: result.outcome,
    detail: result.detail || 'pesan tes ke chat sendiri',
  });
  return result.outcome;
}

export function resetRelayQueue() {
  pending = [];
  pendingTarget = null;
  pendingName = 'pasanganmu';
  openedAt = 0;
  lastFlush = 0;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}
