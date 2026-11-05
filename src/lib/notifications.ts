import {
  DEFAULT_NOTIF_PREFS,
  type GrowNotification,
  type GrowNotifMessage,
  type NotifPrefs,
  type NotificationKind,
  toNotificationOptions,
} from './growNotifTypes';
import { pushState, type PushBlocker } from './pushSubscription';

export type PermissionState = NotificationPermission | 'unsupported';
export type DeliveryResult = 'shown' | 'duplicate' | 'off' | 'denied' | 'unsupported';

const PREFS_KEY = 'gt_notif_prefs_v1';
const PROMPT_KEY = 'gt_notif_prompted_v1';
const SHOWN_KEY = 'gt_notif_shown_v1';

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
    // Private mode or a full quota: notifications stay on their defaults.
  }
}

function clockValue(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && /^\d{2}:\d{2}$/.test(raw) ? raw : fallback;
}

export function loadNotifPrefs(): NotifPrefs {
  const raw = readStorage(PREFS_KEY);
  if (!raw) return { ...DEFAULT_NOTIF_PREFS, enabled: { ...DEFAULT_NOTIF_PREFS.enabled } };
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (JSON.parse(raw) ?? {}) as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_NOTIF_PREFS, enabled: { ...DEFAULT_NOTIF_PREFS.enabled } };
  }
  const storedEnabled = (parsed.enabled ?? {}) as Record<string, unknown>;
  const enabled = { ...DEFAULT_NOTIF_PREFS.enabled };
  for (const kind of Object.keys(enabled) as NotificationKind[]) {
    if (typeof storedEnabled[kind] === 'boolean') enabled[kind] = storedEnabled[kind] as boolean;
  }
  return {
    enabled,
    checkInAt: clockValue(parsed.checkInAt, DEFAULT_NOTIF_PREFS.checkInAt),
    habitAt: clockValue(parsed.habitAt, DEFAULT_NOTIF_PREFS.habitAt),
  };
}

export function saveNotifPrefs(prefs: NotifPrefs) {
  writeStorage(PREFS_KEY, JSON.stringify(prefs));
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function currentPermission(): PermissionState {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/** The browser prompt can only be shown from a user gesture on some platforms, so
 *  the app asks once per device and never nags after a dismissal. */
export function shouldAskPermission(): boolean {
  return currentPermission() === 'default' && readStorage(PROMPT_KEY) !== 'true';
}

export function markPermissionAsked() {
  writeStorage(PROMPT_KEY, 'true');
}

/** Chrome for Android silently answers 'denied' when the permission prompt is
 *  requested without a recent user tap, and v1.2.3 asked from a useEffect — so the
 *  pair burned their one automatic attempt and never saw a notification again.
 *  Anything that fires the prompt has to wait for a real interaction. */
export function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
    .userActivation;
  // Browsers without the flag are the desktop ones that accept a page-load prompt.
  return activation ? activation.hasBeenActive === true : false;
}

export async function askPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  if (!hasUserActivation()) return 'default';
  markPermissionAsked();
  try {
    return await Notification.requestPermission();
  } catch {
    // Some embedded browsers throw instead of showing nothing at all.
    return Notification.permission;
  }
}

/** A prompt dismissed as 'denied' cannot be reopened from the page — the browser or
 *  OS setting has to change first, so the app has to say where that setting is. */
export function permissionHelp(): string {
  if (!notificationsSupported()) {
    return 'Browser ini tidak menampilkan notifikasi sama sekali. Di iPhone, notifikasi hanya hidup pada aplikasi yang sudah dipasang dari Safari → Bagikan → Tambahkan ke Layar Utama.';
  }
  if (currentPermission() === 'denied') {
    return 'Izin notifikasi pernah ditolak, dan hanya browser yang bisa membukanya kembali. Di Chrome Android: setelan aplikasi → Setelan situs → Notifikasi → Izinkan. Di iPhone: Setelan → Safari/Chrome → Notifikasi.';
  }
  if (currentPermission() === 'granted') {
    return 'Izin sudah diberikan. Notifikasi muncul selama aplikasi masih berjalan di latar belakang.';
  }
  return 'Belum pernah ditanya. Tekan tombol di bawah lalu pilih Izinkan pada dialog browser.';
}

export function dayKey(date: Date = new Date()): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** One notification per subject per day: `hug:<id>`, `checkin:2026-11-04`, ... */
export function markShownOnce(key: string): boolean {
  const today = dayKey();
  let seen: Record<string, string> = {};
  try {
    seen = (JSON.parse(readStorage(SHOWN_KEY) ?? '{}') ?? {}) as Record<string, string>;
  } catch {
    seen = {};
  }
  if (seen[key] === today) return false;
  // Keys older than a week can never match again, so they are dropped rather than
  // growing the entry forever.
  const fresh: Record<string, string> = {};
  for (const [existing, day] of Object.entries(seen)) {
    if (existing === key || day >= shiftDay(today, -7)) fresh[existing] = day;
  }
  fresh[key] = today;
  writeStorage(SHOWN_KEY, JSON.stringify(fresh));
  return true;
}

