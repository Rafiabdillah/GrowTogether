import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  PERIODIC_SYNC_TAG,
  toNotificationOptions,
  type GrowNotification,
  type GrowNotifMessage,
} from './lib/growNotifTypes';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0];
};

// Offline behaviour is unchanged from the generated worker: the app shell is
// precached, navigations fall back to the cached index, and the two font hosts
// stay in a long-lived cache.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), ({ url }) => url.origin === self.location.origin)
);
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

self.skipWaiting();
clientsClaim();

// skipWaiting means an already-open page keeps running its own bundle while this
// newer worker takes over. Say which build is now live so the page can offer a
// reload instead of letting the two partners drift apart in silence.
self.addEventListener('activate', () => {
  void self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage({ type: 'gt:build', version: __APP_VERSION__ });
    }
  });
});

interface WaitUntilEvent extends Event {
  waitUntil: (promise: Promise<unknown>) => void;
}
interface TaggedEvent extends WaitUntilEvent {
  tag?: string;
}
interface ClickEvent extends WaitUntilEvent {
  action?: string;
  notification: Notification;
}
interface PushEvent extends WaitUntilEvent {
  data: { text: () => string } | null;
}
interface WorkerMessageEvent extends WaitUntilEvent {
  data: unknown;
  source: EventTarget | null;
}
interface MessageTarget extends EventTarget {
  postMessage: (message: unknown) => void;
}
type TriggerCtor = new (timestamp: number) => unknown;

// Chrome can fire a notification at an absolute time with the app closed; every
// other browser answers 'undefined' and the page keeps its own timer instead.
const TimestampTrigger = (self as unknown as { TimestampTrigger?: TriggerCtor }).TimestampTrigger;

function assetBase(): string {
  return new URL('./', self.location.href).href;
}

function notificationAssets() {
  const base = assetBase();
  return { icon: `${base}pwa-192x192.png`, badge: `${base}notif-badge.png` };
}

function optionsFor(n: GrowNotification): NotificationOptions {
  return toNotificationOptions(n, notificationAssets()) as NotificationOptions;
}

/** The app lives at the worker's own directory, so a tap lands on the right tab
 *  of the installed app rather than a stray origin path. */
function appUrl(tab: string): string {
  return `${assetBase()}?tab=${encodeURIComponent(tab)}`;
}

/** Browsers refuse to raise a window outside a real tap (Android, some desktop
 *  contexts), and a rejected focus would fail the whole click. */
async function focusQuietly(client: Client): Promise<Client> {
  const raisable = client as Client & { focus?: () => Promise<Client | undefined> };
  try {
    return (await raisable.focus?.()) ?? client;
  } catch {
    return client;
  }
}

async function openApp(tab: string): Promise<Client | null> {
  const url = appUrl(tab);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const client = windows.find((candidate) => 'focus' in candidate);
  if (!client) return self.clients.openWindow(url);
  // Only reload when the open window is showing something else.
  const alreadyThere = new URL(client.url).searchParams.get('tab') === tab;
  if (!alreadyThere) {
    try {
      await client.navigate(url);
    } catch {
      // A window that refuses to navigate is still focused below.
    }
  }
  return focusQuietly(client);
}

async function deliver(n: GrowNotification): Promise<void> {
  await self.registration.showNotification(n.title, optionsFor(n));
}

async function schedule(n: GrowNotification, triggerAt: number): Promise<boolean> {
  if (!TimestampTrigger || triggerAt <= Date.now()) return false;
  try {
    await self.registration.showNotification(n.title, {
      ...optionsFor(n),
      showTrigger: new TimestampTrigger(triggerAt),
    } as NotificationOptions);
    return true;
  } catch {
    // Without trigger support the page keeps the reminder itself.
    return false;
  }
}

async function cancelPending(tag: string): Promise<void> {
  const pending = await self.registration.getNotifications({ tag });
  for (const notification of pending) {
    const cancellable = notification as Notification & { cancel?: () => void };
    if (cancellable.cancel) cancellable.cancel();
    else notification.close();
  }
}

// Periodic sync has no data of its own: it wakes a running window so the app can
// recompute what is due, since only the page can read the couple's state.
async function notifyClients(message: GrowNotifMessage): Promise<void> {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((window) => (window as MessageTarget).postMessage(message));
}

function parsePushPayload(text: string): GrowNotification | null {
  try {
    const raw = JSON.parse(text) as Partial<GrowNotification>;
    if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;
    if (typeof raw.kind !== 'string' || typeof raw.tag !== 'string') return null;
    return {
      kind: raw.kind as GrowNotification['kind'],
      title: raw.title,
      body: raw.body,
      tag: raw.tag,
      tab: typeof raw.tab === 'string' ? raw.tab : 'today',
      actions: raw.actions,
      renotify: raw.renotify,
      requireInteraction: raw.requireInteraction,
      when: typeof raw.when === 'number' ? raw.when : undefined,
      silent: raw.silent,
    };
  } catch {
    return null;
  }
}

self.addEventListener('push', (event) => {
  const pushEvent = event as PushEvent;
  const text = pushEvent.data?.text();
  const payload = text ? parsePushPayload(text) : null;
  if (!payload) return;
  pushEvent.waitUntil(
    (async () => {
      await deliver(payload);
      // A page that happens to be open learns the news arrived over the push
      // channel, so the delivery log can tell the two routes apart.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const window of windows) {
        (window as MessageTarget).postMessage({ type: 'gt:push-received', notification: payload });
      }
    })()
  );
});

// Push addresses expire on their own (Chrome rotates them, a reinstall voids
// them). The worker cannot re-subscribe without the page's VAPID key, so it asks.
self.addEventListener('pushsubscriptionchange', () => {
  void notifyClients({ type: 'gt:push-renew' });
});

self.addEventListener('notificationclick', (event) => {
  const clickEvent = event as ClickEvent;
  const notification = clickEvent.notification;
  const payload = notification.data as GrowNotification | undefined;
  notification.close();
  if (clickEvent.action === 'gt-reply-hug' && payload) {
    clickEvent.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const client = windows.find((candidate) => 'focus' in candidate);
        if (!client) {
          await openApp(payload.tab);
          return;
        }
        await focusQuietly(client);
        (client as MessageTarget).postMessage({
          type: 'gt:action',
          action: 'gt-reply-hug',
          notification: payload,
        } satisfies GrowNotifMessage);
      })()
    );
    return;
  }
  clickEvent.waitUntil(openApp(payload?.tab ?? 'today'));
});

self.addEventListener('periodicsync', (event) => {
  const syncEvent = event as TaggedEvent;
  if (syncEvent.tag !== PERIODIC_SYNC_TAG) return;
  syncEvent.waitUntil(notifyClients({ type: 'gt:tick' }));
});

self.addEventListener('message', (event) => {
  const messageEvent = event as WorkerMessageEvent;
  const message = messageEvent.data as GrowNotifMessage | undefined;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'gt:schedule') {
    const answer = (ok: boolean) => {
      const source = messageEvent.source as MessageTarget | null;
      if (typeof source?.postMessage === 'function') {
        source.postMessage({ type: 'gt:scheduled', kind: message.notification.kind, ok });
      }
    };
    messageEvent.waitUntil(schedule(message.notification, message.triggerAt).then(answer));
    return;
  }
  if (message.type === 'gt:cancel') {
    messageEvent.waitUntil(cancelPending(message.tag));
  }
});
