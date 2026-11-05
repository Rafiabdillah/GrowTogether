import { useCallback, useEffect, useRef, useState } from 'react';
import {
  announceRelay,
  discoverChat,
  isPlausibleToken,
  relaySupported,
  relayTest,
  relayToken,
  relayTrail,
  resetRelayQueue,
  setRelayToken,
  type RelayAccept,
  type RelayKind,
  type RelayTrail,
} from '../lib/telegramRelay';
import {
  BLOCKER_MENUNGGU,
  HEARTBEAT_MS,
  IDLE_BEFORE_NOTIFY_MS,
  bindOwnChat,
  ownBindingSnapshot,
  setOwnBindingEnabled,
  touchOwnSeen,
  unbindOwnChat,
  watchBinding,
  type BindingSnapshot,
  type TelegramBinding,
} from '../lib/telegramBindings';

export interface RelayPartnerState {
  bound: boolean;
  enabled: boolean;
  chatName: string;
  /** Mill since the partner's device was last seen in the foreground. */
  idleMs: number;
}

export type RelaySetupResult = { ok: boolean; message: string };

export type RelayLocalState = BindingSnapshot & { hasToken: boolean };

export interface TelegramRelayApi {
  /** This device: token + chat, both local-only. */
  local: RelayLocalState;
  partner: RelayPartnerState | null;
  /** Kenapa pasangan belum bisa dibangunkan — terbaca apa adanya di kartu. */
  partnerBlocker: string;
  trail: RelayTrail[];
  /** Whether the bot token on this device could plausibly reach Telegram at all. */
  tokenReady: boolean;
  announce: (kind: RelayKind) => RelayAccept;
  /** Paste the bot token; it never leaves this device. */
  saveToken: (token: string) => RelaySetupResult;
  /** Ask the bot which chat talked to it, then publish that address as yours. */
  detectAndBind: () => Promise<RelaySetupResult>;
  setEnabled: (on: boolean) => Promise<RelaySetupResult>;
  sendTest: () => Promise<RelaySetupResult>;
  unbind: () => Promise<RelaySetupResult>;
}

interface RelayInput {
  ready: boolean;
  userId: string;
  coupleId: string;
  partnerUid: string;
  senderName: string;
}

function readLocal(): RelayLocalState {
  return { ...ownBindingSnapshot(), hasToken: isPlausibleToken(relayToken()) };
}

