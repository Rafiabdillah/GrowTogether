import React, { Suspense, lazy, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Flame,
  Clock,
  Sprout,
  BookOpen,
  Brain,
  Droplets,
  Footprints,
  Moon,
  HeartHandshake,
  Timer,
  ShieldCheck,
  Lock,
  Trash2,
  AlertCircle,
  Users,
  Pencil,
  Repeat,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Habit, HabitCategory } from '../types/index';
import { XP_PER_LEVEL, toLocalDateString } from '../data/mockData';
import { AppleWatchRings } from '../components/AppleWatchRings';
import { useDialog } from '../hooks/useDialog';

const ThreeGarden = lazy(() =>
  import('../components/ThreeGarden').then((m) => ({ default: m.ThreeGarden }))
);

const JOINT_FOCUS_TARGET_MINUTES = 30;

const FREQUENCY_LABELS: Record<Habit['frequency'], string> = {
  daily: 'Setiap hari',
  weekdays: 'Senin–Jumat',
  weekends: 'Sabtu–Minggu',
};

const HABIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Brain,
  Droplets,
  Footprints,
  Moon,
  HeartHandshake,
  Timer,
};

interface TodayViewProps {
  onStartTimer: (habitId: string, category: HabitCategory, minutes: number) => void;
  onNavigateToAgreements?: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onStartTimer,
  onNavigateToAgreements,
}) => {
  const {
    currentUser,
    partnerUser,
    couple,
    habits,
    logs,
    agreements,
    selectedDate,
    setSelectedDate,
    toggleHabit,
    addHabit,
    editHabit,
    deleteHabit,
    sendReaction,
    toggleGraceDay,
  } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  // WebGL on first paint is heavy on phones, so it starts collapsed there.
  const [showHeroTree, setShowHeroTree] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  const addDialogRef = useDialog<HTMLDivElement>(isAddModalOpen, () => setIsAddModalOpen(false));
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<HabitCategory>('kustom');
  const [newMinutes, setNewMinutes] = useState<number>(0);
  const [newFrequency, setNewFrequency] = useState<Habit['frequency']>('daily');
  const [newIsShared, setNewIsShared] = useState(true);
  const [newIsPrivate, setNewIsPrivate] = useState(false);

  const selectedWeekday = new Date(`${selectedDate}T12:00:00`).getDay();
  const isScheduledForDate = (habit: Habit) => {
    if (habit.frequency === 'weekdays') return selectedWeekday >= 1 && selectedWeekday <= 5;
    if (habit.frequency === 'weekends') return selectedWeekday === 0 || selectedWeekday === 6;
    return true;
  };

  // Habits you can tick: your own plus shared ones (each partner keeps their own log).
  const myHabits = habits.filter(
    (h) =>
      isScheduledForDate(h) &&
      (!h.isPrivate || h.ownerId === currentUser.id) &&
      (h.ownerId === currentUser.id || h.isShared)
  );
  // Partner's personal habits are visible to you but read-only.
  const partnerOnlyHabits = habits.filter(
    (h) => h.ownerId === partnerUser?.id && !h.isShared && !h.isPrivate && isScheduledForDate(h)
  );

  const userLogsForDate = logs.filter(
    (l) => l.userId === currentUser.id && l.date === selectedDate && l.completed
  );
  const userCompletedHabitIds = new Set(userLogsForDate.map((l) => l.habitId));
  const userTotalHabits = myHabits.length;
  const userCompletedCount = myHabits.filter((h) => userCompletedHabitIds.has(h.id)).length;
  const userPercent = userTotalHabits > 0 ? Math.round((userCompletedCount / userTotalHabits) * 100) : 0;

  const partnerLogsForDate = logs.filter(
    (l) => l.userId === partnerUser?.id && l.date === selectedDate && l.completed
  );
  const partnerCompletedHabitIds = new Set(partnerLogsForDate.map((l) => l.habitId));
  // Only habits we are allowed to see can count toward the partner's visible progress.
  const partnerHabits = habits.filter(
    (h) => !h.isPrivate && (h.ownerId === partnerUser?.id || h.isShared)
  );
  const partnerCompletedCount = partnerHabits.filter((h) => partnerCompletedHabitIds.has(h.id)).length;
  const partnerPercent =
    partnerHabits.length > 0 ? Math.round((partnerCompletedCount / partnerHabits.length) * 100) : 0;

  const focusMinutesToday = logs
    .filter((l) => l.date === selectedDate && l.completed)
    .reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
  const focusMinutesPercent = Math.min(
    100,
    Math.round((focusMinutesToday / JOINT_FOCUS_TARGET_MINUTES) * 100)
  );

  const triggeredSanctions = agreements.filter(
    (a) => a.type === 'sanksi' && a.status === 'triggered' && !couple?.allSanctionsPaused
  );

  const dateOptions = [-2, -1, 0, 1, 2].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      dateStr: toLocalDateString(d),
      dayName: d.toLocaleDateString('id-ID', { weekday: 'short' }),
      fullLabel: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
      dayNum: d.getDate(),
      isToday: offset === 0,
    };
  });

  const openCreateHabit = () => {
    setEditingHabitId(null);
    setNewTitle('');
    setNewCategory('kustom');
    setNewMinutes(0);
    setNewFrequency('daily');
    setNewIsShared(true);
    setNewIsPrivate(false);
    setIsAddModalOpen(true);
  };

  const openEditHabit = (habit: Habit) => {
    setEditingHabitId(habit.id);
    setNewTitle(habit.title);
    setNewCategory(habit.category);
    setNewMinutes(habit.targetMinutes);
    setNewFrequency(habit.frequency);
    setNewIsShared(habit.isShared);
    setNewIsPrivate(habit.isPrivate);
    setIsAddModalOpen(true);
  };

  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let icon = 'Timer';
    if (newCategory === 'baca') icon = 'BookOpen';
    else if (newCategory === 'belajar') icon = 'Brain';
    else if (newCategory === 'kesehatan') icon = 'Droplets';
    else if (newCategory === 'spiritual') icon = 'HeartHandshake';

    if (editingHabitId) {
      await editHabit(editingHabitId, {
        title: newTitle.trim(),
        icon,
        category: newCategory,
        targetMinutes: Number(newMinutes) || 0,
        frequency: newFrequency,
        isShared: newIsShared,
        isPrivate: newIsPrivate,
      });
    } else {
      await addHabit({
        coupleId: couple.id || '',
        ownerId: currentUser.id,
        title: newTitle.trim(),
        icon,
        category: newCategory,
        targetMinutes: Number(newMinutes) || 0,
        frequency: newFrequency,
        isShared: newIsShared,
        isPrivate: newIsPrivate,
      });
    }

    setIsAddModalOpen(false);
    setEditingHabitId(null);
  };

  const isBothCompletedAll =
    userTotalHabits > 0 &&
    partnerHabits.length > 0 &&
    userCompletedCount === userTotalHabits &&
    partnerCompletedCount === partnerHabits.length;

  return (
    <div className="space-y-6">
      {isBothCompletedAll && (
        <div
          role="status"
          className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h3 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
              Berdua tuntas hari ini
            </h3>
            <p className="text-xs text-stone-700 dark:text-stone-300 mt-0.5">
              Kalian berdua menyelesaikan seluruh habit hari ini.
            </p>
          </div>
          <button
            type="button"
            onClick={() => sendReaction('🙌', 'High-Five!', 'Kita berdua luar biasa hari ini!')}
            className="min-h-[44px] px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold whitespace-nowrap"
          >
            Kirim high-five ke {partnerUser?.displayName.split(' ')[0] ?? 'pasangan'}
          </button>
        </div>
      )}

      {triggeredSanctions.length > 0 && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-3 text-rose-900 dark:text-rose-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden="true" />
            <div className="text-xs">
              <span className="font-bold">Sanksi kesepakatan terpicu:</span>{' '}
              <span>"{triggeredSanctions[0].title}"</span>
            </div>
          </div>
          {onNavigateToAgreements && (
            <button
              type="button"
              onClick={onNavigateToAgreements}
              className="min-h-[44px] px-4 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shrink-0"
            >
              Buka brankas kesepakatan
            </button>
          )}
        </div>
      )}

      <section
        aria-labelledby="tree-heading"
        className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="tree-heading" className="text-base font-bold text-stone-900 dark:text-stone-100 font-sans">
              Pohon Kita: simbol pertumbuhan berdua
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              Pohon mekar seiring streak dan penyelesaian habit harian kalian.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHeroTree((prev) => !prev)}
            aria-expanded={showHeroTree}
            className="min-h-[44px] px-4 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            {showHeroTree ? 'Ciutkan 3D' : 'Tampilkan 3D'}
          </button>
        </div>

        {showHeroTree && (
          <Suspense
            fallback={
              <div role="status" className="h-64 flex items-center justify-center text-xs text-stone-600 dark:text-stone-400">
                Memuat pohon 3D...
              </div>
            }
          >
            <ThreeGarden
                streakCount={couple?.combinedStreak || 0}
              completedTodayCount={userCompletedCount}
              partnerCompletedTodayCount={partnerCompletedCount}
            />
          </Suspense>
        )}
      </section>

      <div role="group" aria-label="Pilih tanggal" className="flex items-center justify-between gap-2 overflow-x-auto py-1 no-scrollbar">
        {dateOptions.map(({ dateStr, dayName, dayNum, fullLabel, isToday }) => {
          const isSelected = selectedDate === dateStr;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr)}
              aria-pressed={isSelected}
              aria-label={fullLabel}
              className={`flex-1 min-w-[58px] min-h-[56px] py-2 px-2 rounded-2xl flex flex-col items-center justify-center transition-colors ${
                isSelected
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-stone-400'
              }`}
            >
              <span className="text-[11px] font-medium capitalize">{dayName}</span>
              <span className="text-base font-bold mt-0.5">{dayNum}</span>
              {isToday && (
                <span
                  className={`text-[11px] font-medium ${
                    isSelected ? 'text-amber-300 dark:text-amber-700' : 'text-amber-700 dark:text-amber-300'
                  }`}
                >
                  Hari Ini
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2">
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              Cincin progres harian
            </h3>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Level bareng: Tk. {couple?.levelNumber || 1}
            </span>
          </div>

          <AppleWatchRings
            userPercent={userPercent}
            partnerPercent={partnerPercent}
            focusMinutesPercent={focusMinutesPercent}
            userLabel={currentUser.displayName.split(' ')[0]}
            partnerLabel={partnerUser?.displayName.split(' ')[0] || 'Pasangan'}
            size={160}
          />
        </div>

        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-stone-900 border border-amber-200 dark:border-amber-900/40 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  <Flame className="w-5 h-5 fill-amber-500" aria-hidden="true" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    Streak bersama
                  </h4>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400">Keduanya menuntaskan habit</p>
                </div>
              </div>

              <button
                type="button"
                onClick={couple ? toggleGraceDay : undefined}
                aria-pressed={!!couple?.graceDayUsedThisWeek}
                title="Grace day memberi 1 hari toleransi libur per minggu"
                className={`min-h-[44px] flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium border transition-colors ${
                  couple.graceDayUsedThisWeek
                    ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    : 'bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>{couple?.graceDayUsedThisWeek ? 'Grace day aktif' : 'Pakai grace day'}</span>
              </button>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
                {couple?.combinedStreak || 0}
              </span>
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">hari berturut-turut</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200 dark:border-stone-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-stone-700 dark:text-stone-400">XP menuju Tk. {(couple?.levelNumber || 1) + 1}</span>
              <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                {(couple?.levelXp || 0) % XP_PER_LEVEL} / {XP_PER_LEVEL} XP
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progres XP menuju level berikutnya"
              aria-valuemin={0}
              aria-valuemax={XP_PER_LEVEL}
              aria-valuenow={(couple?.levelXp || 0) % XP_PER_LEVEL}
              className="w-full h-2 rounded-full bg-amber-200/70 dark:bg-stone-800 overflow-hidden"
            >
              <div
                className="h-full bg-amber-600"
                style={{ width: `${Math.round((((couple?.levelXp || 0) % XP_PER_LEVEL) / XP_PER_LEVEL) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
            Kirim semangat ke {partnerUser?.displayName.split(' ')[0]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {['❤️', '👏', '☕', '🔥', '✨'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              aria-label={`Kirim reaksi ${emoji}`}
              className="w-11 h-11 rounded-2xl active:scale-95 transition-transform flex items-center justify-center text-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700"
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          ))}
        </div>
      </div>

      <section aria-labelledby="habits-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="habits-heading" className="text-base font-bold text-stone-900 dark:text-stone-100">
              Daftar habit hari ini
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              Ketuk lingkaran di kiri untuk menandai habit selesai.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateHabit}
            className="min-h-[44px] flex items-center gap-1.5 px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 active:scale-98 transition-opacity"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah habit</span>
          </button>
        </div>

        {myHabits.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white dark:bg-stone-900 border border-dashed border-stone-300 dark:border-stone-700 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300 mx-auto flex items-center justify-center">
              <Sprout className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Belum ada kebiasaan harian
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                Mulai dari kebiasaan kecil yang bisa kalian jaga berdua. Pilih salah satu di bawah atau buat sendiri.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl mx-auto pt-2">
              <button
                type="button"
                onClick={() =>
                  addHabit({
                    coupleId: couple.id,
                    ownerId: currentUser.id,
                    title: 'Baca Buku Bersama',
                    category: 'baca',
                    targetMinutes: 15,
                    frequency: 'daily',
                    isShared: true,
                    isPrivate: false,
                    icon: 'BookOpen',
                  })
                }
                className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-amber-500 text-left transition-all group"
              >
                <span className="text-xs font-bold block text-stone-800 dark:text-stone-100 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  + Baca 15 Menit
                </span>
                <span className="text-[11px] text-stone-500">Kategori Bacaan</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  addHabit({
                    coupleId: couple.id,
                    ownerId: currentUser.id,
                    title: 'Jalan Santai Sore',
                    category: 'kesehatan',
                    targetMinutes: 20,
                    frequency: 'daily',
                    isShared: true,
                    isPrivate: false,
                    icon: 'Footprints',
                  })
                }
                className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-emerald-500 text-left transition-all group"
              >
                <span className="text-xs font-bold block text-stone-800 dark:text-stone-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                  + Jalan Sore 20 Mnt
                </span>
                <span className="text-[11px] text-stone-500">Kebugaran Fisik</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  addHabit({
                    coupleId: couple.id,
                    ownerId: currentUser.id,
                    title: 'Doa & Syukur Harian',
                    category: 'spiritual',
                    targetMinutes: 5,
                    frequency: 'daily',
                    isShared: true,
                    isPrivate: false,
                    icon: 'HeartHandshake',
                  })
                }
                className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-rose-500 text-left transition-all group"
              >
                <span className="text-xs font-bold block text-stone-800 dark:text-stone-100 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                  + Syukur 5 Menit
                </span>
                <span className="text-[11px] text-stone-500">Ritual Batiniah</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={openCreateHabit}
                className="min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:opacity-90 transition-opacity"
              >
                + Buat kebiasaan sendiri
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
          {myHabits.map((habit) => {
            const isCompleted = userCompletedHabitIds.has(habit.id);
            const isPartnerCompleted = partnerCompletedHabitIds.has(habit.id);
            const IconComponent = HABIT_ICONS[habit.icon] || Timer;

            return (
              <div
                key={habit.id}
                className={`p-3 sm:p-4 rounded-3xl border transition-colors flex items-center justify-between gap-2 sm:gap-3 ${
                  isCompleted
                    ? 'bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800'
                    : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:border-amber-400 dark:hover:border-amber-600'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleHabit(habit.id)}
                    aria-pressed={isCompleted}
                    aria-label={`${isCompleted ? 'Batalkan' : 'Tandai selesai'}: ${habit.title}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-500/20" aria-hidden="true" />
                    ) : (
                      <Circle className="w-6 h-6 text-stone-500 dark:text-stone-500 hover:text-amber-600 transition-colors" aria-hidden="true" />
                    )}
                  </button>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isCompleted
                            ? 'line-through text-stone-500 dark:text-stone-400'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {habit.title}
                      </span>
                      {habit.isPrivate && (
                        <span className="text-[11px] text-stone-600 dark:text-stone-400 flex items-center gap-0.5">
                          <Lock className="w-3 h-3" aria-hidden="true" /> Privat
                        </span>
                      )}
                      {habit.isShared && habit.ownerId !== currentUser.id && (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                          <Users className="w-3 h-3" aria-hidden="true" /> Bersama
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex-wrap">
                      {habit.targetMinutes > 0 ? (
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <span>{habit.targetMinutes} menit</span>
                        </span>
                      ) : (
                        <span>Checklist</span>
                      )}

                      {habit.frequency !== 'daily' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <Repeat className="w-3 h-3" aria-hidden="true" />
                            {FREQUENCY_LABELS[habit.frequency]}
                          </span>
                        </>
                      )}

                      {habit.isShared && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1 text-[11px]">
                            {isPartnerCompleted ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                {partnerUser?.displayName.split(' ')[0]} sudah selesai
                              </span>
                            ) : (
                              <span className="text-stone-600 dark:text-stone-400">
                                {partnerUser?.displayName.split(' ')[0]} belum
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {habit.targetMinutes > 0 && !isCompleted && (
                    <button
                      type="button"
                      onClick={() => onStartTimer(habit.id, habit.category, habit.targetMinutes)}
                      aria-label={`Mulai timer: ${habit.title}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium transition-colors"
                    >
                      <Timer className="w-4 h-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Mulai timer</span>
                    </button>
                  )}

                  {habit.ownerId === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => openEditHabit(habit)}
                      aria-label={`Ubah habit: ${habit.title}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}

                  {habit.ownerId === currentUser.id && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Hapus habit "${habit.title}"? Catatan penyelesaiannya ikut hilang.`)) {
                          deleteHabit(habit.id);
                        }
                      }}
                      aria-label={`Hapus habit: ${habit.title}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </section>

      {partnerUser && partnerOnlyHabits.length > 0 && (
        <section aria-labelledby="partner-habits-heading" className="space-y-3">
          <div>
            <h2
              id="partner-habits-heading"
              className="text-base font-bold text-stone-900 dark:text-stone-100"
            >
              Habit {partnerUser.displayName.split(' ')[0]}
            </h2>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
              Hanya bisa dilihat. Penanda selesai dilakukan oleh pasanganmu sendiri.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {partnerOnlyHabits.map((habit) => {
              const isDone = partnerCompletedHabitIds.has(habit.id);
              const IconComponent = HABIT_ICONS[habit.icon] || Timer;

              return (
                <div
                  key={habit.id}
                  className="p-3 sm:p-4 rounded-3xl border border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 flex items-center gap-2 sm:gap-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-500/20" />
                    ) : (
                      <Circle className="w-6 h-6 text-stone-400 dark:text-stone-600" />
                    )}
                  </span>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <IconComponent className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
                      <span
                        className={`text-sm font-semibold truncate ${
                          isDone
                            ? 'line-through text-stone-500 dark:text-stone-400'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {habit.targetMinutes > 0 ? `${habit.targetMinutes} menit` : 'Checklist harian'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          isDone
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-stone-600 dark:text-stone-400'
                        }
                      >
                        {isDone ? 'Sudah selesai' : 'Belum selesai'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={addDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-habit-title"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100"
          >
            <h3 id="add-habit-title" className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {editingHabitId ? 'Ubah habit' : 'Buat habit baru'}
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              {editingHabitId
                ? 'Perbarui detail kebiasaan ini. Riwayat penyelesaian tetap tersimpan.'
                : 'Tambahkan kebiasaan yang ingin kamu bangun bersama pasangan.'}
            </p>

            <form onSubmit={handleCreateHabit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="habit-title" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Nama kebiasaan
                </label>
                <input
                  id="habit-title"
                  type="text"
                  required
                  placeholder="Misal: Olahraga pagi 20 menit"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="habit-category" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Kategori
                  </label>
                  <select
                    id="habit-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as HabitCategory)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-base sm:text-sm"
                  >
                    <option value="baca">Baca buku</option>
                    <option value="belajar">Belajar</option>
                    <option value="kesehatan">Kesehatan</option>
                    <option value="spiritual">Spiritual / syukur</option>
                    <option value="kustom">Kustom</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="habit-frequency" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Jadwal
                  </label>
                  <select
                    id="habit-frequency"
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value as Habit['frequency'])}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-base sm:text-sm"
                  >
                    <option value="daily">Setiap hari</option>
                    <option value="weekdays">Senin–Jumat</option>
                    <option value="weekends">Sabtu–Minggu</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="habit-minutes" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Target durasi (menit)
                  </label>
                  <input
                    id="habit-minutes"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="5"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm font-mono"
                    placeholder="0 untuk checklist"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4">
                <label className="flex items-center gap-2 min-h-[44px] text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={newIsShared}
                    onChange={(e) => {
                      setNewIsShared(e.target.checked);
                      if (e.target.checked) setNewIsPrivate(false);
                    }}
                    className="w-4 h-4 rounded text-amber-600"
                  />
                  <span>Dikerjakan berdua</span>
                </label>

                <label className="flex items-center gap-2 min-h-[44px] text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={newIsPrivate}
                    onChange={(e) => {
                      setNewIsPrivate(e.target.checked);
                      if (e.target.checked) setNewIsShared(false);
                    }}
                    className="w-4 h-4 rounded text-amber-600"
                  />
                  <span>Privat (hanya kamu yang lihat)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90"
                >
                  {editingHabitId ? 'Simpan perubahan' : 'Simpan habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
