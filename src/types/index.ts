export type ColorTheme = 'coral' | 'teal' | 'amber' | 'indigo';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  colorTheme: ColorTheme;
  coupleId?: string;
  inviteCode: string;
  createdAt?: string;
}

export type TimeOfDay = 'auto' | 'dawn' | 'day' | 'sunset' | 'night';
export type WeatherType = 'clear' | 'rain' | 'rainbow';
export type IslandDecorationId = 'swing' | 'pond' | 'cottage' | 'lanterns' | 'cat';

export interface Couple {
  id: string;
  user1Id: string;
  user2Id?: string;
  /** The room's own code: with no accounts, it is how either partner returns. */
  roomCode?: string;
  user1Profile?: UserProfile;
  user2Profile?: UserProfile;
  combinedStreak: number;
  graceDayUsedThisWeek: boolean;
  weeklyReadingMinutesGoal: number;
  weeklyStudyMinutesGoal: number;
  levelXp: number;
  levelNumber: number;
  jokerCardsUser1: number;
  jokerCardsUser2: number;
  allSanctionsPaused: boolean;
  unlockedDecorations: IslandDecorationId[];
  selectedTimeOfDay: TimeOfDay;
  selectedWeather: WeatherType;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckIn {
  id: string;
  coupleId: string;
  userId: string;
  userName?: string;
  date: string; // YYYY-MM-DD
  mood: number; // 1 to 5
  gratitude: string;
  isShared: boolean;
  createdAt: string;
}

export interface IslandDecoration {
  id: IslandDecorationId;
  name: string;
  description: string;
  xpCost: number;
  icon: string;
}

export type AgreementType = 'sanksi' | 'hadiah';
export type AgreementForWhom = 'self' | 'partner' | 'both';
export type AgreementStatus =
  | 'draft'
  | 'pending_approval'
  | 'active'
  | 'triggered'
  | 'completed'
  | 'pardoned'
  | 'rejected';
export type AgreementTriggerType =
  | 'miss_habit_count'
  | 'broken_streak'
  | 'weekly_goal_miss'
  | 'manual';

export interface Agreement {
  id: string;
  coupleId: string;
  type: AgreementType;
  title: string;
  forWhom: AgreementForWhom;
  creatorId: string;
  creatorName?: string;
  status: AgreementStatus;
  partnerApproved: boolean;
  triggerType: AgreementTriggerType;
  triggerHabitIds?: string[];
  triggerThreshold: number; // e.g. 2 times missed
  timesTriggered: number;
  timesCompleted: number;
  timesPardoned: number;
  proposedRevision?: string;
  pendingAction?: 'relief' | 'swap';
  pendingActionBy?: string;
  pendingNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type HabitCategory = 'baca' | 'belajar' | 'kesehatan' | 'spiritual' | 'kustom';

export interface Habit {
  id: string;
  coupleId: string;
  ownerId: string;
  title: string;
  icon: string;
  category: HabitCategory;
  targetMinutes: number; // 0 for pure checklist
  frequency: 'daily' | 'weekdays' | 'weekends';
  isShared: boolean; // whether both partners do this habit
  isPrivate: boolean; // hidden from partner if true
  createdAt?: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  coupleId: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  durationMinutes: number;
  completedAt?: string;
  // Private habit logs are only readable by their owner (enforced in Firestore rules).
  visibility?: 'couple' | 'private';
}

export interface FocusSession {
  id: string;
  coupleId: string;
  userId: string;
  habitId?: string;
  category: HabitCategory;
  durationSeconds: number;
  title: string;
  lastPage?: number;
  keyTakeaway?: string;
  timestamp: string;
  // Sessions tied to a private habit stay private to their owner.
  visibility?: 'couple' | 'private';
}

export interface Book {
  id: string;
  coupleId: string;
  title: string;
  author: string;
  status: 'reading' | 'completed' | 'wishlist';
  rating: number; // 1 to 5
  favoriteQuote?: string;
  addedBy: string;
  addedById?: string;
  updatedAt?: string;
}

export interface JournalEntry {
  id: string;
  coupleId: string;
  authorId: string;
  authorName?: string;
  weekNumber: number;
  year: number;
  whatWorked: string;
  whatWasHard: string;
  nextWeekGoal: string;
  isShared: boolean;
  createdAt: string;
}

export interface Reaction {
  id: string;
  coupleId: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  emoji: string;
  habitTitle?: string;
  message?: string;
  createdAt: string;
}

export interface NeuroscienceInsight {
  id: string;
  title: string;
  topic: 'dopamine' | 'habit-loop' | 'circadian' | 'co-regulation';
  cue: string;
  mechanism: string;
  practicalTip: string;
  citation: string;
}