function shiftDay(yyyy_mm_dd: string, days: number): string {
  const [y, m, d] = yyyy_mm_dd.split('-').map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function assetUrl(fileName: string): string | undefined {
  try {
    return new URL(fileName, new URL('.', document.baseURI).href).href;
  } catch {
    return undefined;
  }
}

function buildOptions(n: GrowNotification): NotificationOptions {
  return toNotificationOptions(n, {
    // The app icon is a warm round illustration; the badge is the monochrome
    // silhouette the status bar uses.
    icon: assetUrl('pwa-192x192.png') ?? '',
    badge: assetUrl('notif-badge.png') ?? '',
  }) as NotificationOptions;
}

async function workerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Deliver through the worker when there is one so the notification survives the
 *  tab being closed; `new Notification` only covers a running page. */
export async function showGrowNotification(n: GrowNotification): Promise<DeliveryResult> {
  if (!notificationsSupported()) return 'unsupported';
  if (currentPermission() !== 'granted') return 'denied';
  if (!loadNotifPrefs().enabled[n.kind]) return 'off';
  const options = buildOptions(n);
  const registration = await workerRegistration();
  try {
    if (registration) await registration.showNotification(n.title, options);
    else new Notification(n.title, options);
    return 'shown';
  } catch (error) {
    // A rejected payload used to vanish here; a notification that never appeared
    // is the one failure the pair cannot see for themselves.
    console.warn('notifikasi gagal tampil:', error);
    return 'unsupported';
  }
}

function postToWorker(message: GrowNotifMessage): boolean {
  const active = navigator.serviceWorker?.controller;
  if (!active) return false;
  active.postMessage(message);
  return true;
}

/**
 * Hand a reminder to the worker so it can still fire with the app closed.
 * Resolves false when the browser has no trigger API, which is the signal for the
 * caller to fall back to an in-page timer.
 */
export function scheduleFutureReminder(
  n: GrowNotification,
  triggerAt: number
): Promise<boolean> {
  if (currentPermission() !== 'granted') return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(ok);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as Partial<Extract<GrowNotifMessage, { type: 'gt:scheduled' }>>;
      if (data?.type === 'gt:scheduled' && data.kind === n.kind) finish(data.ok === true);
    };
    const timer = setTimeout(() => finish(false), 2000);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    if (!postToWorker({ type: 'gt:schedule', notification: n, triggerAt })) finish(false);
  });
}

export async function cancelReminder(tag: string): Promise<void> {
  const registration = await workerRegistration();
  if (registration) {
    try {
      const pending = await registration.getNotifications({ tag });
      for (const notification of pending) {
        // Worker-delivered notifications expose cancel(); the page type does not,
        // so a reminder that has not fired yet is dropped through the wider shape.
        const cancellable = notification as Notification & { cancel?: () => void };
        if (cancellable.cancel) cancellable.cancel();
        else notification.close();
      }
    } catch {
      // A browser without cancel support simply has nothing pending.
    }
  }
  postToWorker({ type: 'gt:cancel', tag });
}

const LOG_KEY = 'gt_notif_log_v1';

export interface DeliveryRecord {
  kind: NotificationKind;
  result: DeliveryResult;
  at: number;
  title: string;
}

export function readDeliveryLog(): DeliveryRecord[] {
  try {
    const parsed = JSON.parse(readStorage(LOG_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as DeliveryRecord[]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

/** Whether a notification appeared is invisible from the outside, so every attempt
 *  is kept for the settings screen to show instead of silence. */
export function recordDelivery(n: GrowNotification, result: DeliveryResult) {
  const entry: DeliveryRecord = { kind: n.kind, result, at: Date.now(), title: n.title };
  writeStorage(LOG_KEY, JSON.stringify([entry, ...readDeliveryLog()].slice(0, 12)));
}

type BadgeRegistration = ServiceWorkerRegistration & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** A launcher badge is the one cue that survives an ignored notification, so the
 *  unread count is still visible after the phone goes back in a pocket. */
export async function setUnreadBadge(count: number): Promise<boolean> {
  const registration = (await workerRegistration()) as BadgeRegistration | undefined;
  if (!registration?.setAppBadge) return false;
  try {
    if (count > 0) await registration.setAppBadge(count);
    else await registration.clearAppBadge?.();
    return true;
  } catch {
    // iOS and uninstalled tabs reject badging; the in-app dot still covers it.
    return false;
  }
}

export interface ChannelSnapshot {
  /** The OS will never show anything: this browser has no Notification API. */
  apiMissing: boolean;
  permission: PermissionState;
  /** A worker controls the page, which is what makes badging and delivery work. */
  controlled: boolean;
  standalone: boolean;
  /** A VAPID key ships in this build and the browser can open subscriptions. */
  pushCapable: boolean;
  /** Which half is missing when push cannot be used: build key or browser API. */
  pushBlocker: PushBlocker;
  /** This device handed its push address to the server, so a closed phone wakes. */
  pushSubscribed: boolean;
  /** Which push service holds the address, for the diagnostics table. */
  pushService: string;
}

export function channelSnapshot(): ChannelSnapshot {
  const push = pushState();
  return {
    apiMissing: !notificationsSupported(),
    permission: currentPermission(),
    controlled: !!navigator.serviceWorker?.controller,
    standalone:
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    pushCapable: push.capable,
    pushBlocker: push.blocker,
    pushSubscribed: push.subscribed,
    pushService: push.service,
  };
}
