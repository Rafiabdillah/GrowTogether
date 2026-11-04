import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { onAuthStateChanged, deleteUser, User } from 'firebase/auth';
import {
  UserProfile,
  Couple,
  Habit,
  HabitLog,
  FocusSession,
  Book,
  JournalEntry,
  Reaction,
  Agreement,
  CheckIn,
  IslandDecorationId,
  TimeOfDay,
  WeatherType,
} from '../types/index';
import {
  SEED_USER_A,
  SEED_USER_B,
  SEED_COUPLE,
  SEED_HABITS,
  SEED_BOOKS,
  SEED_JOURNALS,
  SEED_AGREEMENTS,
  SEED_CHECKINS,
  ISLAND_DECORATIONS,
  XP_PER_LEVEL,
  getTodayDateString,
  toLocalDateString,
} from '../data/mockData';
import { sound } from '../lib/audio';
import { friendlyAccountError } from '../lib/authErrors';
import { coupleStreak, streakAnchor } from '../lib/streak';
import { useGrowNotifications, type GrowNotifications } from '../hooks/useNotifications';
import { REPLY_HUG_ACTION, type GrowNotification } from '../lib/growNotifTypes';
import {
  db,
  auth,
  ensureAnonymousSession,
  retryAnonymousSession,
  resetDeviceIdentity,
} from '../lib/firebase';
import {
  collection,
  doc,
  type QueryConstraint,
  setDoc as firestoreSetDoc,
  deleteDoc as firestoreDeleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocFromServer,
  getDocs,
  deleteField,
  increment,
  runTransaction,
  waitForPendingWrites,
  terminate,
  clearIndexedDbPersistence,
} from 'firebase/firestore';
import {
  emitSyncEvent,
  explainSyncEvent,
  subscribeSyncEvents,
  type SyncEvent,
} from '../lib/syncBus';

interface AppContextType {
  // Auth
  authUser: User | null;
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  isDemoMode: boolean;
  authError: string;
  retryAuth: () => Promise<void>;
  setDisplayName: (name: string) => void;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  switchAccount: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  leaveCouple: () => Promise<void>;
  
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  couple: Couple;
  /** Consecutive days the couple completed something, derived from shared logs. */
  combinedStreak: number;
  habits: Habit[];
  logs: HabitLog[];
  sessions: FocusSession[];
  books: Book[];
  journals: JournalEntry[];
  reactions: Reaction[];
  checkins: CheckIn[];
  checkIns: CheckIn[];
  activeNotification: Reaction | null;
  dismissNotification: () => void;
  // Permission state, reminder clocks and the per-kind switches.
  notifications: GrowNotifications;
  // Sync diagnostics: every Firestore failure used to land in console.warn only.
  syncEvents: SyncEvent[];
  syncAlert: SyncEvent | null;
  dismissSyncAlert: () => void;
  lastSentReaction: { emoji: string; at: number; ok: boolean } | null;
  partnerUid: string;
  roomCode: string;
  cloudIdentity: { userId: string; coupleId: string };
  runSyncTest: () => Promise<{ ok: boolean; detail: string }>;
  rebuildLocalCache: () => Promise<void>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  isOnline: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  agreements: Agreement[];
  allSanctionsPaused: boolean;
  highFiveCelebrated: boolean;
  dismissHighFive: () => void;
  
  // Settings & Production Management
  showSimulatorToolbar: boolean;
  toggleSimulatorToolbar: () => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  updateCoupleProfile: (updates: Partial<Couple>) => Promise<void>;
  resetToEmptyState: () => void;
  loadDemoData: () => void;
  setupUserProfile: (user: User) => Promise<void>;
  createCouple: (displayName?: string) => Promise<void>;
  joinCouple: (inviteCode: string, displayName?: string) => Promise<boolean>;

