import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { onAuthStateChanged, User } from 'firebase/auth';
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
import { db, auth, loginWithGoogle, logoutUser as firebaseLogoutUser } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc as firestoreSetDoc,
  deleteDoc as firestoreDeleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  deleteField,
} from 'firebase/firestore';

interface AppContextType {
  // Auth
  authUser: User | null;
  isAuthLoading: boolean;
  isDemoMode: boolean;
  loginWithGoogle: () => Promise<User | undefined>;
  enterDemoMode: () => void;
  logoutUser: () => Promise<void>;
  
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  couple: Couple;
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
  createCouple: () => Promise<void>;
  joinCouple: (inviteCode: string) => Promise<boolean>;

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

// Demo mode keeps everything local; cloud writes are skipped instead of being
// rejected by security rules.
let cloudSyncEnabled = false;

type FirestoreDocRef = ReturnType<typeof doc>;

async function cloudSetDoc(
  reference: FirestoreDocRef,
  data: object,
  options?: { merge?: boolean }
) {
  if (!cloudSyncEnabled) return;
  if (options) {
    await firestoreSetDoc(reference, data, options);
  } else {
    await firestoreSetDoc(reference, data);
  }
}

async function cloudDeleteDoc(reference: FirestoreDocRef) {
  if (!cloudSyncEnabled) return;
  await firestoreDeleteDoc(reference);
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
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(6);
    crypto.getRandomValues(values);
    for (const value of values) code += alphabet[value % alphabet.length];
  } else {
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return code;
}

function normalizeCouple(id: string, data: Partial<Couple>): Couple {
  return {
    ...SEED_COUPLE,
    ...data,
    id,
    user1Id: data.user1Id ?? '',
    user2Id: data.user2Id ?? '',
    unlockedDecorations: data.unlockedDecorations ?? [],
    combinedStreak: data.combinedStreak ?? 0,
    weeklyReadingMinutesGoal: data.weeklyReadingMinutesGoal ?? 300,
    weeklyStudyMinutesGoal: data.weeklyStudyMinutesGoal ?? 200,
    levelXp: data.levelXp ?? 0,
    levelNumber: data.levelNumber ?? 1,
    jokerCardsUser1: data.jokerCardsUser1 ?? 2,
    jokerCardsUser2: data.jokerCardsUser2 ?? 2,
    allSanctionsPaused: data.allSanctionsPaused ?? false,
    graceDayUsedThisWeek: data.graceDayUsedThisWeek ?? false,
    selectedTimeOfDay: data.selectedTimeOfDay ?? 'auto',
    selectedWeather: data.selectedWeather ?? 'clear',
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [saved] = useState<Partial<PersistedState>>(loadPersistedState);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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
  const [highFiveCelebrated, setHighFiveCelebrated] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
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
          displayName: authUser.displayName || authUser.email?.split('@')[0] || 'Pengguna',
          email: authUser.email || '',
          photoURL: authUser.photoURL || undefined,
          colorTheme: 'coral',
          inviteCode: '',
          createdAt: new Date().toISOString(),
        }
      : SEED_USER_A
  );

