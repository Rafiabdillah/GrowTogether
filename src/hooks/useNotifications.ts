import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CheckIn, Couple, FocusSession, Habit, HabitLog } from '../types/index';
import {
  askPermission,
  cancelReminder,
  currentPermission,
  dayKey,
  loadNotifPrefs,
  markShownOnce,
  notificationsSupported,
  saveNotifPrefs,
  scheduleFutureReminder,
  showGrowNotification,
  shouldAskPermission,
  type DeliveryResult,
  type PermissionState,
} from '../lib/notifications';
import {
  PERIODIC_SYNC_TAG,
  REPLY_HUG_ACTION,
  type GrowNotification,
  type NotifPrefs,
  type NotificationKind,
} from '../lib/growNotifTypes';

export interface NotificationInput {
  /** Signed in, in a room, and not in demo mode: the only state worth notifying for. */
  ready: boolean;
  userId: string;
  partnerName: string;
  habits: Habit[];
  logs: HabitLog[];
  sessions: FocusSession[];
  checkins: CheckIn[];
  couple: Couple;
}

export interface NotifyOptions {
  onceKey?: string;
  /** News the on-screen toast already covered should not also hit the shade. */
  skipWhenVisible?: boolean;
}

export interface GrowNotifications {
  supported: boolean;
  permission: PermissionState;
  prefs: NotifPrefs;
  setKindEnabled: (kind: NotificationKind, on: boolean) => void;
  setCheckInAt: (value: string) => void;
  setHabitAt: (value: string) => void;
  requestPermission: () => Promise<PermissionState>;
  notify: (n: GrowNotification, options?: NotifyOptions) => Promise<DeliveryResult>;
  notifyTest: () => Promise<DeliveryResult>;
}

const STREAK_KEY = 'gt_last_streak_';

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // The celebration simply repeats once if the memory cannot be kept.
  }
}

function atClock(clock: string, fallback: string, now = new Date()): Date {
  const [hour, minute] = clock.split(':').map(Number);
  const target = new Date(now);
  target.setHours(Number.isFinite(hour) ? hour : 20, Number.isFinite(minute) ? minute : 0, 0, 0);
  return target;
}

function isHabitDueToday(frequency: Habit['frequency'], now = new Date()): boolean {
  const weekday = now.getDay() >= 1 && now.getDay() <= 5;
  if (frequency === 'weekdays') return weekday;
  if (frequency === 'weekends') return !weekday;
  return true;
}

