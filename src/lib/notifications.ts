import {
  DEFAULT_NOTIF_PREFS,
  type GrowNotification,
  type GrowNotifMessage,
  type NotifPrefs,
  type NotificationKind,
  toNotificationOptions,
} from './growNotifTypes';

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

export async function askPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported';
  markPermissionAsked();
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    // Some embedded browsers throw instead of showing nothing at all.
    return Notification.permission;
  }
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
