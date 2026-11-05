// Shapes shared by the page, the service worker, and (later) the push payload.
// Kept free of DOM and worker types so both sides can import it.

export type NotificationKind =
  | 'hug'
  | 'checkin'
  | 'habit'
  | 'agreement'
  | 'journal'
  | 'streak';

export interface GrowNotifAction {
  action: 'gt-reply-hug';
  title: string;
}

export interface GrowNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Reusing a tag replaces the old notification instead of stacking another one. */
  tag: string;
  /** App tab opened when the notification is tapped. */
  tab: string;
  actions?: GrowNotifAction[];
  /** A reminder must be able to replace the one it supersedes. */
  renotify?: boolean;
  /** Keeps an answer-needed alert on the shade until it is dealt with. */
  requireInteraction?: boolean;
  /** Epoch ms shown as the notification time and used as the trigger moment. */
  when?: number;
  /** Quiet delivery for news that should not beep at midnight. */
  silent?: boolean;
}

export type GrowNotifMessage =
  | { type: 'gt:schedule'; notification: GrowNotification; triggerAt: number }
  | { type: 'gt:scheduled'; kind: NotificationKind; ok: boolean }
  | { type: 'gt:cancel'; tag: string }
  | { type: 'gt:tick' }
  | { type: 'gt:action'; action: 'gt-reply-hug'; notification: GrowNotification }
  /** The push service dropped this device's address; only a page can renew it. */
  | { type: 'gt:push-renew' }
  /** News that arrived through the push channel, so the page can log it. */
  | { type: 'gt:push-received'; notification: GrowNotification };

export const REPLY_HUG_ACTION: GrowNotifAction = {
  action: 'gt-reply-hug',
  title: 'Balas pelukan',
};

export const PERIODIC_SYNC_TAG = 'gt-reminders';

export interface NotifPrefs {
  enabled: Record<NotificationKind, boolean>;
  /** 24-hour "HH:MM" reminder times. */
  checkInAt: string;
  habitAt: string;
}

export const NOTIFICATION_KIND_ORDER: NotificationKind[] = [
  'hug',
  'agreement',
  'journal',
  'checkin',
  'habit',
  'streak',
];

export const KIND_LABELS: Record<NotificationKind, { title: string; hint: string }> = {
  hug: { title: 'Semangat dari pasangan', hint: 'Reaksi dan pelukan yang dikirim pasangan ke kamu.' },
  agreement: { title: 'Kesepakatan perlu keputusan', hint: 'Usulan, permintaan keringanan, atau tukar sanksi yang menunggu jawabanmu.' },
  journal: { title: 'Cerita baru', hint: 'Jurnal mingguan dan check-in yang dibagi pasangan.' },
  checkin: { title: 'Pengingat check-in malam', hint: 'Kabar pasangan kalau kamu sudah check-in, plus pengingat saat malam tiba.' },
  habit: { title: 'Pengingat habit', hint: 'Habit kamu yang belum selesai hari ini.' },
  streak: { title: 'Streak & target mingguan', hint: 'Perayaan streak kalian dan pengingat target mingguan yang mendekati habis.' },
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  enabled: {
    hug: true,
    checkin: true,
    habit: true,
    agreement: true,
    journal: true,
    streak: true,
  },
  checkInAt: '20:30',
  habitAt: '19:00',
};

export interface GrowNotifAssets {
  icon: string;
  badge: string;
}

// A gentle triple-tap reads as "this is for you". A quiet delivery asks for
// silence instead, and the browser rejects a payload that asks for both at once.
const VIBRATE_ALERT = [90, 50, 90, 50, 160];

/**
 * Turns a GrowNotification into the object the browser expects. Both the page and
 * the worker build payloads here so a reminder looks identical wherever it came
 * from; only the icon URLs differ, since neither side can compute the other's.
 */
export function toNotificationOptions(
  n: GrowNotification,
  assets: GrowNotifAssets
): Record<string, unknown> {
  const silent = n.silent ?? false;
  return {
    body: n.body,
    tag: n.tag,
    icon: assets.icon,
    badge: assets.badge,
    lang: 'id',
    dir: 'ltr',
    timestamp: n.when ?? Date.now(),
    ...(silent ? {} : { vibrate: VIBRATE_ALERT }),
    renotify: n.renotify ?? false,
    requireInteraction: n.requireInteraction ?? false,
    silent,
    data: n,
    actions: n.actions?.map(({ action, title }) => ({ action, title })),
  };
}