function startOfWeek(now = new Date()): Date {
  const start = new Date(now);
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function weekNumber(now = new Date()): string {
  const start = startOfWeek(now);
  return `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`;
}

function minutesThisWeek(sessions: FocusSession[], now = new Date()): {
  reading: number;
  study: number;
} {
  const from = startOfWeek(now).getTime();
  let reading = 0;
  let study = 0;
  for (const session of sessions) {
    const at = Date.parse(session.timestamp || '');
    if (!Number.isFinite(at) || at < from) continue;
    const minutes = Math.round((session.durationSeconds || 0) / 60);
    if (session.category === 'baca') reading += minutes;
    else study += minutes;
  }
  return { reading, study };
}

export function useGrowNotifications(input: NotificationInput): GrowNotifications {
  const { ready, userId, partnerName, habits, logs, sessions, checkins, couple } = input;
  const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const [permission, setPermission] = useState<PermissionState>(currentPermission);
  const timers = useRef<Record<string, number>>({});

  const supported = notificationsSupported();

  useEffect(() => {
    saveNotifPrefs(prefs);
  }, [prefs]);

  // Permission is only worth asking for once the device is actually inside a room,
  // and never twice on the same device.
  useEffect(() => {
    if (!ready || !supported) return;
    if (Notification.permission !== 'default') {
      setPermission(Notification.permission);
      return;
    }
    if (!shouldAskPermission()) return;
    void askPermission().then(setPermission);
  }, [ready, supported]);

  const notify = useCallback(
    async (n: GrowNotification, options?: NotifyOptions): Promise<DeliveryResult> => {
      if (options?.skipWhenVisible && document.visibilityState === 'visible') return 'off';
      if (options?.onceKey && !markShownOnce(options.onceKey)) return 'duplicate';
      return showGrowNotification(n);
    },
    []
  );

  const requestPermission = useCallback(async () => {
    const result = await askPermission();
    setPermission(result);
    return result;
  }, []);

  const setKindEnabled = useCallback((kind: NotificationKind, on: boolean) => {
    setPrefs((prev) => ({ ...prev, enabled: { ...prev.enabled, [kind]: on } }));
  }, []);

  const setCheckInAt = useCallback((value: string) => {
    setPrefs((prev) => ({ ...prev, checkInAt: value }));
  }, []);

  const setHabitAt = useCallback((value: string) => {
    setPrefs((prev) => ({ ...prev, habitAt: value }));
  }, []);

  const notifyTest = useCallback(async () => {
    return notify(
      {
        kind: 'hug',
        title: 'Ini contoh notifikasi',
        body: 'Kalau pesan ini muncul di bar notifikasi, pengingat kalian sudah aktif.',
        tag: 'gt-test',
        tab: 'couple',
        actions: [REPLY_HUG_ACTION],
      },
      { onceKey: `test:${dayKey()}` }
    );
  }, [notify]);

  // Only primitives belong in the sweep's dependencies: snapshot callbacks fire on
  // every write, and a reminder must not be re-armed a dozen times a minute.
  const today = dayKey();
  const checkedInToday = useMemo(
    () => checkins.some((c) => c.userId === userId && c.date === today),
    [checkins, userId, today]
  );
  const pendingHabitCount = useMemo(() => {
    const done = new Set(
      logs.filter((log) => log.date === today && log.completed).map((log) => log.habitId)
    );
    return habits.filter(
      (habit) => habit.ownerId === userId && isHabitDueToday(habit.frequency) && !done.has(habit.id)
    ).length;
  }, [habits, logs, today, userId]);
  const pendingHabitTitles = useMemo(() => {
    const done = new Set(
      logs.filter((log) => log.date === today && log.completed).map((log) => log.habitId)
    );
    return habits
      .filter((habit) => habit.ownerId === userId && isHabitDueToday(habit.frequency) && !done.has(habit.id))
      .slice(0, 2)
      .map((habit) => habit.title)
      .join(' dan ');
  }, [habits, logs, today, userId]);
  const weeklyGap = useMemo(() => {
    const minutes = minutesThisWeek(sessions);
    const weekday = new Date().getDay();
    const nearlyOver = weekday === 0 || weekday === 6;
    const readingShort = minutes.reading < couple.weeklyReadingMinutesGoal;
    const studyShort = minutes.study < couple.weeklyStudyMinutesGoal;
    return nearlyOver && (readingShort || studyShort)
      ? { reading: couple.weeklyReadingMinutesGoal - minutes.reading, study: couple.weeklyStudyMinutesGoal - minutes.study }
      : null;
  }, [sessions, couple.weeklyReadingMinutesGoal, couple.weeklyStudyMinutesGoal]);
  const combinedStreak = couple.combinedStreak;

  const clearTimers = () => {
    for (const id of Object.values(timers.current)) window.clearTimeout(id);
    timers.current = {};
  };

  const sweep = useCallback(async () => {
    clearTimers();
    if (!ready || permission !== 'granted') return;
    const now = new Date();

    const checkInDue = !checkedInToday;
    const checkInTag = `gt-checkin-${today}`;
    if (prefs.enabled.checkin && checkInDue) {
      const at = atClock(prefs.checkInAt, '20:30', now);
      const notification: GrowNotification = {
        kind: 'checkin',
        title: 'Check-in malam belum diisi',
        body: partnerName
          ? `Ceritakan harimu ke ${partnerName}, satu menit saja.`
          : 'Catat mood dan hal yang kamu syukuri hari ini.',
        tag: checkInTag,
        tab: 'couple',
        when: at.getTime(),
      };
      if (now.getTime() >= at.getTime()) {
        await notify(notification, { onceKey: `checkin:${today}` });
      } else if (!(await scheduleFutureReminder(notification, at.getTime()))) {
        timers.current.checkin = window.setTimeout(
          () => void notify(notification, { onceKey: `checkin:${today}` }),
          at.getTime() - now.getTime()
        );
      }
    } else {
      await cancelReminder(checkInTag);
    }

    const habitDue = pendingHabitCount > 0;
    const habitTag = `gt-habit-${today}`;
    if (prefs.enabled.habit && habitDue) {
      const at = atClock(prefs.habitAt, '19:00', now);
      const notification: GrowNotification = {
        kind: 'habit',
        title:
          pendingHabitCount === 1
            ? 'Satu habit belum kamu selesaikan'
            : `${pendingHabitCount} habit belum selesai hari ini`,
        body: pendingHabitTitles
          ? `Masih menunggu: ${pendingHabitTitles}.`
          : 'Buka GrowTogether dan centang yang sudah kamu kerjakan.',
        tag: habitTag,
        tab: 'today',
        when: at.getTime(),
      };
      if (now.getTime() >= at.getTime()) {
        await notify(notification, { onceKey: `habit:${today}` });
      } else if (!(await scheduleFutureReminder(notification, at.getTime()))) {
        timers.current.habit = window.setTimeout(
          () => void notify(notification, { onceKey: `habit:${today}` }),
          at.getTime() - now.getTime()
        );
      }
    } else {
      await cancelReminder(habitTag);
    }

    if (prefs.enabled.streak && weeklyGap) {
      const at = atClock(prefs.habitAt, '19:00', now);
      const behind = [
        weeklyGap.reading > 0 ? `baca ${weeklyGap.reading} menit lagi` : null,
        weeklyGap.study > 0 ? `fokus ${weeklyGap.study} menit lagi` : null,
      ].filter(Boolean);
      const notification: GrowNotification = {
        kind: 'streak',
        title: 'Target mingguan kalian hampir lewat',
        body: `Tinggal ${behind.join(' dan ')} sebelum minggu berganti.`,
        tag: `gt-week-${weekNumber(now)}`,
        tab: 'progress',
        when: at.getTime(),
      };
      if (now.getTime() >= at.getTime()) {
        await notify(notification, { onceKey: `week:${weekNumber(now)}` });
      } else if (!(await scheduleFutureReminder(notification, at.getTime()))) {
        timers.current.week = window.setTimeout(
          () => void notify(notification, { onceKey: `week:${weekNumber(now)}` }),
          at.getTime() - now.getTime()
        );
      }
    }
  }, [
    notify,
    partnerName,
    pendingHabitCount,
    pendingHabitTitles,
    permission,
    prefs,
    ready,
    today,
    checkedInToday,
    weeklyGap,
  ]);

  useEffect(() => {
    void sweep();
    return clearTimers;
  }, [sweep]);

  // Coming back to the app, or the worker's periodic wake-up, re-arms what the
  // device could not decide about while it was asleep.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setPermission(currentPermission());
        void sweep();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'gt:tick') void sweep();
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [sweep]);

  // A streak that grew since the last visit is worth celebrating once, even if the
  // phone was closed when it happened.
  useEffect(() => {
    if (!ready || !prefs.enabled.streak || combinedStreak <= 0) return;
    const key = `${STREAK_KEY}${userId}`;
    const remembered = readNumber(key);
    if (remembered === null) {
      writeNumber(key, combinedStreak);
      return;
    }
    if (combinedStreak <= remembered) {
      if (combinedStreak !== remembered) writeNumber(key, combinedStreak);
      return;
    }
    writeNumber(key, combinedStreak);
    void notify(
      {
        kind: 'streak',
        title: `Streak kalian ${combinedStreak} hari`,
        body: 'Dua orang yang muncul setiap hari. Pertahankan sampai akhir minggu.',
        tag: `gt-streak-${combinedStreak}`,
        tab: 'progress',
      },
      { onceKey: `streak:${combinedStreak}`, skipWhenVisible: true }
    );
  }, [combinedStreak, notify, prefs.enabled.streak, ready, userId]);

  // Registering the periodic wake-up is only possible from a running page, and the
  // browser enforces its own minimum interval.
  useEffect(() => {
    if (!ready || permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.getRegistration().then((registration) => {
      const periodic = (
        registration as
          | (ServiceWorkerRegistration & { sync?: { periodic?: { register: (tag: string) => Promise<boolean> } } })
          | undefined
      )?.sync?.periodic;
      void periodic?.register(PERIODIC_SYNC_TAG)?.catch(() => undefined);
    });
  }, [ready, permission]);

  return {
    supported,
    permission,
    prefs,
    setKindEnabled,
    setCheckInAt,
    setHabitAt,
    requestPermission,
    notify,
    notifyTest,
  };
}