  // Actions
  toggleHabit: (habitId: string, targetDate?: string) => Promise<void>;
  addHabit: (newHabit: Omit<Habit, 'id' | 'createdAt'>) => Promise<void>;
  editHabit: (id: string, updates: Partial<Habit>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  recordFocusSession: (session: Omit<FocusSession, 'id' | 'timestamp'>) => Promise<void>;
  sendReaction: (emoji: string, habitTitle?: string, message?: string) => Promise<void>;
  addBook: (book: Omit<Book, 'id' | 'updatedAt'>) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  addJournal: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => Promise<void>;
  updateJournal: (id: string, updates: Partial<JournalEntry>) => Promise<void>;
  deleteJournal: (id: string) => Promise<void>;
  toggleGraceDay: () => Promise<void>;
  switchSimulatedUser: () => void;
  pairWithCode: (code: string) => Promise<boolean>;
  
  // Rituals & Island Actions
  recordCheckIn: (checkInData: Omit<CheckIn, 'id' | 'createdAt'>) => Promise<void>;
  unlockDecoration: (decorationId: IslandDecorationId) => Promise<boolean>;
  setTimeOfDay: (time: TimeOfDay) => Promise<void>;
  setWeather: (weather: WeatherType) => Promise<void>;
  addCoupleXP: (amount: number) => Promise<void>;
  triggerSimulatedHighFive: () => void;
  advanceSimulatedDay: () => void;

  // Agreements Actions
  createAgreement: (agreement: Omit<Agreement, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  approveAgreement: (id: string) => Promise<void>;
  rejectAgreement: (id: string) => Promise<void>;
  triggerAgreement: (id: string) => Promise<void>;
  deleteAgreement: (id: string) => Promise<void>;
  respondToPendingAction: (id: string, approve: boolean) => Promise<void>;
  resolveSanction: (id: string, resolution: 'completed' | 'relief_requested' | 'swapped', note?: string) => Promise<void>;
  useJokerCard: (agreementId: string) => Promise<boolean>;
  togglePauseAllSanctions: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const STATE_KEY = 'gt_state_v1';
const SYNC_CHANNEL = 'growtogether_sync_bus';
// BroadcastChannel echoes back to other channel objects in the same tab,
// so tag messages to ignore our own broadcasts.
const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab_${Math.random().toString(36).slice(2)}`;

const mergeById = <T extends { id: string }>(...groups: T[][]): T[] => {
  const byId = new Map<string, T>();
  groups.forEach((group) => group.forEach((item) => byId.set(item.id, item)));
  return Array.from(byId.values());
};

interface PersistedState {
  couple: Couple;
  users: { [id: string]: UserProfile };
  habits: Habit[];
  logs: HabitLog[];
  sessions: FocusSession[];
  books: Book[];
  journals: JournalEntry[];
  agreements: Agreement[];
  checkins: CheckIn[];
}

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
    // Storage is blocked in private mode or full; the app keeps working in memory.
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Same as above: nothing to clean up if storage is unavailable.
  }
}

// Demo mode keeps everything local; cloud writes are skipped instead of being
// rejected by security rules.
let cloudSyncEnabled = false;

type FirestoreDocRef = ReturnType<typeof doc>;

function syncErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// setDoc() resolves as soon as the local cache accepts the write, so a device on
// a dead network reports "saved" while the partner sees nothing. This waits for
// the server acknowledgement without ever blocking the UI.
function watchServerAck(referencePath: string) {
  const unconfirmed = new Promise<'unconfirmed'>((resolve) =>
    setTimeout(() => resolve('unconfirmed'), 15000)
  );
  void Promise.race([
    waitForPendingWrites(db).then(() => 'acked' as const),
    unconfirmed,
  ])
    .then((result) => {
      if (result === 'acked') return;
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: referencePath,
        ok: false,
        message: 'unconfirmed: perubahan masih tersimpan di perangkat dan belum diterima server',
      });
    })
    .catch((error) => {
      // waitForPendingWrites rejects with the server's verdict on the queued
      // write, which is the only place a rules rejection ever becomes visible.
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: referencePath,
        ok: false,
        message: `server menolak tulisan: ${syncErrorText(error)}`,
      });
    });
}

async function cloudSetDoc(
  reference: FirestoreDocRef,
  data: object,
  options?: { merge?: boolean }
) {
  if (!cloudSyncEnabled) return;
  try {
    if (options) {
      await firestoreSetDoc(reference, data, options);
    } else {
      await firestoreSetDoc(reference, data);
    }
    emitSyncEvent({ at: Date.now(), kind: 'write', target: reference.path, ok: true });
    watchServerAck(reference.path);
  } catch (error) {
    emitSyncEvent({
      at: Date.now(),
      kind: 'write',
      target: reference.path,
      ok: false,
      message: syncErrorText(error),
    });
    throw error;
  }
}

async function cloudDeleteDoc(reference: FirestoreDocRef) {
  if (!cloudSyncEnabled) return;
  try {
    await firestoreDeleteDoc(reference);
    emitSyncEvent({ at: Date.now(), kind: 'delete', target: reference.path, ok: true });
    watchServerAck(reference.path);
  } catch (error) {
    emitSyncEvent({
      at: Date.now(),
      kind: 'delete',
      target: reference.path,
      ok: false,
      message: syncErrorText(error),
    });
    throw error;
  }
}

function loadPersistedState(): Partial<PersistedState> {
  const raw = readStorage(STATE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function fireConfetti(options: confetti.Options) {
  confetti({ ...options, disableForReducedMotion: true });
}

function generateInviteCode(): string {
  // The code is the only thing guarding a room, so it is long enough that
  // guessing one is not a realistic route in.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(8);
    crypto.getRandomValues(values);
    for (const value of values) code += alphabet[value % alphabet.length];
  } else {
    for (let i = 0; i < 8; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return code;
}

// A room id is a read capability: the list rules cannot prove membership with
// get(), so unguessability is what keeps a stranger from listing a room.
function randomSuffix(): string {
  const values = new Uint32Array(4);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < values.length; i++) values[i] = Math.floor(Math.random() * 0xffffffff);
  }
  return Array.from(values, (v) => v.toString(36).padStart(7, '0')).join('');
}

const DISPLAY_NAME_KEY = 'gt_display_name';

function readPreferredDisplayName(): string {
  const stored = readStorage(DISPLAY_NAME_KEY);
  return typeof stored === 'string' ? stored.trim().slice(0, 40) : '';
}

// A hug that arrived while the phone was closed should still greet the partner
// on the next open, but a month of history must not.
const NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;

function isFreshNews(createdAt?: string): boolean {
  const at = Date.parse(createdAt ?? '');
  if (!Number.isFinite(at)) return false;
  const delta = Date.now() - at;
  return delta >= 0 && delta < NEWS_WINDOW_MS;
}

function whenOf(createdAt?: string): number {
  const at = Date.parse(createdAt ?? '');
  return Number.isFinite(at) ? at : Date.now();
}

function hugNotification(reaction: Reaction): GrowNotification {
  return {
    kind: 'hug',
    title: `${reaction.senderName} mengirim semangat`,
    body: reaction.message || `${reaction.emoji}${reaction.habitTitle ? ` untuk ${reaction.habitTitle}` : ' untuk kamu'}.`,
    tag: `gt-hug-${reaction.id}`,
    tab: 'today',
    actions: [REPLY_HUG_ACTION],
    when: whenOf(reaction.createdAt),
  };
}

function agreementNotification(agreement: Agreement): GrowNotification {
  const relief = agreement.pendingAction === 'relief';
  const swap = agreement.pendingAction === 'swap';
  return {
    kind: 'agreement',
    title: relief || swap ? 'Pasangan menunggu jawabanmu' : 'Kesepakatan menunggu persetujuanmu',
    body: `${agreement.creatorName || 'Pasangan'}: "${agreement.title}"${agreement.pendingNote ? ` — ${agreement.pendingNote}` : ''}`,
    tag: `gt-agreement-${agreement.id}`,
    tab: 'agreements',
    requireInteraction: true,
    when: whenOf(agreement.updatedAt || agreement.createdAt),
  };
}

// Anything a partner sent was aimed at this account, so a decision that is not
// theirs to make is not worth waking them for.
function needsMyDecision(agreement: Agreement, meId: string): boolean {
  if (agreement.creatorId === meId) return false;
  if (agreement.status === 'pending_approval' && !agreement.partnerApproved) return true;
  return !!agreement.pendingAction && agreement.pendingActionBy !== meId;
}

function journalNotification(entry: JournalEntry): GrowNotification {
  return {
    kind: 'journal',
    title: `Cerita baru dari ${entry.authorName || 'pasanganmu'}`,
    body: entry.whatWorked || entry.nextWeekGoal || 'Menulis jurnal minggu ini.',
    tag: `gt-journal-${entry.id}`,
    tab: 'couple',
    silent: true,
    when: whenOf(entry.createdAt),
  };
}

function partnerCheckInNotification(entry: CheckIn): GrowNotification {
  const mood = ['', 'lagi berat', 'agak berat', 'cukup baik', 'menyenangkan', 'luar biasa'][entry.mood] || 'sudah lewat';
  return {
    kind: 'checkin',
    title: `${entry.userName || 'Pasanganmu'} sudah check-in`,
    body: entry.gratitude ? `Harinya ${mood}. "${entry.gratitude}"` : `Harinya ${mood}.`,
    tag: `gt-partner-checkin-${entry.id}`,
    tab: 'couple',
    silent: true,
    when: whenOf(entry.createdAt),
  };
}

function normalizeCouple(id: string, data: Partial<Couple>): Couple {
  // Un-completing a habit sends increment(-10); a room that was already at zero
  // would otherwise show a negative balance in the shop.
  const levelXp = Math.max(0, data.levelXp ?? 0);
  return {
    ...SEED_COUPLE,
    ...data,
    id,
    user1Id: data.user1Id ?? '',
    user2Id: data.user2Id ?? '',
    unlockedDecorations: data.unlockedDecorations ?? [],
    weeklyReadingMinutesGoal: data.weeklyReadingMinutesGoal ?? 300,
    weeklyStudyMinutesGoal: data.weeklyStudyMinutesGoal ?? 200,
    levelXp,
    // Spending XP never demotes a level, so keep the highest known level.
    levelNumber: Math.max(data.levelNumber ?? 1, Math.floor(levelXp / XP_PER_LEVEL) + 1),
    jokerCardsUser1: data.jokerCardsUser1 ?? 2,
    jokerCardsUser2: data.jokerCardsUser2 ?? 2,
    allSanctionsPaused: data.allSanctionsPaused ?? false,
    graceDayUsedThisWeek: data.graceDayUsedThisWeek ?? false,
    selectedTimeOfDay: data.selectedTimeOfDay ?? 'auto',
    selectedWeather: data.selectedWeather ?? 'clear',
  };
}

// A placeholder room used whenever there is no signed-in cloud account, so no
// demo or previous-account data can leak into the next session.
function emptyCouple(): Couple {
  return normalizeCouple('', {
    user1Id: '',
    user2Id: '',
    user1Profile: undefined,
    user2Profile: undefined,
    levelXp: 0,
    levelNumber: 1,
    unlockedDecorations: [],
    jokerCardsUser1: 2,
    jokerCardsUser2: 2,
    selectedTimeOfDay: 'auto',
    selectedWeather: 'clear',
  });
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [saved] = useState<Partial<PersistedState>>(loadPersistedState);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(
    () => readStorage('gt_demo_mode') !== 'true'
  );
  const [authError, setAuthError] = useState<string>('');
  const lastAuthUidRef = useRef<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(
    () => readStorage('gt_demo_mode') === 'true'
  );
  const [currentUserId, setCurrentUserId] = useState<string>('user_rama_01');
  const [usersState, setUsersState] = useState<{ [id: string]: UserProfile }>({
    [SEED_USER_A.id]: SEED_USER_A,
    [SEED_USER_B.id]: SEED_USER_B,
    ...saved.users,
  });
  const [couple, setCouple] = useState<Couple>(saved.couple ?? SEED_COUPLE);
  const coupleRef = useRef<Couple>(couple);
  const [habits, setHabits] = useState<Habit[]>(saved.habits ?? SEED_HABITS);
  const [logs, setLogs] = useState<HabitLog[]>(saved.logs ?? []);
  const [sessions, setSessions] = useState<FocusSession[]>(saved.sessions ?? []);
  const [books, setBooks] = useState<Book[]>(saved.books ?? SEED_BOOKS);
  const [journals, setJournals] = useState<JournalEntry[]>(saved.journals ?? SEED_JOURNALS);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>(saved.agreements ?? SEED_AGREEMENTS);
  const [checkins, setCheckins] = useState<CheckIn[]>(saved.checkins ?? SEED_CHECKINS);
  const reactionsPrimed = useRef(false);
  const lastNotifiedReactionId = useRef<string | null>(null);
  const [activeNotification, setActiveNotification] = useState<Reaction | null>(null);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [syncAlert, setSyncAlert] = useState<SyncEvent | null>(null);
  const [lastSentReaction, setLastSentReaction] = useState<
    { emoji: string; at: number; ok: boolean } | null
  >(null);
  const [highFiveCelebrated, setHighFiveCelebrated] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [realToday, setRealToday] = useState<string>(getTodayDateString());
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showSimulatorToolbar, setShowSimulatorToolbar] = useState<boolean>(
    () => readStorage('gt_show_simulator') === 'true'
  );

  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(
    () => readStorage('gt_visited_v1') !== 'true'
  );

  const storedProfile = usersState[currentUserId];
  const currentUser: UserProfile = storedProfile ?? (
    authUser
      ? {
          id: authUser.uid,
          displayName: authUser.displayName || authUser.email?.split('@')[0] || readPreferredDisplayName() || 'Pengguna',
          email: authUser.email || '',
          photoURL: authUser.photoURL || undefined,
          colorTheme: 'coral',
          inviteCode: '',
          createdAt: new Date().toISOString(),
        }
      : SEED_USER_A
  );

  // Cloud writes must be addressed with the signed-in uid and the coupleId on the
  // profile document. `couple.id` is a listener result that can lag a room change,
  // and a write carrying a stale or empty coupleId is rejected by the security
  // rules — silently, because every caller used to swallow the error.
  const myUid = isDemoMode ? currentUser.id : authUser?.uid ?? currentUserId;
  const profileCoupleId =
    (authUser ? usersState[authUser.uid]?.coupleId : undefined) ?? currentUser.coupleId ?? '';
  const cloudIdentity = {
    userId: myUid,
    coupleId: isDemoMode ? couple.id || profileCoupleId : profileCoupleId,
  };
  // The room's own code is the one both partners can use to return; a member who
  // joined with the code has no invite code of their own pointing at the room.
  const roomCode = couple.roomCode || currentUser.inviteCode || '';
  // The room document is the authority on who the partner is; their profile may
  // not have arrived from Firestore yet, and reactions must not depend on it.
  const roomIsMine = !cloudIdentity.coupleId || couple.id === cloudIdentity.coupleId;
  const partnerUid = roomIsMine
    ? (couple.user1Id === myUid ? couple.user2Id : couple.user1Id) || ''
    : '';
  const partnerUser: UserProfile | null =
    partnerUid && partnerUid !== myUid ? usersState[partnerUid] ?? null : null;

  // Reminders and news only make sense once this device is inside a shared room;
  // demo mode has no partner to notify.
  const combinedStreak = coupleStreak(logs, streakAnchor(selectedDate, realToday));
  const notifications = useGrowNotifications({
    ready: !isDemoMode && !!authUser && !!cloudIdentity.coupleId,
    userId: myUid,
    partnerName: partnerUser?.displayName ?? '',
    habits,
    logs,
    sessions,
    checkins,
    couple,
    combinedStreak,
  });
  const { notify } = notifications;

  const clearLocalCollections = () => {
    setHabits([]);
    setLogs([]);
    setSessions([]);
    setBooks([]);
    setJournals([]);
    setAgreements([]);
    setCheckins([]);
    setReactions([]);
  };

  // Wipe everything that belongs to the previous account/demo session. Without
  // this, a device shared by two people shows the last account's cached data.
  const resetCloudSessionState = () => {
    removeStorage(STATE_KEY);
    setCouple(emptyCouple());
    setUsersState({});
    clearLocalCollections();
    setActiveNotification(null);
    setHighFiveCelebrated(false);
    setSyncEvents([]);
    setSyncAlert(null);
    setLastSentReaction(null);
  };

  // Opening the app is enough: the device gets its own Firebase identity without
  // any account to remember or password to type.
  useEffect(() => {
    if (readStorage('gt_demo_mode') === 'true') {
      setIsAuthLoading(false);
      return;
    }
    void (async () => {
      try {
        await ensureAnonymousSession();
        setAuthError('');
      } catch (error) {
        setAuthError(friendlyAccountError(error));
        setIsAuthLoading(false);
      }
    })();
  }, []);

  const retryAuth = async () => {
    setAuthError('');
    try {
      await retryAnonymousSession();
    } catch (error) {
      setAuthError(friendlyAccountError(error));
    }
  };

  // An anonymous identity carries no name, so the room screen collects one and
  // it is stored both on the device and on the profile document.
  const ensureDisplayName = async (name?: string): Promise<UserProfile> => {
    const clean = (name ?? '').trim().slice(0, 40);
    if (!clean) return currentUser;
    writeStorage(DISPLAY_NAME_KEY, clean);
    const uid = auth.currentUser?.uid;
    if (!uid) return currentUser;
    const me: UserProfile = { ...currentUser, id: uid, displayName: clean };
    setUsersState((prev) => ({ ...prev, [uid]: me }));
    try {
      await cloudSetDoc(doc(db, 'users', uid), { displayName: clean }, { merge: true });
    } catch (error) {
      console.warn('displayName patch:', error);
    }
    return me;
  };

  const setDisplayName = (name: string) => {
    void ensureDisplayName(name);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        const uidChanged = lastAuthUidRef.current !== user.uid;
        lastAuthUidRef.current = user.uid;
        cloudSyncEnabled = true;
        setIsDemoMode(false);
        writeStorage('gt_demo_mode', 'false');
        if (uidChanged) {
          resetCloudSessionState();
          setCurrentUserId(user.uid);
          setIsProfileLoading(true);
        }
        // Never block the app forever if the profile read stalls on a bad network.
        await Promise.race([
          setupUserProfile(user),
          new Promise<void>((resolve) => setTimeout(resolve, 8000)),
        ]);
        setIsProfileLoading(false);
      } else {
        cloudSyncEnabled = false;
        lastAuthUidRef.current = null;
        setIsProfileLoading(false);
        // A demo session survives an unanswered auth check, but a real logout
        // must not leave the previous account's data on screen.
        if (readStorage('gt_demo_mode') !== 'true') {
          resetCloudSessionState();
          setCurrentUserId('user_rama_01');
        }
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    cloudSyncEnabled = !!authUser && !isDemoMode;
  }, [authUser, isDemoMode]);

  // There is no account to sign out of: leaving means dropping this device's
  // identity and starting fresh, which lands on the room-code screen.
  const switchAccount = async () => {
    removeStorage(DISPLAY_NAME_KEY);
    await resetDeviceIdentity();
  };

  // Delete this device's room membership for good: personal documents first
  // (security rules require room membership), then leave/hand over the room,
  // then the profile. Anonymous identities need no re-authentication step.
  const deleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesi berakhir. Muat ulang halaman lalu coba lagi.');

    cloudSyncEnabled = true;

    const coupleId = currentUser.coupleId;
    let room = coupleRef.current;
    if (coupleId && room.id !== coupleId) {
      const snap = await getDoc(doc(db, 'couples', coupleId)).catch(() => null);
      if (snap?.exists()) {
        room = normalizeCouple(snap.id, snap.data() as Partial<Couple>);
      }
    }
    const partnerId = room.user1Id === user.uid ? room.user2Id : room.user1Id;

    const deleteWhereCouple = async (
      name: string,
      filter: (data: Record<string, unknown>) => boolean
    ) => {
      if (!coupleId) return;
      try {
        const snap = await getDocs(
          query(collection(db, name), where('coupleId', '==', coupleId))
        );
        const targets = snap.docs.filter((d) => filter(d.data()));
        await Promise.all(
          targets.map((d) => firestoreDeleteDoc(d.ref).catch(() => undefined))
        );
      } catch (e) {
        console.warn(`deleteAccount ${name}:`, e);
      }
    };
    // Rules only accept a query whose constraints prove every returned row is
    // readable by this device, so an in-room wipe is always coupleId-scoped.
    const ownRows = (name: string, field: string) => {
      const constraints: QueryConstraint[] = [where(field, '==', user.uid)];
      if (coupleId) constraints.unshift(where('coupleId', '==', coupleId));
      return query(collection(db, name), ...constraints);
    };
    const deleteWhereUser = async (name: string, field: string) => {
      try {
        const snap = await getDocs(ownRows(name, field));
        await Promise.all(
          snap.docs.map((d) => firestoreDeleteDoc(d.ref).catch(() => undefined))
        );
      } catch (e) {
        console.warn(`deleteAccount ${name}:`, e);
      }
    };
    // Shared habits belong to the couple, so the partner keeps their routine.
    // Private and personal habits leave with their owner (and everything goes
    // when there is no partner left to inherit the room).
    const deleteOwnHabits = async (keepShared: boolean) => {
      try {
        const snap = await getDocs(ownRows('habits', 'ownerId'));
        const targets = snap.docs.filter((d) => {
          const data = d.data() as Partial<Habit>;
          return !(keepShared && data.isShared === true && data.isPrivate !== true);
        });
        await Promise.all(
          targets.map((d) => firestoreDeleteDoc(d.ref).catch(() => undefined))
        );
      } catch (e) {
        console.warn('deleteAccount habits:', e);
      }
    };

    // 1. Personal data (still a member so security rules allow the deletes).
    await deleteOwnHabits(!!partnerId);
    await deleteWhereUser('logs', 'userId');
    await deleteWhereUser('sessions', 'userId');
    await deleteWhereUser('journals', 'authorId');
    await deleteWhereUser('checkins', 'userId');
    await deleteWhereCouple('reactions', (d) => d.senderId === user.uid);
    await deleteWhereCouple('books', (d) => d.addedById === user.uid);
    await deleteWhereCouple('agreements', (d) => d.creatorId === user.uid);

    // 2. Leave the room: inherit it to the partner, or dissolve it when alone.
    if (coupleId && room.id === coupleId) {
      try {
        if (room.user1Id === user.uid && partnerId) {
          const inheritedProfile = usersState[partnerId] ?? room.user2Profile ?? null;
          await firestoreSetDoc(
            doc(db, 'couples', coupleId),
            {
              user1Id: partnerId,
              user1Profile: inheritedProfile ?? deleteField(),
              user2Id: '',
              user2Profile: deleteField(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } else if (room.user2Id === user.uid) {
          await firestoreSetDoc(
            doc(db, 'couples', coupleId),
            { user2Id: '', user2Profile: deleteField(), updatedAt: new Date().toISOString() },
            { merge: true }
          );
        } else if (!room.user2Id) {
          await firestoreDeleteDoc(doc(db, 'couples', coupleId));
        }
      } catch (e) {
        console.warn('deleteAccount leave couple:', e);
      }
    }

    // 3. Remove the invite code and the profile document.
    if (currentUser.inviteCode) {
      await firestoreDeleteDoc(doc(db, 'inviteCodes', currentUser.inviteCode)).catch(
        () => undefined
      );
    }
    await firestoreDeleteDoc(doc(db, 'users', user.uid)).catch((e) =>
      console.warn('deleteAccount profile:', e)
    );

    // 4. Finally remove the Firebase Auth account itself.
    await deleteUser(user);

    removeStorage(STATE_KEY);
    removeStorage(DISPLAY_NAME_KEY);
    writeStorage('gt_demo_mode', 'false');
    lastAuthUidRef.current = null;
    setIsDemoMode(false);
    setIsProfileLoading(false);
    resetCloudSessionState();
    setCurrentUserId('user_rama_01');

    // The device gets a brand-new identity immediately, so the room-code screen
    // is ready without a reload.
    try {
      await ensureAnonymousSession();
      setAuthError('');
    } catch (error) {
      setAuthError(friendlyAccountError(error));
    }
  };

  // Leave the shared room without deleting the account. The partner keeps the
  // room (and its shared data); the leaver can create or join a room again.
  const leaveCouple = async (): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesi berakhir. Silakan masuk ulang.');
    if (isDemoMode) throw new Error('Mode demo tidak memakai ruang bersama.');

    cloudSyncEnabled = true;

    const mySnap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
    const myProfile = (mySnap?.data() as Partial<UserProfile> | undefined) ?? currentUser;
    const coupleId = myProfile.coupleId;
    const inviteCode = myProfile.inviteCode || currentUser.inviteCode;
    if (!coupleId) return;

    const roomSnap = await getDoc(doc(db, 'couples', coupleId)).catch(() => null);
    if (roomSnap?.exists()) {
      const room = normalizeCouple(roomSnap.id, roomSnap.data() as Partial<Couple>);
      const partnerId = room.user1Id === user.uid ? room.user2Id : room.user1Id;
      const now = new Date().toISOString();
      try {
        if (room.user1Id === user.uid && partnerId) {
          // Hand the room over so the partner is not locked out of their data.
          const inheritedProfile = usersState[partnerId] ?? room.user2Profile ?? null;
          await firestoreSetDoc(
            doc(db, 'couples', coupleId),
            {
              user1Id: partnerId,
              user1Profile: inheritedProfile ?? deleteField(),
              user2Id: '',
              user2Profile: deleteField(),
              updatedAt: now,
            },
            { merge: true }
          );
        } else if (room.user2Id === user.uid) {
          await firestoreSetDoc(
            doc(db, 'couples', coupleId),
            { user2Id: '', user2Profile: deleteField(), updatedAt: now },
            { merge: true }
          );
        } else if (!room.user2Id) {
          await firestoreDeleteDoc(doc(db, 'couples', coupleId));
        }
      } catch (e) {
        console.warn('leaveCouple room:', e);
        throw new Error('Gagal keluar dari ruang bersama. Periksa koneksi lalu coba lagi.');
      }
    }

    // The pointer must go too, otherwise somebody could join using this code
    // and end up in the partner's room. The profile keeps its code for later.
    if (inviteCode) {
      await firestoreDeleteDoc(doc(db, 'inviteCodes', inviteCode)).catch((e) =>
        console.warn('leaveCouple invite code:', e)
      );
    }

    await cloudSetDoc(
      doc(db, 'users', user.uid),
      { coupleId: deleteField() },
      { merge: true }
    );

    setUsersState((prev) => {
      const mine = prev[user.uid] ?? currentUser;
      return { ...prev, [user.uid]: { ...mine, coupleId: undefined } };
    });
    setCouple(emptyCouple());
    clearLocalCollections();
    setActiveNotification(null);
  };

  const setupUserProfile = async (user: User) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const newUser: UserProfile = {
          id: user.uid,
          displayName: readPreferredDisplayName() || user.displayName || user.email?.split('@')[0] || 'Pengguna',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
          colorTheme: 'coral',
          inviteCode: generateInviteCode(),
          createdAt: new Date().toISOString(),
        };
        await cloudSetDoc(userRef, newUser);
        setUsersState(prev => ({ ...prev, [user.uid]: newUser }));
        return;
      }

      const userData = userSnap.data() as UserProfile;
      const repaired: UserProfile = {
        ...userData,
        id: user.uid,
        displayName: userData.displayName || readPreferredDisplayName() || user.displayName || 'Pengguna',
        email: userData.email || user.email || '',
        inviteCode: userData.inviteCode || generateInviteCode(),
      };

      // A coupleId pointing at a room where this user is no longer a member
      // leaves the app stuck on a loading screen. Verify once and repair it.
      let staleCouple = false;
      if (repaired.coupleId) {
        try {
          const coupleSnap = await getDoc(doc(db, 'couples', repaired.coupleId));
          if (coupleSnap.exists()) {
            const room = coupleSnap.data() as Partial<Couple>;
            if (room.user1Id !== user.uid && room.user2Id !== user.uid) {
              staleCouple = true;
            }
          }
        } catch (e) {
          // Offline: keep the stored room, the snapshot listener reconciles later.
          console.warn('setupUserProfile verify couple:', e);
        }
      }
      if (staleCouple) delete repaired.coupleId;

      const patch: Record<string, unknown> = {};
      if (!userData.inviteCode) patch.inviteCode = repaired.inviteCode;
      if (staleCouple) patch.coupleId = deleteField();
      if (Object.keys(patch).length > 0) {
        await cloudSetDoc(userRef, patch, { merge: true });
      }
      setUsersState(prev => ({ ...prev, [user.uid]: repaired }));
    } catch (error) {
      console.warn('Error setting up user profile:', error);
      setUsersState(prev =>
        prev[user.uid]
          ? prev
          : {
              ...prev,
              [user.uid]: {
                id: user.uid,
                displayName: readPreferredDisplayName() || user.displayName || user.email?.split('@')[0] || 'Pengguna',
                email: user.email || '',
                photoURL: user.photoURL || undefined,
                colorTheme: 'coral',
                inviteCode: '',
                createdAt: new Date().toISOString(),
              },
            }
      );
    }
  };

  useEffect(() => {
    coupleRef.current = couple;
  }, [couple]);

  useEffect(() => {
    const snapshot: PersistedState = {
      couple,
      users: usersState,
      habits,
      logs,
      sessions,
      books,
      journals,
      agreements,
      checkins,
    };
    writeStorage(STATE_KEY, JSON.stringify(snapshot));
  }, [couple, usersState, habits, logs, sessions, books, journals, agreements, checkins]);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const stored = readStorage('gt_dark');
    if (stored === 'true' || stored === 'false') return stored === 'true';
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const toggleDarkMode = () => setIsDarkMode((prev: boolean) => !prev);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    writeStorage('gt_dark', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // A PWA left open across midnight must wake into the new day, otherwise this
  // device keeps counting the streak from yesterday while the partner's phone
  // counts from today.
  useEffect(() => {
    const refresh = () => setRealToday(getTodayDateString());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // Broadcast Channel for sub-second cross-tab synchronization
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel(SYNC_CHANNEL);

    channel.onmessage = (event) => {
      const { type, payload, sourceTabId } = event.data ?? {};
      if (sourceTabId === TAB_ID) return;
      if (type === 'LOG_UPDATED') {
        setLogs((prev) => {
          const index = prev.findIndex((l) => l.id === payload.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = payload;
            return next;
          }
          return [...prev, payload];
        });
      } else if (type === 'REACTION_SENT') {
        setReactions((prev) => [payload, ...prev]);
        if (payload.receiverId === currentUserId) {
          setActiveNotification(payload);
          sound.playReactionSent();
        }
      } else if (type === 'HABIT_ADDED') {
        setHabits((prev) => [...prev, payload]);
      } else if (type === 'BOOK_UPDATED') {
        setBooks((prev) => {
          const idx = prev.findIndex((b) => b.id === payload.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = payload;
            return copy;
          }
          return [payload, ...prev];
        });
      }
    };

    return () => channel.close();
  }, [currentUserId]);

  // Load the couple document that belongs to the signed-in profile
  useEffect(() => {
    const coupleId = currentUser.coupleId;
    if (!authUser || !coupleId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'couples', coupleId),
      (docSnap) => {
        if (docSnap.exists()) {
          setCouple(normalizeCouple(docSnap.id, docSnap.data() as Partial<Couple>));
          return;
        }
        // The room was dissolved (for example the partner deleted their account).
        // Only trust a server-confirmed miss, never an empty offline cache.
        if (docSnap.metadata.fromCache) return;
        setCouple(emptyCouple());
        const uid = authUser.uid;
        void cloudSetDoc(doc(db, 'users', uid), { coupleId: deleteField() }, { merge: true })
          .then(() =>
            setUsersState((prev) => ({
              ...prev,
              [uid]: { ...prev[uid], coupleId: undefined },
            }))
          )
          .catch((e) => console.warn('Firestore clear stale coupleId:', e));
      },
      (err) => {
        emitSyncEvent({
          at: Date.now(),
          kind: 'listen',
          target: 'ruang bersama',
          ok: false,
          message: err.message,
        });
        console.warn('Firestore couple snapshot:', err.message);
      }
    );
    return () => unsubscribe();
  }, [authUser, currentUser.coupleId]);

  // A room's invite pointer can go missing (owner deletion or ownership hand-over).
  // Recreate it from the signed-in profile so pairing keeps working.
  useEffect(() => {
    if (!authUser || isDemoMode) return;
    const { coupleId, inviteCode } = currentUser;
    if (!coupleId || !inviteCode) return;
    if (couple.id !== coupleId) return;
    if (couple.user1Id !== currentUser.id && couple.user2Id !== currentUser.id) return;

    // Rooms created before the code lived on the room document get it here, so
    // the second member can read and share it too.
    if (!couple.roomCode && couple.user1Id === currentUser.id) {
      void cloudSetDoc(doc(db, 'couples', coupleId), { roomCode: inviteCode }, { merge: true }).catch(
        () => undefined
      );
    }

    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'inviteCodes', inviteCode));
        const data = snap.data() as { userId?: string; coupleId?: string } | undefined;
        if (cancelled) return;
        if (snap.exists() && data?.userId === currentUser.id && data?.coupleId === couple.id) {
          return;
        }
        await cloudSetDoc(
          doc(db, 'inviteCodes', inviteCode),
          {
            userId: currentUser.id,
            coupleId: couple.id,
            ownerName: currentUser.displayName,
            photoURL: currentUser.photoURL ?? null,
            colorTheme: currentUser.colorTheme,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Firestore invite code self-heal:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authUser,
    isDemoMode,
    currentUser.id,
    currentUser.coupleId,
    currentUser.inviteCode,
    currentUser.displayName,
    currentUser.photoURL,
    currentUser.colorTheme,
    couple.id,
    couple.user1Id,
    couple.user2Id,
  ]);

  // Keep every room member's profile live, so name/photo changes on one device
  // appear on the partner's screen without a reload.
  useEffect(() => {
    if (!authUser || !currentUser.coupleId) return;
    const ids = Array.from(
      new Set([currentUser.id, couple.user1Id, couple.user2Id])
    ).filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return;

    const unsubs = ids.map((id) =>
      onSnapshot(
        doc(db, 'users', id),
        (snap) => {
          if (!snap.exists()) return;
          const profile = snap.data() as UserProfile;
          setUsersState((prev) => ({ ...prev, [snap.id]: { ...profile, id: snap.id } }));
        },
        (err) => {
          emitSyncEvent({
            at: Date.now(),
            kind: 'listen',
            target: 'profil',
            ok: false,
            message: err.message,
          });
          console.warn('Firestore user snapshot:', err.message);
        }
      )
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [authUser, currentUser.coupleId, currentUser.id, couple.user1Id, couple.user2Id]);

  // Live couple data: every screen reads from the same real-time collections.
  useEffect(() => {
    const coupleId = currentUser.coupleId;
    if (!authUser || !coupleId) return;

    reactionsPrimed.current = false;
    const byCouple = (name: string) =>
      query(collection(db, name), where('coupleId', '==', coupleId));
    const report = (name: string) => (err: Error) => {
      // A denied listener means the partner's data never arrives, and it used to
      // be invisible outside the developer console.
      emitSyncEvent({
        at: Date.now(),
        kind: 'listen',
        target: name,
        ok: false,
        message: err.message,
      });
      console.warn(`Firestore ${name} snapshot:`, err.message);
    };
    // One notification per subject: notify() drops anything already delivered
    // today and skips news the on-screen toast covered while the app was open.
    const announce = (n: GrowNotification, onceKey: string) => {
      void notify(n, { onceKey, skipWhenVisible: true });
    };

    // Privacy-aware collections are loaded as two queries — couple-visible docs and
    // the current user's own docs — because Firestore rules cannot express OR.
    let publicHabits: Habit[] = [];
    let ownHabits: Habit[] = [];
    const publishHabits = () =>
      setHabits(mergeById(publicHabits, ownHabits).filter((h) => h.coupleId === coupleId));

    const habitsPublicUnsub = onSnapshot(
      query(
        collection(db, 'habits'),
        where('coupleId', '==', coupleId),
        where('isPrivate', '==', false)
      ),
      (snapshot) => {
        publicHabits = snapshot.docs.map((d) => ({ ...(d.data() as Habit), id: d.id }));
        publishHabits();
      },
      report('habits')
    );

    // Own-document queries also filter on coupleId on purpose: the security
    // rules require 'coupleId' to exist on a habit before it can be read, and a
    // single legacy row without it would otherwise reject the whole listener and
    // blank out every habit on both phones.
    const habitsOwnUnsub = onSnapshot(
      query(
        collection(db, 'habits'),
        where('ownerId', '==', myUid),
        where('coupleId', '==', coupleId)
      ),
      (snapshot) => {
        ownHabits = snapshot.docs.map((d) => ({ ...(d.data() as Habit), id: d.id }));
        publishHabits();
      },
      report('habits')
    );

    let publicLogs: HabitLog[] = [];
    let ownLogs: HabitLog[] = [];
    const publishLogs = () =>
      setLogs(mergeById(publicLogs, ownLogs).filter((l) => l.coupleId === coupleId));

    const logsPublicUnsub = onSnapshot(
      query(
        collection(db, 'logs'),
        where('coupleId', '==', coupleId),
        where('visibility', '==', 'couple')
      ),
      (snapshot) => {
        publicLogs = snapshot.docs.map((d) => ({ ...(d.data() as HabitLog), id: d.id }));
        publishLogs();
      },
      report('logs')
    );

    const logsOwnUnsub = onSnapshot(
      query(
        collection(db, 'logs'),
        where('userId', '==', myUid),
        where('coupleId', '==', coupleId)
      ),
      (snapshot) => {
        ownLogs = snapshot.docs.map((d) => ({ ...(d.data() as HabitLog), id: d.id }));
        publishLogs();
      },
      report('logs')
    );

    let publicSessions: FocusSession[] = [];
    let ownSessions: FocusSession[] = [];
    const publishSessions = () => {
      const merged = mergeById(publicSessions, ownSessions).filter(
        (s) => s.coupleId === coupleId
      );
      merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setSessions(merged);
    };

    const sessionsPublicUnsub = onSnapshot(
      query(
        collection(db, 'sessions'),
        where('coupleId', '==', coupleId),
        where('visibility', '==', 'couple')
      ),
      (snapshot) => {
        publicSessions = snapshot.docs.map((d) => ({
          ...(d.data() as FocusSession),
          id: d.id,
        }));
        publishSessions();
      },
      report('sessions')
    );

    const sessionsOwnUnsub = onSnapshot(
      query(
        collection(db, 'sessions'),
        where('userId', '==', myUid),
        where('coupleId', '==', coupleId)
      ),
      (snapshot) => {
        ownSessions = snapshot.docs.map((d) => ({
          ...(d.data() as FocusSession),
          id: d.id,
        }));
        publishSessions();
      },
      report('sessions')
    );

    const booksUnsub = onSnapshot(
      byCouple('books'),
      (snapshot) => {
        const fetched: Book[] = snapshot.docs.map((d) => ({ ...(d.data() as Book), id: d.id }));
        fetched.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        setBooks(fetched);
      },
      report('books')
    );

    let publicJournals: JournalEntry[] = [];
    let ownJournals: JournalEntry[] = [];
    const publishJournals = () => {
      const merged = mergeById(publicJournals, ownJournals).filter(
        (j) => j.coupleId === coupleId
      );
      merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setJournals(merged);
    };

    const journalsPublicUnsub = onSnapshot(
      query(
        collection(db, 'journals'),
        where('coupleId', '==', coupleId),
        where('isShared', '==', true)
      ),
      (snapshot) => {
        publicJournals = snapshot.docs.map((d) => ({
          ...(d.data() as JournalEntry),
          id: d.id,
        }));
        publishJournals();
        const news = publicJournals.find((j) => j.authorId !== myUid && isFreshNews(j.createdAt));
        if (news) announce(journalNotification(news), `journal:${news.id}`);
      },
      report('journals')
    );

    const journalsOwnUnsub = onSnapshot(
      query(
        collection(db, 'journals'),
        where('authorId', '==', myUid),
        where('coupleId', '==', coupleId)
      ),
      (snapshot) => {
        ownJournals = snapshot.docs.map((d) => ({
          ...(d.data() as JournalEntry),
          id: d.id,
        }));
        publishJournals();
      },
      report('journals')
    );

    const seenReactionKey = `gt_seen_reaction_${currentUserId}`;
    const reactionsUnsub = onSnapshot(
      byCouple('reactions'),
      (snapshot) => {
        const fetched: Reaction[] = snapshot.docs.map((d) => ({ ...(d.data() as Reaction), id: d.id }));
        fetched.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        // Rows written before receiverId existed carry no addressee; anything a
        // partner sent was aimed at this account.
        const latestToMe = fetched.find(
          (r) => (r.receiverId ? r.receiverId === currentUserId : r.senderId !== currentUserId) &&
            r.senderId !== currentUserId
        );
        if (!reactionsPrimed.current) {
          // The first snapshot is history, not news — unless it holds a reaction
          // this device has never shown.
          reactionsPrimed.current = true;
          lastNotifiedReactionId.current = latestToMe?.id ?? null;
          if (latestToMe && latestToMe.id !== readStorage(seenReactionKey) && isFreshNews(latestToMe.createdAt)) {
            writeStorage(seenReactionKey, latestToMe.id);
            setActiveNotification(latestToMe);
            sound.playReactionSent();
            announce(hugNotification(latestToMe), `hug:${latestToMe.id}`);
          }
        } else if (latestToMe && latestToMe.id !== lastNotifiedReactionId.current) {
          lastNotifiedReactionId.current = latestToMe.id;
          writeStorage(seenReactionKey, latestToMe.id);
          setActiveNotification(latestToMe);
          sound.playReactionSent();
          announce(hugNotification(latestToMe), `hug:${latestToMe.id}`);
        }
        setReactions(fetched);
      },
      report('reactions')
    );

    const agreementsUnsub = onSnapshot(
      byCouple('agreements'),
      (snapshot) => {
        const fetched: Agreement[] = snapshot.docs.map((d) => ({
          ...(d.data() as Agreement),
          id: d.id,
        }));
        fetched.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setAgreements(fetched);
        const waiting = fetched.find(
          (a) => needsMyDecision(a, myUid) && isFreshNews(a.updatedAt || a.createdAt)
        );
        if (waiting) {
          announce(
            agreementNotification(waiting),
            `agreement:${waiting.id}:${waiting.status}:${waiting.pendingAction ?? 'none'}`
          );
        }
      },
      report('agreements')
    );

    let publicCheckins: CheckIn[] = [];
    let ownCheckins: CheckIn[] = [];
    const publishCheckins = () => {
      const merged = mergeById(publicCheckins, ownCheckins).filter(
        (c) => c.coupleId === coupleId
      );
      merged.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setCheckins(merged);
    };

    const checkinsPublicUnsub = onSnapshot(
      query(
        collection(db, 'checkins'),
        where('coupleId', '==', coupleId),
        where('isShared', '==', true)
      ),
      (snapshot) => {
        publicCheckins = snapshot.docs.map((d) => ({
          ...(d.data() as CheckIn),
          id: d.id,
        }));
        publishCheckins();
        const news = publicCheckins.find((c) => c.userId !== myUid && isFreshNews(c.createdAt));
        if (news) announce(partnerCheckInNotification(news), `partner-checkin:${news.id}`);
      },
      report('checkins')
    );

    const checkinsOwnUnsub = onSnapshot(
      query(
        collection(db, 'checkins'),
        where('userId', '==', myUid),
        where('coupleId', '==', coupleId)
      ),
      (snapshot) => {
        ownCheckins = snapshot.docs.map((d) => ({
          ...(d.data() as CheckIn),
          id: d.id,
        }));
        publishCheckins();
      },
      report('checkins')
    );

    return () => {
      habitsPublicUnsub();
      habitsOwnUnsub();
      logsPublicUnsub();
      logsOwnUnsub();
      sessionsPublicUnsub();
      sessionsOwnUnsub();
      booksUnsub();
      journalsPublicUnsub();
      journalsOwnUnsub();
      reactionsUnsub();
      agreementsUnsub();
      checkinsPublicUnsub();
      checkinsOwnUnsub();
    };
  }, [authUser, currentUser.coupleId, myUid, notify]);

  // Every Firestore failure reaches the UI: the newest one as a banner, the
  // recent history in the sync panel.
  useEffect(
    () =>
      subscribeSyncEvents((event) => {
        setSyncEvents((prev) => [event, ...prev].slice(0, 40));
        if (!event.ok) setSyncAlert(event);
      }),
    []
  );

  // A write aimed at no room is rejected by the security rules, and a write aimed
  // at the wrong room lands where the partner will never look. Refuse instead.
  const requireRoom = (label: string): string | null => {
    if (cloudIdentity.coupleId) return cloudIdentity.coupleId;
    emitSyncEvent({
      at: Date.now(),
      kind: 'write',
      target: label,
      ok: false,
      message: 'belum masuk ruang bersama, jadi perubahan tidak bisa dikirim ke pasangan',
    });
    return null;
  };

  const dismissSyncAlert = () => setSyncAlert(null);

  // The on-device Firestore cache can keep serving an old room after a re-pair,
  // which looks exactly like "data pasangan hilang". Wipe it and start clean.
  const rebuildLocalCache = async () => {
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (error) {
      console.warn('Firestore cache reset:', error);
    }
    window.location.reload();
  };

  // Rows written by older builds can be missing the privacy flags the partner's
  // queries filter on, which hides them from the other phone for good. Only the
  // owner may patch their own rows, and the owner's own listener always returns
  // them, so the repair happens here and stops as soon as the fields exist.
  useEffect(() => {
    if (isDemoMode || !authUser) return;
    const habitIsPrivate = (habitId?: string) =>
      habits.find((h) => h.id === habitId)?.isPrivate === true;

    for (const habit of habits.filter((h) => h.ownerId === myUid && h.isPrivate === undefined)) {
      void cloudSetDoc(
        doc(db, 'habits', habit.id),
        { isPrivate: false, isShared: habit.isShared !== false },
        { merge: true }
      ).catch(() => undefined);
    }
    for (const log of logs.filter((l) => l.userId === myUid && !l.visibility)) {
      void cloudSetDoc(
        doc(db, 'logs', log.id),
        { visibility: habitIsPrivate(log.habitId) ? 'private' : 'couple' },
        { merge: true }
      ).catch(() => undefined);
    }
    for (const session of sessions.filter((s) => s.userId === myUid && !s.visibility)) {
      void cloudSetDoc(
        doc(db, 'sessions', session.id),
        { visibility: habitIsPrivate(session.habitId) ? 'private' : 'couple' },
        { merge: true }
      ).catch(() => undefined);
    }
  }, [isDemoMode, authUser, myUid, habits, logs, sessions]);

  // Writes the smallest possible document into a collection both partners may
  // read, then insists on reading it back from the server. This is the only way
  // to tell "the network is fine" apart from "your changes never leave the phone".
  const runSyncTest = async (): Promise<{ ok: boolean; detail: string }> => {
    const coupleId = cloudIdentity.coupleId;
    if (!authUser) return { ok: false, detail: 'Sesi perangkat belum terbuka.' };
    if (!coupleId) return { ok: false, detail: 'Ruang belum dibuat. Pakai kode ruang dulu.' };

    const probeId = `probe_${Date.now()}`;
    const ref = doc(db, 'reactions', probeId);
    const startedAt = Date.now();
    try {
      await firestoreSetDoc(ref, {
        coupleId,
        senderId: authUser.uid,
        senderName: currentUser.displayName,
        receiverId: authUser.uid,
        emoji: '🧪',
        message: 'Tes sinkronisasi otomatis',
        createdAt: new Date().toISOString(),
      });
      await Promise.race([
        waitForPendingWrites(db),
        new Promise<void>((resolve) => setTimeout(resolve, 10000)),
      ]);
      const snap = await getDocFromServer(ref);
      const arrived = snap.exists();
      await firestoreDeleteDoc(ref).catch(() => undefined);
      const ms = Date.now() - startedAt;
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: 'tes sinkronisasi',
        ok: arrived,
        message: arrived ? undefined : 'server tidak mengembalikan dokumen tes',
      });
      return arrived
        ? { ok: true, detail: `Server Firebase menerima dan mengembalikan data dalam ${ms} ms.` }
        : {
            ok: false,
            detail: 'Tulisan tidak kembali dari server. Biasanya aturan akses atau koneksi.',
          };
    } catch (error) {
      const message = syncErrorText(error);
      await firestoreDeleteDoc(ref).catch(() => undefined);
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: 'tes sinkronisasi',
        ok: false,
        message,
      });
      return { ok: false, detail: message };
    }
  };

  // Room-level patches (goals, weather, joker cards) all address the couple doc.
  const patchCoupleRoom = async (updates: Partial<Couple>, label: string) => {
    const coupleId = requireRoom(label);
    if (!coupleId) return;
    try {
      await cloudSetDoc(doc(db, 'couples', coupleId), updates, { merge: true });
    } catch (e) {
      console.warn(`Firestore ${label}:`, e);
    }
  };

  // Toggle a habit for a given day (defaults to the selected date)
  const toggleHabit = async (habitId: string, targetDate?: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (!requireRoom('habit ' + habit.title)) return;

    const date = targetDate ?? selectedDate;
    const logId = `${habitId}_${date}_${myUid}`;
    const existing = logs.find((l) => l.id === logId);
    const newCompleted = !existing?.completed;
    const updatedLog: HabitLog = {
      id: logId,
      habitId,
      userId: myUid,
      coupleId: habit.coupleId || cloudIdentity.coupleId,
      date,
      completed: newCompleted,
      durationMinutes: existing?.durationMinutes ?? habit.targetMinutes ?? 0,
      completedAt: newCompleted ? new Date().toISOString() : undefined,
      // Firestore cannot query a missing field, so the partner's visibility
      // filter needs this written explicitly on every row.
      visibility: habit.isPrivate ? 'private' : 'couple',
    };

    setLogs((prev) => {
      const index = prev.findIndex((l) => l.id === logId);
      if (index >= 0) {
        const next = [...prev];
        next[index] = updatedLog;
        return next;
      }
      return [...prev, updatedLog];
    });

    if (newCompleted) {
      sound.playHabitComplete();
      fireConfetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#E06D53', '#4A826B', '#E5A93C', '#FFD166'],
      });
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage({ type: 'LOG_UPDATED', payload: updatedLog, sourceTabId: TAB_ID });
      channel.close();
    }

    try {
      await cloudSetDoc(doc(db, 'logs', logId), updatedLog, { merge: true });
    } catch (e) {
      console.warn('Firestore setDoc log:', e);
    }

    await addCoupleXP(newCompleted ? 10 : -10);
  };

  // Add Habit
  const addHabit = async (newHabit: Omit<Habit, 'id' | 'createdAt'>) => {
    const coupleId = requireRoom('habit baru');
    if (!coupleId) return;
    const id = `habit_${Date.now()}`;
    const habitObj: Habit = {
      ...newHabit,
      coupleId,
      ownerId: myUid,
      isShared: newHabit.isShared !== false,
      isPrivate: newHabit.isPrivate === true,
      id,
      createdAt: new Date().toISOString(),
    };
    setHabits((prev) => [...prev, habitObj]);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage({ type: 'HABIT_ADDED', payload: habitObj, sourceTabId: TAB_ID });
      channel.close();
    }

    try {
      await cloudSetDoc(doc(db, 'habits', id), habitObj);
    } catch (e) {
      console.warn('Firestore addHabit error:', e);
    }
  };

  // Edit Habit
  const editHabit = async (id: string, updates: Partial<Habit>) => {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...updates } : h)));
    try {
      await cloudSetDoc(doc(db, 'habits', id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore editHabit:', e);
    }
  };

  // Delete Habit
  const deleteHabit = async (id: string) => {
    const ownLogs = logs.filter((l) => l.habitId === id && l.userId === currentUser.id);
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => prev.filter((l) => !(l.habitId === id && l.userId === currentUser.id)));
    try {
      await Promise.all(ownLogs.map((l) => cloudDeleteDoc(doc(db, 'logs', l.id))));
      await cloudDeleteDoc(doc(db, 'habits', id));
    } catch (e) {
      console.warn('Firestore deleteHabit:', e);
    }
  };

  // Record Focus Session
  const recordFocusSession = async (sessionData: Omit<FocusSession, 'id' | 'timestamp'>) => {
    const coupleId = requireRoom('sesi fokus');
    if (!coupleId) return;
    const sessionId = `session_${Date.now()}`;
    const sessionHabit = sessionData.habitId
      ? habits.find((h) => h.id === sessionData.habitId)
      : undefined;
    const sessionObj: FocusSession = {
      ...sessionData,
      coupleId: sessionData.coupleId || coupleId,
      userId: myUid,
      id: sessionId,
      timestamp: new Date().toISOString(),
      visibility: sessionHabit?.isPrivate ? 'private' : 'couple',
    };
    setSessions((prev) => [sessionObj, ...prev]);

    // Auto-complete the matching habit once its target minutes are reached
    if (sessionData.habitId) {
      const habit = habits.find((h) => h.id === sessionData.habitId);
      const minutes = Math.round(sessionData.durationSeconds / 60);
      const logId = `${sessionData.habitId}_${selectedDate}_${myUid}`;
      const previous = logs.find((l) => l.id === logId);
      const totalMinutes = (previous?.durationMinutes || 0) + minutes;
      const reachedTarget =
        !habit || habit.targetMinutes <= 0 || totalMinutes >= habit.targetMinutes;
      const logObj: HabitLog = {
        id: logId,
        habitId: sessionData.habitId,
        userId: myUid,
        coupleId: habit?.coupleId || coupleId,
        date: selectedDate,
        completed: reachedTarget,
        durationMinutes: totalMinutes,
        completedAt: reachedTarget
          ? previous?.completedAt ?? new Date().toISOString()
          : undefined,
        visibility: habit?.isPrivate ? 'private' : 'couple',
      };
      setLogs((prev) => {
        const idx = prev.findIndex((l) => l.id === logId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = logObj;
          return copy;
        }
        return [...prev, logObj];
      });

      if (reachedTarget && !previous?.completed) {
        sound.playHabitComplete();
        void addCoupleXP(10);
      }

      try {
        await cloudSetDoc(doc(db, 'logs', logId), logObj, { merge: true });
      } catch (e) {
        console.warn('Firestore auto-log focus session:', e);
      }
    }

    try {
      await cloudSetDoc(doc(db, 'sessions', sessionId), sessionObj);
    } catch (e) {
      console.warn('Firestore session write:', e);
    }
  };

  // Send "Semangatin" Reaction
  const sendReaction = async (emoji: string, habitTitle?: string, message?: string) => {
    const coupleId = requireRoom('reaksi semangat');
    if (!coupleId) return;
    if (!partnerUid) {
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: 'reaksi semangat',
        ok: false,
        message: 'belum ada pasangan di ruang ini, jadi pelukan tidak bisa dikirim',
      });
      return;
    }

    const reactionId = `react_${Date.now()}`;
    const reactionObj: Reaction = {
      id: reactionId,
      coupleId,
      senderId: myUid,
      senderName: currentUser.displayName,
      receiverId: partnerUid,
      emoji,
      habitTitle,
      message: message || `Menyemangati kamu dengan ${emoji}!`,
      createdAt: new Date().toISOString(),
    };

    setReactions((prev) => [reactionObj, ...prev]);
    setLastSentReaction({ emoji, at: Date.now(), ok: true });
    sound.playReactionSent();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL);
      channel.postMessage({ type: 'REACTION_SENT', payload: reactionObj, sourceTabId: TAB_ID });
      channel.close();
    }

    try {
      await cloudSetDoc(doc(db, 'reactions', reactionId), reactionObj);
    } catch (e) {
      console.warn('Firestore sendReaction:', e);
    }
  };

  // "Balas pelukan" on a notification is answered by the worker handing the job to
  // a running window, because only the page is allowed to write to the room.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onAction = (event: MessageEvent) => {
      const data = event.data as { type?: string; action?: string } | undefined;
      if (data?.type !== 'gt:action' || data.action !== 'gt-reply-hug') return;
      void sendReaction('❤️', 'Balas pelukan', 'Balik peluk!');
    };
    navigator.serviceWorker.addEventListener('message', onAction);
    return () => navigator.serviceWorker.removeEventListener('message', onAction);
  }, [sendReaction]);

  // Add Book
  const addBook = async (bookData: Omit<Book, 'id' | 'updatedAt'>) => {
    const coupleId = requireRoom('buku');
    if (!coupleId) return;
    const id = `book_${Date.now()}`;
    const bookObj: Book = {
      ...bookData,
      coupleId,
      id,
      addedById: myUid,
      updatedAt: new Date().toISOString(),
    };
    setBooks((prev) => [bookObj, ...prev]);
    try {
      await cloudSetDoc(doc(db, 'books', id), bookObj);
    } catch (e) {
      console.warn('Firestore addBook:', e);
    }
  };

  const updateBook = async (id: string, updates: Partial<Book>) => {
    setBooks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b))
    );
    try {
      await cloudSetDoc(doc(db, 'books', id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore updateBook:', e);
    }
  };

  const deleteBook = async (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    try {
      await cloudDeleteDoc(doc(db, 'books', id));
    } catch (e) {
      console.warn('Firestore deleteBook:', e);
    }
  };

  // Add Journal Reflection
  const addJournal = async (entryData: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    const coupleId = requireRoom('jurnal mingguan');
    if (!coupleId) return;
    const id = `journal_${Date.now()}`;
    const entryObj: JournalEntry = {
      ...entryData,
      coupleId,
      authorId: myUid,
      isShared: entryData.isShared !== false,
      id,
      createdAt: new Date().toISOString(),
    };
    setJournals((prev) => [entryObj, ...prev]);
    try {
      await cloudSetDoc(doc(db, 'journals', id), entryObj);
    } catch (e) {
      console.warn('Firestore addJournal:', e);
    }
  };

  const updateJournal = async (id: string, updates: Partial<JournalEntry>) => {
    setJournals((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
    try {
      await cloudSetDoc(doc(db, 'journals', id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore updateJournal:', e);
    }
  };

  const deleteJournal = async (id: string) => {
    setJournals((prev) => prev.filter((j) => j.id !== id));
    try {
      await cloudDeleteDoc(doc(db, 'journals', id));
    } catch (e) {
      console.warn('Firestore deleteJournal:', e);
    }
  };

  // Grace Day toggle
  const toggleGraceDay = async () => {
    const nextVal = !couple.graceDayUsedThisWeek;
    setCouple((prev) => ({
      ...prev,
      graceDayUsedThisWeek: nextVal,
    }));
    await patchCoupleRoom({ graceDayUsedThisWeek: nextVal }, 'graceDay');
  };

  // Fast switch simulated user (for 1-click testing of couples UX on single screen)
  const switchSimulatedUser = () => {
    if (!isDemoMode) return;
    setCurrentUserId((prev) =>
      prev === SEED_USER_A.id ? SEED_USER_B.id : SEED_USER_A.id
    );
  };

  // Simulator Toolbar Toggle
  const toggleSimulatorToolbar = () => {
    setShowSimulatorToolbar((prev: boolean) => {
      const next = !prev;
      writeStorage('gt_show_simulator', String(next));
      return next;
    });
  };

  // Update user profile (name, colorTheme)
  const updateUserProfile = async (id: string, updates: Partial<UserProfile>) => {
    setUsersState((prev) => {
      const existing = prev[id] || {
        id,
        displayName: 'Pengguna',
        email: '',
        colorTheme: 'coral' as const,
        inviteCode: 'GROW-2026',
      };
      return { ...prev, [id]: { ...existing, ...updates } };
    });

    try {
      await cloudSetDoc(doc(db, 'users', id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore updateUserProfile:', e);
    }
  };

  // Update couple profile
  const updateCoupleProfile = async (updates: Partial<Couple>) => {
    setCouple((prev) => ({ ...prev, ...updates }));
    await patchCoupleRoom(updates, 'updateCoupleProfile');
  };

  // Reset to Empty State for brand new couples
  const resetToEmptyState = () => {
    setHabits([]);
    setLogs([]);
    setSessions([]);
    setBooks([]);
    setJournals([]);
    setAgreements([]);
    setCheckins([]);
    const freshCouple: Couple = {
      ...couple,
      levelXp: 0,
      levelNumber: 1,
      unlockedDecorations: [],
      selectedTimeOfDay: 'auto',
      selectedWeather: 'clear',
      jokerCardsUser1: 2,
      jokerCardsUser2: 2,
      allSanctionsPaused: false,
    };
    setCouple(freshCouple);
    writeStorage('gt_visited_v1', 'true');
    sound.playFocusChime();
  };

  // Restore Sample Demo Data
  const loadDemoData = () => {
    setHabits(SEED_HABITS);
    setBooks(SEED_BOOKS);
    setJournals(SEED_JOURNALS);
    setAgreements(SEED_AGREEMENTS);
    setCheckins(SEED_CHECKINS);
    setCouple(SEED_COUPLE);
    setUsersState({
      [SEED_USER_A.id]: SEED_USER_A,
      [SEED_USER_B.id]: SEED_USER_B,
    });
    setLogs([]);
    setSessions([]);
    writeStorage('gt_visited_v1', 'true');
    sound.playFocusChime();
  };

  const enterDemoMode = () => {
    cloudSyncEnabled = false;
    writeStorage('gt_demo_mode', 'true');
    setIsDemoMode(true);
    setIsAuthLoading(false);
    setCurrentUserId(SEED_USER_A.id);
    setReactions([]);
    setSelectedDate(getTodayDateString());
    loadDemoData();
    sound.playHighFive();
  };

  // Demo data lives only in this tab, so the reliable way back to the real
  // session is a fresh boot through the anonymous-sign-in path.
  const exitDemoMode = () => {
    writeStorage('gt_demo_mode', 'false');
    window.location.reload();
  };

  // Create a private room owned by the signed-in user
  const createCouple = async (displayName?: string): Promise<void> => {
    if (!authUser) throw new Error('Sesi perangkat belum siap. Muat ulang halaman.');

    const me = await ensureDisplayName(displayName);
    if (me.coupleId) return;

    // Another device may have paired this identity after the profile was cached.
    const freshSnap = await getDoc(doc(db, 'users', me.id)).catch(() => null);
    const freshCoupleId = (freshSnap?.data() as Partial<UserProfile> | undefined)?.coupleId;
    if (freshCoupleId) {
      setUsersState((prev) => ({
        ...prev,
        [me.id]: { ...me, coupleId: freshCoupleId },
      }));
      return;
    }

    const now = new Date().toISOString();
    const inviteCode = me.inviteCode || generateInviteCode();
    const coupleId = `couple_${authUser.uid.slice(0, 10)}_${randomSuffix()}`;
    const newCouple: Couple = {
      id: coupleId,
      user1Id: me.id,
      user2Id: '',
      // Stored on the room itself so either member can re-enter from a new device
      // even after their own profile document is gone.
      roomCode: inviteCode,
      user1Profile: { ...me, inviteCode },
      graceDayUsedThisWeek: false,
      weeklyReadingMinutesGoal: 300,
      weeklyStudyMinutesGoal: 200,
      levelXp: 0,
      levelNumber: 1,
      jokerCardsUser1: 2,
      jokerCardsUser2: 2,
      allSanctionsPaused: false,
      unlockedDecorations: [],
      selectedTimeOfDay: 'auto',
      selectedWeather: 'clear',
      createdAt: now,
      updatedAt: now,
    };

    await cloudSetDoc(doc(db, 'couples', coupleId), newCouple);
    await cloudSetDoc(
      doc(db, 'users', me.id),
      { coupleId, inviteCode },
      { merge: true }
    );
    await cloudSetDoc(
      doc(db, 'inviteCodes', inviteCode),
      {
        userId: me.id,
        coupleId,
        ownerName: me.displayName,
        photoURL: me.photoURL ?? null,
        colorTheme: me.colorTheme,
        updatedAt: now,
      },
      { merge: true }
    );

    setCouple(newCouple);
    setUsersState((prev) => ({
      ...prev,
      [me.id]: { ...me, coupleId, inviteCode },
    }));
    clearLocalCollections();
    sound.playHighFive();
  };

  // Join the partner's room using their invite code
  const joinCouple = async (rawCode: string, displayName?: string): Promise<boolean> => {
    if (!authUser) return false;
    const me = await ensureDisplayName(displayName);
    const code = rawCode.trim().toUpperCase();
    if (!code || code === (me.inviteCode || '').toUpperCase()) return false;

    const inviteSnap = await getDoc(doc(db, 'inviteCodes', code));
    if (!inviteSnap.exists()) {
      emitSyncEvent({
        at: Date.now(),
        kind: 'listen',
        target: 'gabung ruang',
        ok: false,
        message: `kode ${code} tidak dikenali di server`,
      });
      return false;
    }

    const invite = inviteSnap.data() as {
      userId?: string;
      coupleId?: string;
      ownerName?: string;
      photoURL?: string | null;
      colorTheme?: UserProfile['colorTheme'];
    };
    const partnerId = invite.userId;
    const targetCoupleId = invite.coupleId;
    if (!partnerId || !targetCoupleId || partnerId === me.id) return false;

    // Trust the stored profile over local state: it may be stale on a new device.
    const mySnap = await getDoc(doc(db, 'users', me.id)).catch(() => null);
    const myFresh = (mySnap?.data() as Partial<UserProfile> | undefined) ?? {};
    const previousCoupleId =
      myFresh.coupleId && myFresh.coupleId !== targetCoupleId ? myFresh.coupleId : null;
    if (previousCoupleId) {
      const prevSnap = await getDoc(doc(db, 'couples', previousCoupleId)).catch(() => null);
      const prev = prevSnap?.data() as Partial<Couple> | undefined;
      // Already in a room with someone else: refuse to silently abandon it.
      if (prev?.user2Id && prev.user2Id !== me.id) return false;
    }

    const partner: UserProfile = usersState[partnerId] ?? {
      id: partnerId,
      displayName: invite.ownerName || 'Pasangan',
      email: '',
      photoURL: invite.photoURL || undefined,
      colorTheme: invite.colorTheme || 'teal',
      inviteCode: code,
      coupleId: targetCoupleId,
    };

    const coupleRef = doc(db, 'couples', targetCoupleId);
    const coupleSnap = await getDoc(coupleRef);
    if (!coupleSnap.exists()) return false;

    const existing = normalizeCouple(coupleSnap.id, coupleSnap.data() as Partial<Couple>);
    if (existing.user2Id && existing.user2Id !== me.id) {
      // Two seats are already taken. Entering is only possible after a slot is
      // freed, and the reason has to reach the user instead of a blank failure.
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: 'gabung ruang',
        ok: false,
        message: 'ruang ini sudah berisi dua orang; minta pasangan keluar dari ruang dulu bila kamu pindah HP',
      });
      return false;
    }

    const now = new Date().toISOString();
    const roomCode = existing.roomCode || code;
    const joinedCouple: Couple = {
      ...existing,
      roomCode,
      user2Id: me.id,
      user2Profile: me,
      updatedAt: now,
    };

    await cloudSetDoc(
      coupleRef,
      { user2Id: me.id, user2Profile: me, roomCode, updatedAt: now },
      { merge: true }
    );
    await cloudSetDoc(
      doc(db, 'users', me.id),
      { coupleId: targetCoupleId },
      { merge: true }
    );

    if (previousCoupleId) {
      // The old room had no partner, so it would otherwise stay orphaned forever.
      const prevRef = doc(db, 'couples', previousCoupleId);
      const prevSnap = await getDoc(prevRef).catch(() => null);
      if (prevSnap?.exists() && !(prevSnap.data() as Partial<Couple>).user2Id) {
        await firestoreDeleteDoc(prevRef).catch((e) =>
          console.warn('Firestore cleanup old solo couple:', e)
        );
      }
    }

    setCouple(joinedCouple);
    setUsersState((prev) => ({
      ...prev,
      [me.id]: { ...me, coupleId: targetCoupleId },
      [partner.id]: { ...partner, coupleId: targetCoupleId },
    }));
    clearLocalCollections();
    sound.playHighFive();
    return true;
  };

  // Kept for the older UI entry points (settings, onboarding, couple tab)
  const pairWithCode = async (code: string): Promise<boolean> => joinCouple(code);

  // Create Agreement
  const createAgreement = async (agreementData: Omit<Agreement, 'id' | 'createdAt' | 'updatedAt'>) => {
    const coupleId = requireRoom('kesepakatan');
    if (!coupleId) return;
    const id = `agr_${Date.now()}`;
    // Without a partner there is nobody to approve; keep the pact usable immediately.
    const hasPartner = !!partnerUid;
    const agreementObj: Agreement = {
      ...agreementData,
      coupleId,
      creatorId: myUid,
      id,
      status: hasPartner ? 'pending_approval' : 'active',
      partnerApproved: !hasPartner,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setAgreements((prev) => [agreementObj, ...prev]);
    try {
      await cloudSetDoc(doc(db, 'agreements', id), agreementObj);
    } catch (e) {
      console.warn('Firestore createAgreement:', e);
    }
  };

  // Approve Agreement
  const approveAgreement = async (id: string) => {
    setAgreements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'active', partnerApproved: true } : a))
    );
    try {
      await cloudSetDoc(doc(db, 'agreements', id), { status: 'active', partnerApproved: true }, { merge: true });
    } catch (e) {
      console.warn('Firestore approveAgreement:', e);
    }
  };

  // Reject Agreement
  const rejectAgreement = async (id: string) => {
    setAgreements((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'rejected' } : a))
    );
    try {
      await cloudSetDoc(doc(db, 'agreements', id), { status: 'rejected' }, { merge: true });
    } catch (e) {
      console.warn('Firestore rejectAgreement:', e);
    }
  };

  // Manually mark a pact as triggered (used by the "simulate" action and by
  // automatic checks). Rewards can be triggered manually as a celebration too.
  const triggerAgreement = async (id: string) => {
    const target = agreements.find((a) => a.id === id);
    if (!target) return;
    const updates = {
      status: 'triggered' as const,
      timesTriggered: (target.timesTriggered || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    setAgreements((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a)));
    try {
      await cloudSetDoc(doc(db, 'agreements', id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore triggerAgreement:', e);
    }
  };

  const deleteAgreement = async (id: string) => {
    setAgreements((prev) => prev.filter((a) => a.id !== id));
    try {
      await cloudDeleteDoc(doc(db, 'agreements', id));
    } catch (e) {
      console.warn('Firestore deleteAgreement:', e);
    }
  };

  // Resolve Sanction. Completion is final, while relief/swap requests wait for
  // the partner's decision instead of applying themselves unilaterally.
  const resolveSanction = async (
    id: string,
    resolution: 'completed' | 'relief_requested' | 'swapped',
    note?: string
  ) => {
    const target = agreements.find((a) => a.id === id);
    if (!target) return;

    if (resolution === 'completed') {
      setAgreements((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: 'completed', timesCompleted: (a.timesCompleted || 0) + 1 }
            : a
        )
      );
      try {
        await cloudSetDoc(
          doc(db, 'agreements', id),
          {
            status: 'completed',
            timesCompleted: (target.timesCompleted || 0) + 1,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Firestore resolveSanction:', e);
      }
      return;
    }

    const pendingAction = resolution === 'relief_requested' ? 'relief' : 'swap';
    setAgreements((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: 'triggered',
              pendingAction,
              pendingActionBy: currentUser.id,
              pendingNote: note,
              proposedRevision: note,
            }
          : a
      )
    );
    try {
      await cloudSetDoc(
        doc(db, 'agreements', id),
        {
          status: 'triggered',
          pendingAction,
          pendingActionBy: currentUser.id,
          pendingNote: note ?? null,
          proposedRevision: note ?? null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore resolveSanction:', e);
    }
  };

  // Partner decision on a relief/swap request.
  const respondToPendingAction = async (id: string, approve: boolean) => {
    const target = agreements.find((a) => a.id === id);
    if (!target?.pendingAction) return;

    const approveRelief = approve && target.pendingAction === 'relief';
    const approveSwap = approve && target.pendingAction === 'swap';
    const nextStatus: Agreement['status'] = approveRelief
      ? 'pardoned'
      : approveSwap
      ? 'active'
      : 'triggered';
    const updates: Partial<Agreement> = {
      status: nextStatus,
      ...(approveSwap && target.pendingNote ? { title: target.pendingNote } : {}),
      ...(approveRelief ? { timesPardoned: (target.timesPardoned || 0) + 1 } : {}),
      updatedAt: new Date().toISOString(),
    };

    setAgreements((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, ...updates, pendingAction: undefined, pendingActionBy: undefined, pendingNote: undefined }
          : a
      )
    );

    try {
      await cloudSetDoc(
        doc(db, 'agreements', id),
        {
          ...updates,
          pendingAction: deleteField(),
          pendingActionBy: deleteField(),
          pendingNote: deleteField(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore respondToPendingAction:', e);
    }
  };

  // Use Joker Card
  const useJokerCard = async (agreementId: string): Promise<boolean> => {
    const isUser1 = myUid === couple.user1Id;
    const currentJokers = isUser1 ? couple.jokerCardsUser1 : couple.jokerCardsUser2;
    if (currentJokers <= 0) return false;

    const nextJokers = currentJokers - 1;
    const coupleUpdates = isUser1 ? { jokerCardsUser1: nextJokers } : { jokerCardsUser2: nextJokers };

    setCouple((prev) => ({ ...prev, ...coupleUpdates }));
    setAgreements((prev) =>
      prev.map((a) =>
        a.id === agreementId
          ? { ...a, status: 'pardoned', timesPardoned: (a.timesPardoned || 0) + 1 }
          : a
      )
    );

    await patchCoupleRoom(coupleUpdates, 'useJokerCard');
    try {
      await cloudSetDoc(doc(db, 'agreements', agreementId), { status: 'pardoned' }, { merge: true });
    } catch (e) {
      console.warn('Firestore useJokerCard:', e);
    }
    return true;
  };

  // Record Nightly Check-in. One entry per user per day: editing it again must
  // overwrite the same document and must not farm the +25 XP repeatedly.
  const recordCheckIn = async (checkInData: Omit<CheckIn, 'id' | 'createdAt'>) => {
    const coupleId = requireRoom('check-in malam');
    if (!coupleId) return;
    const userId = checkInData.userId === currentUser.id ? myUid : '';
    if (!userId) {
      // The rules only accept a check-in owned by the signed-in uid, so writing
      // one for the partner would fail silently instead of recording it.
      emitSyncEvent({
        at: Date.now(),
        kind: 'write',
        target: 'check-in malam',
        ok: false,
        message: 'check-in hanya bisa dicatat untuk akun di perangkat ini',
      });
      return;
    }
    const existing = checkins.find((c) => c.userId === userId && c.date === checkInData.date);
    const id = existing?.id ?? `chk_${userId}_${checkInData.date}`;
    const newCheckIn: CheckIn = {
      ...checkInData,
      coupleId,
      userId,
      // An untagged check-in would be invisible to the partner's shared query.
      isShared: checkInData.isShared !== false,
      id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    setCheckins((prev) => [
      newCheckIn,
      ...prev.filter((c) => !(c.userId === newCheckIn.userId && c.date === newCheckIn.date)),
    ]);
    if (!existing) {
      await addCoupleXP(25);
    }
    sound.playHabitComplete();
    try {
      await cloudSetDoc(doc(db, 'checkins', id), newCheckIn);
    } catch (e) {
      console.warn('Firestore recordCheckIn:', e);
    }
  };

  // Unlock Island Decoration with XP. The read-check-write runs in a transaction
  // so two devices cannot spend the same XP twice.
  const unlockDecoration = async (decorationId: IslandDecorationId): Promise<boolean> => {
    const targetDec = ISLAND_DECORATIONS.find((d) => d.id === decorationId);
    if (!targetDec) return false;
    const current = coupleRef.current;
    const roomId = cloudIdentity.coupleId;
    if (!roomId) return false;
    if (current.unlockedDecorations.includes(decorationId)) return true;

    const applyLocal = (xp: number, decorations: IslandDecorationId[]) => {
      const nextCouple = { ...coupleRef.current, levelXp: xp, unlockedDecorations: decorations };
      coupleRef.current = nextCouple;
      setCouple(nextCouple);
      sound.playHabitComplete();
      fireConfetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    };

    if (!cloudSyncEnabled) {
      if (current.levelXp < targetDec.xpCost) return false;
      applyLocal(current.levelXp - targetDec.xpCost, [...current.unlockedDecorations, decorationId]);
      return true;
    }

    try {
      const result = await runTransaction(db, async (tx) => {
        const ref = doc(db, 'couples', roomId);
        const snap = await tx.get(ref);
        if (!snap.exists()) return { ok: false as const };
        const data = snap.data() as Partial<Couple>;
        const xp = data.levelXp ?? 0;
        const unlocked = data.unlockedDecorations ?? [];
        if (unlocked.includes(decorationId)) {
          return { ok: true as const, xp, unlocked, already: true };
        }
        if (xp < targetDec.xpCost) return { ok: false as const };
        const nextXp = xp - targetDec.xpCost;
        const nextUnlocked = [...unlocked, decorationId];
        tx.update(ref, { levelXp: nextXp, unlockedDecorations: nextUnlocked });
        return { ok: true as const, xp: nextXp, unlocked: nextUnlocked, already: false };
      });
      if (!result.ok) return false;
      if (!result.already) applyLocal(result.xp, result.unlocked);
      return true;
    } catch (e) {
      console.warn('Firestore unlockDecoration:', e);
      // Transactions need a connection; queue a normal write when offline.
      if (isOnline || current.levelXp < targetDec.xpCost) return false;
      const nextDecorations = [...current.unlockedDecorations, decorationId];
      const nextXp = current.levelXp - targetDec.xpCost;
      applyLocal(nextXp, nextDecorations);
      await cloudSetDoc(
        doc(db, 'couples', roomId),
        { levelXp: nextXp, unlockedDecorations: nextDecorations },
        { merge: true }
      ).catch(() => undefined);
      return true;
    }
  };

  // Time of day and weather overrides
  const setTimeOfDay = async (time: TimeOfDay) => {
    setCouple((prev) => ({ ...prev, selectedTimeOfDay: time }));
    await patchCoupleRoom({ selectedTimeOfDay: time }, 'selectedTimeOfDay');
  };

  const setWeather = async (weather: WeatherType) => {
    setCouple((prev) => ({ ...prev, selectedWeather: weather }));
    await patchCoupleRoom({ selectedWeather: weather }, 'selectedWeather');
  };

  // Add couple XP. Levels only move forward; spending XP never demotes.
  // increment() is atomic, so both partners' awards accumulate instead of
  // overwriting each other's last known balance.
  const addCoupleXP = async (amount: number) => {
    const base = coupleRef.current;
    const roomId = cloudIdentity.coupleId;
    if (!roomId) return;
    const optimisticXp = Math.max(0, (base.levelXp || 0) + amount);
    const nextCouple = {
      ...base,
      levelXp: optimisticXp,
      levelNumber: Math.max(
        base.levelNumber || 1,
        Math.floor(optimisticXp / XP_PER_LEVEL) + 1
      ),
    };
    coupleRef.current = nextCouple;
    setCouple(nextCouple);
    if (!cloudSyncEnabled) return;
    try {
      await cloudSetDoc(
        doc(db, 'couples', roomId),
        { levelXp: increment(amount) },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore addCoupleXP:', e);
    }
  };

  const triggerSimulatedHighFive = () => {
    setHighFiveCelebrated(true);
    sound.playHabitComplete();
    fireConfetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#FF7A64', '#4E8B73', '#FFD166', '#8B5CF6'],
    });
  };

  const advanceSimulatedDay = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    setSelectedDate(toLocalDateString(new Date(year, month - 1, day + 1)));
    sound.playFocusChime();
  };

  const togglePauseAllSanctions = async () => {
    const nextVal = !couple.allSanctionsPaused;
    setCouple((prev) => ({ ...prev, allSanctionsPaused: nextVal }));
    await patchCoupleRoom({ allSanctionsPaused: nextVal }, 'allSanctionsPaused');
  };

  const dismissNotification = () => setActiveNotification(null);
  const dismissHighFive = () => setHighFiveCelebrated(false);

  const value: AppContextType = {
    combinedStreak,
    authUser,
    isAuthLoading,
    isProfileLoading,
    isDemoMode,
    authError,
    retryAuth,
    setDisplayName,
    enterDemoMode,
    exitDemoMode,
    switchAccount,
    deleteAccount,
    leaveCouple,
    setupUserProfile,
    currentUser,
    partnerUser,
    couple,
    habits,
    logs,
    sessions,
    books,
    journals,
    reactions,
    checkins,
    checkIns: checkins,
    agreements,
    allSanctionsPaused: couple.allSanctionsPaused || false,
    activeNotification,
    dismissNotification,
    notifications,
    syncEvents,
    syncAlert,
    dismissSyncAlert,
    lastSentReaction,
    partnerUid,
    roomCode,
    cloudIdentity,
    runSyncTest,
    rebuildLocalCache,
    highFiveCelebrated,
    dismissHighFive,
    selectedDate,
    setSelectedDate,
    isOnline,
    isDarkMode,
    toggleDarkMode,
    showSimulatorToolbar,
    toggleSimulatorToolbar,
    isOnboardingOpen,
    setIsOnboardingOpen,
    updateUserProfile,
    updateCoupleProfile,
    resetToEmptyState,
    loadDemoData,
    createCouple,
    joinCouple,
    toggleHabit,
    addHabit,
    editHabit,
    deleteHabit,
    recordFocusSession,
    sendReaction,
    addBook,
    updateBook,
    deleteBook,
    addJournal,
    updateJournal,
    deleteJournal,
    toggleGraceDay,
    switchSimulatedUser,
    pairWithCode,
    recordCheckIn,
    unlockDecoration,
    setTimeOfDay,
    setWeather,
    addCoupleXP,
    triggerSimulatedHighFive,
    advanceSimulatedDay,
    createAgreement,
    approveAgreement,
    rejectAgreement,
    triggerAgreement,
    deleteAgreement,
    respondToPendingAction,
    resolveSanction,
    useJokerCard,
    togglePauseAllSanctions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