// Kabar ke pasangan lewat Telegram tidak boleh membawa konten, dan tidak boleh
// membangunkan HP yang sedang digenggam. Dua-duanya diputus di hook ini.
export function useTelegramRelay({
  ready,
  userId,
  coupleId,
  partnerUid,
  senderName,
}: RelayInput): TelegramRelayApi {
  const [local, setLocal] = useState<RelayLocalState>(readLocal);
  const [partner, setPartner] = useState<TelegramBinding | null>(null);
  const [partnerBlocker, setPartnerBlocker] = useState(BLOCKER_MENUNGGU);
  const [trail, setTrail] = useState<RelayTrail[]>(relayTrail);
  const partnerRef = useRef<TelegramBinding | null>(null);
  partnerRef.current = partner;
  const lastBeat = useRef(0);
  const trailTimers = useRef<number[]>([]);

  // Ikatan pasangan dipantau hidup, bukan dibaca sekali saat halaman dibuka:
  // pasangan bisa saja memasang Telegram setelah aplikasi ini sudah menyala, dan
  // kartu tidak boleh berpura-pura "belum memasang" selama sisa sesi.
  useEffect(() => {
    if (!ready || !partnerUid) {
      setPartner(null);
      setPartnerBlocker(ready ? 'belum ada pasangan di ruang ini' : BLOCKER_MENUNGGU);
      return;
    }
    return watchBinding(partnerUid, (read) => {
      setPartner(read.binding);
      setPartnerBlocker(read.blocker);
    });
  }, [partnerUid, ready]);

  // Detak: selama halaman ini terlihat, pasangan tidak perlu dibangunkan.
  useEffect(() => {
    if (!ready || !userId || !local.linked || !local.enabled) return;
    const beat = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastBeat.current < HEARTBEAT_MS) return;
      lastBeat.current = Date.now();
      void touchOwnSeen(userId);
    };
    beat();
    const timer = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [local.enabled, local.linked, ready, userId]);

  const announce = useCallback(
    (kind: RelayKind): RelayAccept => {
      const binding = partnerRef.current;
      if (!binding || !binding.enabled) return 'no-link';
      // Pasangan sedang memegang HP-nya — notifikasi in-app sudah cukup.
      if (Date.now() - binding.seenAt < IDLE_BEFORE_NOTIFY_MS) return 'no-link';
      const result = announceRelay(kind, senderName, {
        chatId: binding.chatId,
        chatName: binding.chatName,
      });
      if (result !== 'queued') return result;
      // Jejak baru terisi setelah bot menjawab, yaitu sesudah jendela
      // penggabungan kabar beruntun lewat — bukan saat kabar masuk antrean.
      const timer = window.setTimeout(() => setTrail(relayTrail()), 9000);
      trailTimers.current.push(timer);
      return result;
    },
    [senderName]
  );

  const saveToken = useCallback((token: string): RelaySetupResult => {
    if (!token.trim()) {
      setRelayToken('');
      setLocal(readLocal());
      return { ok: true, message: 'token dibersihkan dari perangkat ini' };
    }
    const saved = setRelayToken(token);
    setLocal(readLocal());
    return saved
      ? { ok: true, message: 'token tersimpan di perangkat ini saja' }
      : { ok: false, message: 'bentuk token bukan seperti punya BotFather (contoh: 1234567:AA...)' };
  }, []);

  const detectAndBind = useCallback(async (): Promise<RelaySetupResult> => {
    const token = relayToken();
    if (!isPlausibleToken(token)) return { ok: false, message: 'isi token bot lebih dulu' };
    if (!userId || !coupleId) return { ok: false, message: 'belum masuk ruang kalian' };
    const found = await discoverChat(token);
    if (!found.link) return { ok: false, message: found.message };
    const stored = await bindOwnChat(userId, coupleId, found.link);
    setLocal(readLocal());
    return stored
      ? { ok: true, message: found.message }
      : { ok: false, message: 'alamat chatmu gagal tercatat di server — cek koneksi lalu ulangi' };
  }, [coupleId, userId]);

  const setEnabled = useCallback(
    async (on: boolean): Promise<RelaySetupResult> => {
      if (!ownBindingSnapshot().linked) return { ok: false, message: 'hubungkan chat dulu' };
      const saved = await setOwnBindingEnabled(userId, on);
      setLocal(readLocal());
      return saved
        ? { ok: true, message: on ? 'HP-mu boleh dibangunkan pasangan' : 'HP-mu tidak akan dibangunkan lagi' }
        : { ok: false, message: 'perubahan belum tersimpan di server, coba lagi' };
    },
    [userId]
  );

  const sendTest = useCallback(async (): Promise<RelaySetupResult> => {
    const outcome = await relayTest(senderName);
    setTrail(relayTrail());
    return outcome === 'sent'
      ? { ok: true, message: 'pesan tes terkirim — cek Telegram kamu' }
      : { ok: false, message: `pesan tes tidak sampai (${outcome})` };
  }, [senderName]);

  const unbind = useCallback(async (): Promise<RelaySetupResult> => {
    const removed = await unbindOwnChat(userId);
    resetRelayQueue();
    setLocal(readLocal());
    return removed
      ? { ok: true, message: 'ikatan chat dilepas' }
      : { ok: false, message: 'penghapusan di server gagal, tapi perangkat ini sudah lupa' };
  }, [userId]);

  return {
    local,
    partner: partner
      ? {
          bound: true,
          enabled: partner.enabled,
          chatName: partner.chatName,
          idleMs: Math.max(0, Date.now() - partner.seenAt),
        }
      : null,
    partnerBlocker,
    trail,
    tokenReady: relaySupported() && local.hasToken,
    announce,
    saveToken,
    detectAndBind,
    setEnabled,
    sendTest,
    unbind,
  };
}
