import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { NOTIFICATION_KIND_ORDER, type NotifPrefs, type NotificationKind } from './growNotifTypes';

// A closed phone can only be woken by a server that signs the request with the
// VAPID private key. The page's job ends at handing over the address: subscribe
// with the public key, then store that address under this device's own uid.
const VAPID_PUBLIC_KEY = ((import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '').trim();

const SUB_DOC_KEY = 'gt_push_doc_v1';

export type PushOutcome = 'subscribed' | 'unsupported' | 'unconfigured' | 'no-permission' | 'failed';

/** Which half of the pair is missing decides what to tell the user: a build
 *  without a key needs a rebuild, a browser without PushManager needs a
 *  different browser — and blaming the build for the browser is a lie. */
export type PushBlocker = 'ok' | 'no-key' | 'no-api';

export function pushBlocker(): PushBlocker {
  if (typeof navigator === 'undefined' || !('PushManager' in navigator)) return 'no-api';
  if (VAPID_PUBLIC_KEY.length === 0) return 'no-key';
  return 'ok';
}

export interface PushState {
  /** The browser can open subscriptions and the app ships a VAPID key. */
  capable: boolean;
  subscribed: boolean;
  /** Why the device cannot subscribe, when it cannot. */
  blocker: PushBlocker;
  /** Short form of the push service address, for the diagnostics table. */
  service: string;
}

export function pushConfigured(): boolean {
  return pushBlocker() === 'ok';
}

/** Chrome expects the raw p256 key; the manifest and the server both hand it over
 *  as base64url, so the padding that base64 dropped has to come back first. */
function keyToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes.buffer;
}

async function endpointHash(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Diagnostics fall back to asking the browser again.
  }
}

function clearStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing left to forget.
  }
}

/** The worker has to exist before a subscription can be opened on it, and a page
 *  that loads faster than the worker registers must not hang waiting for `ready`. */
async function workerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
  } catch {
    // Fall through to the ready promise.
  }
  try {
    return (
      (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8000)),
      ])) ?? undefined
    );
  } catch {
    return undefined;
  }
}

/** The kind switches are device settings, but a push arrives with the app closed,
 *  so the same switches have to travel to the server that decides to send. */
export function prefsForServer(prefs: NotifPrefs): Record<NotificationKind, boolean> {
  return Object.fromEntries(
    NOTIFICATION_KIND_ORDER.map((kind) => [kind, prefs.enabled[kind] === true])
  ) as Record<NotificationKind, boolean>;
}

function describeService(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint.slice(0, 24);
  }
}

function toBase64(buffer: ArrayBuffer | Uint8Array | null): string {
  if (!buffer) return '';
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** What this install has recorded locally. */
export function pushState(): PushState {
  const blocker = pushBlocker();
  const capable = blocker === 'ok';
  const stored = readStorage(SUB_DOC_KEY);
  return {
    capable,
    subscribed: capable && stored.length > 0,
    blocker,
    service: capable && stored ? describeService(stored.split('|')[1] || '') : '',
  };
}

/** What the browser actually still holds, asked straight from the push manager:
 *  an address can expire without the page ever learning about it. */
export async function verifyPush(): Promise<PushState> {
  const state = pushState();
  if (!state.capable) return state;
  const registration = await workerRegistration();
  const subscription = await registration?.pushManager?.getSubscription().catch(() => null);
  if (!subscription) return { ...state, subscribed: false, service: '' };
  return { ...state, subscribed: true, service: describeService(subscription.endpoint) };
}

async function saveSubscription(userId: string, subscription: PushSubscription, prefs: NotifPrefs) {
  const json = subscription.toJSON();
  const endpoint = json.endpoint || subscription.endpoint;
  const p256dh = json.keys?.p256dh || toBase64(subscription.getKey('p256dh'));
  const authKey = json.keys?.auth || toBase64(subscription.getKey('auth'));
  if (!endpoint || !p256dh || !authKey) return false;
  const id = `${userId}-${await endpointHash(endpoint)}`;
  // The id is kept locally because a device identity reset moves every document
  // under a new uid, and this install must still be able to drop its own address.
  writeStorage(SUB_DOC_KEY, `${id}|${endpoint}`);
  await setDoc(
    doc(db, 'pushSubscriptions', id),
    {
      ownerId: userId,
      endpoint,
      keys: { p256dh, auth: authKey },
      prefs: prefsForServer(prefs),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
  return true;
}

/**
 * Opens (or reuses) the device's push subscription and publishes its address.
 * Called only after a real tap granted the notification permission.
 */
export async function registerPush(userId: string, prefs: NotifPrefs): Promise<PushOutcome> {
  if (!pushConfigured()) return 'unconfigured';
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 'no-permission';
  if (!userId) return 'failed';
  const registration = await workerRegistration();
  if (!registration?.pushManager) return 'unsupported';
  try {
    const current =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBuffer(VAPID_PUBLIC_KEY),
      }));
    const saved = await saveSubscription(userId, current, prefs);
    return saved ? 'subscribed' : 'failed';
  } catch (error) {
    console.warn('langganan push gagal dibuka:', error);
    return 'failed';
  }
}

/** Keep the server's copy of the switches in step with the device's. */
export async function syncPushPrefs(prefs: NotifPrefs): Promise<boolean> {
  const stored = readStorage(SUB_DOC_KEY);
  if (!stored) return false;
  const [id] = stored.split('|');
  try {
    await setDoc(doc(db, 'pushSubscriptions', id), { prefs: prefsForServer(prefs) }, { merge: true });
    return true;
  } catch (error) {
    console.warn('preferensi push gagal disimpan:', error);
    return false;
  }
}

export async function removePush(): Promise<boolean> {
  const stored = readStorage(SUB_DOC_KEY);
  const [id] = stored ? stored.split('|') : [];
  clearStorage(SUB_DOC_KEY);
  let unsubscribed = false;
  try {
    const registration = await workerRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription) unsubscribed = await subscription.unsubscribe();
  } catch (error) {
    console.warn('langganan push gagal dilepas:', error);
  }
  if (id) {
    await deleteDoc(doc(db, 'pushSubscriptions', id)).catch(() => undefined);
  }
  return unsubscribed;
}