  const partnerId =
    couple.user1Id === currentUser.id
      ? couple.user2Id
      : couple.user1Id === currentUserId
        ? couple.user2Id
        : couple.user1Id;
  const partnerUser: UserProfile | null =
    partnerId && partnerId !== currentUser.id ? usersState[partnerId] ?? null : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        cloudSyncEnabled = true;
        setIsDemoMode(false);
        writeStorage('gt_demo_mode', 'false');
        setCurrentUserId(user.uid);
        await setupUserProfile(user);
      } else {
        cloudSyncEnabled = false;
        setCurrentUserId('user_rama_01');
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    cloudSyncEnabled = !!authUser && !isDemoMode;
  }, [authUser, isDemoMode]);

  const logoutUser = async () => {
    try {
      await firebaseLogoutUser();
    } finally {
      cloudSyncEnabled = false;
      setIsDemoMode(false);
      writeStorage('gt_demo_mode', 'false');
    }
  };

  const setupUserProfile = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const newUser: UserProfile = {
          id: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'Pengguna',
          email: user.email || '',
          photoURL: user.photoURL || undefined,
          colorTheme: 'coral',
          inviteCode: generateInviteCode(),
          createdAt: new Date().toISOString(),
        };
        await cloudSetDoc(userRef, newUser);
        setUsersState(prev => ({ ...prev, [user.uid]: newUser }));
      } else {
        const userData = userSnap.data() as UserProfile;
        const repaired = {
          ...userData,
          id: user.uid,
          inviteCode: userData.inviteCode || generateInviteCode(),
        };
        if (!userData.inviteCode) {
          await cloudSetDoc(userRef, { inviteCode: repaired.inviteCode }, { merge: true });
        }
        setUsersState(prev => ({ ...prev, [user.uid]: repaired }));
      }
    } catch (error) {
      console.warn('Error setting up user profile:', error);
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
        }
      },
      (err) => {
        console.warn('Firestore couple snapshot:', err.message);
      }
    );
    return () => unsubscribe();
  }, [authUser, currentUser.coupleId]);

  // Refresh both partner profiles whenever the couple members change
  useEffect(() => {
    if (!authUser || !currentUser.coupleId) return;
    const ids = [couple.user1Id, couple.user2Id].filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );
    if (ids.length === 0) return;

    let cancelled = false;
    Promise.all(
      ids.map((id) => getDoc(doc(db, 'users', id)).catch(() => null))
    ).then((snapshots) => {
      if (cancelled) return;
      const profiles: { [id: string]: UserProfile } = {};
      snapshots.forEach((snap) => {
        if (snap?.exists()) profiles[snap.id] = snap.data() as UserProfile;
      });
      if (Object.keys(profiles).length > 0) {
        setUsersState((prev) => ({ ...prev, ...profiles }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authUser, currentUser.coupleId, couple.user1Id, couple.user2Id]);

  // Live couple data: every screen reads from the same real-time collections.
  useEffect(() => {
    const coupleId = currentUser.coupleId;
    if (!authUser || !coupleId) return;

    reactionsPrimed.current = false;
    const byCouple = (name: string) =>
      query(collection(db, name), where('coupleId', '==', coupleId));
    const report = (name: string) => (err: Error) =>
      console.warn(`Firestore ${name} snapshot:`, err.message);

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

    const habitsOwnUnsub = onSnapshot(
      query(collection(db, 'habits'), where('ownerId', '==', currentUserId)),
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
      query(collection(db, 'logs'), where('userId', '==', currentUserId)),
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
      query(collection(db, 'sessions'), where('userId', '==', currentUserId)),
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
      },
      report('journals')
    );

    const journalsOwnUnsub = onSnapshot(
      query(collection(db, 'journals'), where('authorId', '==', currentUserId)),
      (snapshot) => {
        ownJournals = snapshot.docs.map((d) => ({
          ...(d.data() as JournalEntry),
          id: d.id,
        }));
        publishJournals();
      },
      report('journals')
    );

    const reactionsUnsub = onSnapshot(
      byCouple('reactions'),
      (snapshot) => {
        const fetched: Reaction[] = snapshot.docs.map((d) => ({ ...(d.data() as Reaction), id: d.id }));
        fetched.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        const latestToMe = fetched.find((r) => r.receiverId === currentUserId);
        if (!reactionsPrimed.current) {
          // The first snapshot is history, not news.
          reactionsPrimed.current = true;
          lastNotifiedReactionId.current = latestToMe?.id ?? null;
        } else if (latestToMe && latestToMe.id !== lastNotifiedReactionId.current) {
          lastNotifiedReactionId.current = latestToMe.id;
          setActiveNotification(latestToMe);
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
      },
      report('checkins')
    );

    const checkinsOwnUnsub = onSnapshot(
      query(collection(db, 'checkins'), where('userId', '==', currentUserId)),
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
  }, [authUser, currentUser.coupleId, currentUserId]);

  // Toggle a habit for a given day (defaults to the selected date)
  const toggleHabit = async (habitId: string, targetDate?: string) => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    const date = targetDate ?? selectedDate;
    const logId = `${habitId}_${date}_${currentUser.id}`;
    const existing = logs.find((l) => l.id === logId);
    const newCompleted = !existing?.completed;
    const updatedLog: HabitLog = {
      id: logId,
      habitId,
      userId: currentUser.id,
      coupleId: habit.coupleId || couple.id,
      date,
      completed: newCompleted,
      durationMinutes: existing?.durationMinutes ?? habit.targetMinutes ?? 0,
      completedAt: newCompleted ? new Date().toISOString() : undefined,
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
    const id = `habit_${Date.now()}`;
    const habitObj: Habit = {
      ...newHabit,
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
    const sessionId = `session_${Date.now()}`;
    const sessionHabit = sessionData.habitId
      ? habits.find((h) => h.id === sessionData.habitId)
      : undefined;
    const sessionObj: FocusSession = {
      ...sessionData,
      coupleId: sessionData.coupleId || couple.id,
      userId: sessionData.userId || currentUser.id,
      id: sessionId,
      timestamp: new Date().toISOString(),
      visibility: sessionHabit?.isPrivate ? 'private' : 'couple',
    };
    setSessions((prev) => [sessionObj, ...prev]);

    // Auto-complete the matching habit once its target minutes are reached
    if (sessionData.habitId) {
      const habit = habits.find((h) => h.id === sessionData.habitId);
      const minutes = Math.round(sessionData.durationSeconds / 60);
      const logId = `${sessionData.habitId}_${selectedDate}_${currentUser.id}`;
      const previous = logs.find((l) => l.id === logId);
      const totalMinutes = (previous?.durationMinutes || 0) + minutes;
      const reachedTarget =
        !habit || habit.targetMinutes <= 0 || totalMinutes >= habit.targetMinutes;
      const logObj: HabitLog = {
        id: logId,
        habitId: sessionData.habitId,
        userId: currentUser.id,
        coupleId: habit?.coupleId || couple.id,
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
    if (!partnerUser) return;
    if (!currentUser.coupleId) return;

    const reactionId = `react_${Date.now()}`;
    const reactionObj: Reaction = {
      id: reactionId,
      coupleId: currentUser.coupleId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      receiverId: partnerUser.id,
      emoji,
      habitTitle,
      message: message || `Menyemangati kamu dengan ${emoji}!`,
      createdAt: new Date().toISOString(),
    };

    setReactions((prev) => [reactionObj, ...prev]);
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

  // Add Book
  const addBook = async (bookData: Omit<Book, 'id' | 'updatedAt'>) => {
    const id = `book_${Date.now()}`;
    const bookObj: Book = {
      ...bookData,
      id,
      addedById: currentUser.id,
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
    const id = `journal_${Date.now()}`;
    const entryObj: JournalEntry = {
      ...entryData,
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
    try {
      await cloudSetDoc(doc(db, 'couples', couple.id), { graceDayUsedThisWeek: nextVal }, { merge: true });
    } catch (e) {
      console.warn('Firestore graceDay:', e);
    }
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

    try {
      await cloudSetDoc(doc(db, 'couples', couple.id), updates, { merge: true });
    } catch (e) {
      console.warn('Firestore updateCoupleProfile:', e);
    }
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
      combinedStreak: 0,
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

  // Create a private room owned by the signed-in user
  const createCouple = async (): Promise<void> => {
    if (!authUser) throw new Error('Silakan masuk terlebih dahulu.');
    if (currentUser.coupleId) return;

    const now = new Date().toISOString();
    const inviteCode = currentUser.inviteCode || generateInviteCode();
    const coupleId = `couple_${authUser.uid.slice(0, 10)}_${Date.now()}`;
    const newCouple: Couple = {
      id: coupleId,
      user1Id: currentUser.id,
      user2Id: '',
      user1Profile: { ...currentUser, inviteCode },
      combinedStreak: 0,
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
      doc(db, 'users', currentUser.id),
      { coupleId, inviteCode },
      { merge: true }
    );
    await cloudSetDoc(
      doc(db, 'inviteCodes', inviteCode),
      {
        userId: currentUser.id,
        coupleId,
        ownerName: currentUser.displayName,
        photoURL: currentUser.photoURL ?? null,
        colorTheme: currentUser.colorTheme,
        updatedAt: now,
      },
      { merge: true }
    );

    setCouple(newCouple);
    setUsersState((prev) => ({
      ...prev,
      [currentUser.id]: { ...currentUser, coupleId, inviteCode },
    }));
    clearLocalCollections();
    sound.playHighFive();
  };

  // Join the partner's room using their invite code
  const joinCouple = async (rawCode: string): Promise<boolean> => {
    if (!authUser) return false;
    const code = rawCode.trim().toUpperCase();
    if (!code || code === currentUser.inviteCode.toUpperCase()) return false;

    if (currentUser.coupleId) {
      const currentRoom = couple.id === currentUser.coupleId ? couple : null;
      if (currentRoom && currentRoom.user2Id && currentRoom.user2Id !== currentUser.id) {
        return false;
      }
    }

    const inviteSnap = await getDoc(doc(db, 'inviteCodes', code));
    if (!inviteSnap.exists()) return false;

    const invite = inviteSnap.data() as {
      userId?: string;
      coupleId?: string;
      ownerName?: string;
      photoURL?: string | null;
      colorTheme?: UserProfile['colorTheme'];
    };
    const partnerId = invite.userId;
    const targetCoupleId = invite.coupleId;
    if (!partnerId || !targetCoupleId || partnerId === currentUser.id) return false;

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
    if (existing.user2Id && existing.user2Id !== currentUser.id) return false;

    const now = new Date().toISOString();
    const joinedCouple: Couple = {
      ...existing,
      user2Id: currentUser.id,
      user2Profile: currentUser,
      updatedAt: now,
    };

    await cloudSetDoc(
      coupleRef,
      { user2Id: currentUser.id, user2Profile: currentUser, updatedAt: now },
      { merge: true }
    );
    await cloudSetDoc(
      doc(db, 'users', currentUser.id),
      { coupleId: targetCoupleId },
      { merge: true }
    );

    setCouple(joinedCouple);
    setUsersState((prev) => ({
      ...prev,
      [currentUser.id]: { ...currentUser, coupleId: targetCoupleId },
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
    const id = `agr_${Date.now()}`;
    // Without a partner there is nobody to approve; keep the pact usable immediately.
    const hasPartner = !!couple.user2Id;
    const agreementObj: Agreement = {
      ...agreementData,
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
    const isUser1 = currentUser.id === couple.user1Id;
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

    try {
      await cloudSetDoc(doc(db, 'couples', couple.id), coupleUpdates, { merge: true });
      await cloudSetDoc(doc(db, 'agreements', agreementId), { status: 'pardoned' }, { merge: true });
    } catch (e) {
      console.warn('Firestore useJokerCard:', e);
    }
    return true;
  };

  // Record Nightly Check-in. One entry per user per day: editing it again must
  // overwrite the same document and must not farm the +25 XP repeatedly.
  const recordCheckIn = async (checkInData: Omit<CheckIn, 'id' | 'createdAt'>) => {
    const existing = checkins.find(
      (c) => c.userId === checkInData.userId && c.date === checkInData.date
    );
    const id = existing?.id ?? `chk_${checkInData.userId}_${checkInData.date}`;
    const newCheckIn: CheckIn = {
      ...checkInData,
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

  // Unlock Island Decoration with XP
  const unlockDecoration = async (decorationId: IslandDecorationId): Promise<boolean> => {
    const targetDec = ISLAND_DECORATIONS.find((d) => d.id === decorationId);
    if (!targetDec) return false;
    const current = coupleRef.current;
    if (current.levelXp < targetDec.xpCost) return false;
    if (current.unlockedDecorations.includes(decorationId)) return true;

    const nextDecorations = [...current.unlockedDecorations, decorationId];
    const nextXp = current.levelXp - targetDec.xpCost;
    const nextCouple = { ...current, levelXp: nextXp, unlockedDecorations: nextDecorations };
    coupleRef.current = nextCouple;
    setCouple(nextCouple);
    sound.playHabitComplete();
    fireConfetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    try {
      await cloudSetDoc(
        doc(db, 'couples', couple.id),
        { levelXp: nextXp, unlockedDecorations: nextDecorations },
        { merge: true }
      );
    } catch (e) {
      console.warn('Firestore unlockDecoration:', e);
    }
    return true;
  };

  // Time of day and weather overrides
  const setTimeOfDay = async (time: TimeOfDay) => {
    setCouple((prev) => ({ ...prev, selectedTimeOfDay: time }));
    try {
      await cloudSetDoc(doc(db, 'couples', couple.id), { selectedTimeOfDay: time }, { merge: true });
    } catch (e) {
      console.warn('Firestore setTimeOfDay:', e);
    }
  };

  const setWeather = async (weather: WeatherType) => {
    setCouple((prev) => ({ ...prev, selectedWeather: weather }));
    try {
      await cloudSetDoc(doc(db, 'couples', couple.id), { selectedWeather: weather }, { merge: true });
    } catch (e) {
      console.warn('Firestore setWeather:', e);
    }
  };

  // Add couple XP. Levels only move forward; spending XP never demotes.
  // coupleRef keeps back-to-back awards (habit + check-in) from overwriting each other.
  const addCoupleXP = async (amount: number) => {
    const base = coupleRef.current;
    const nextXp = Math.max(0, (base.levelXp || 0) + amount);
    const nextLevel = Math.max(base.levelNumber || 1, Math.floor(nextXp / XP_PER_LEVEL) + 1);
    const nextCouple = { ...base, levelXp: nextXp, levelNumber: nextLevel };
    coupleRef.current = nextCouple;
    setCouple(nextCouple);
    try {
      await cloudSetDoc(
        doc(db, 'couples', base.id),
        { levelXp: nextXp, levelNumber: nextLevel },
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
    try {
      await cloudSetDoc(doc(db, 'couples', couple.id), { allSanctionsPaused: nextVal }, { merge: true });
    } catch (e) {
      console.warn('Firestore togglePauseAllSanctions:', e);
    }
  };

  const dismissNotification = () => setActiveNotification(null);
  const dismissHighFive = () => setHighFiveCelebrated(false);

  const value: AppContextType = {
    authUser,
    isAuthLoading,
    isDemoMode,
    loginWithGoogle,
    enterDemoMode,
    logoutUser,
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
