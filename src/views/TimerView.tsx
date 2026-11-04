import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  BookOpen,
  Brain,
  CheckCircle2,
  Maximize2,
  Minimize2,
  CloudRain,
  FlameKindling,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HabitCategory } from '../types/index';
import { sound } from '../lib/audio';
import { ambientAudio } from '../lib/ambientAudio';
import confetti from 'canvas-confetti';
import { useDialog } from '../hooks/useDialog';

interface TimerViewProps {
  initialHabitId?: string;
  initialCategory?: HabitCategory;
  initialMinutes?: number;
  initialRequestId?: number;
}

const CATEGORY_LABELS: Record<HabitCategory, string> = {
  baca: 'Membaca',
  belajar: 'Belajar',
  kesehatan: 'Kesehatan',
  spiritual: 'Spiritual',
  kustom: 'Fokus',
};

export const TimerView: React.FC<TimerViewProps> = ({
  initialHabitId,
  initialCategory = 'baca',
  initialMinutes = 10,
  initialRequestId,
}) => {
  const { habits, recordFocusSession, couple, currentUser } = useApp();

  const [category, setCategory] = useState<HabitCategory>(initialCategory);
  const [selectedHabitId, setSelectedHabitId] = useState<string>(initialHabitId || '');
  const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(initialMinutes);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialMinutes * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [ambientMode, setAmbientMode] = useState<'off' | 'rain' | 'fire'>('off');
  const [isManualInput, setIsManualInput] = useState<boolean>(false);

  // Post session modal states
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [sessionLastPage, setSessionLastPage] = useState<string>('');
  const [sessionTakeaway, setSessionTakeaway] = useState<string>('');
  const [loggedSeconds, setLoggedSeconds] = useState<number>(0);

  // Manual log fields
  const [manualMinutes, setManualMinutes] = useState<number>(15);
  const [manualTitle, setManualTitle] = useState<string>('');
  const [manualTakeaway, setManualTakeaway] = useState<string>('');

  const [shortSessionHint, setShortSessionHint] = useState<string>('');
  const [isSavingSession, setIsSavingSession] = useState<boolean>(false);
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  const endAtRef = useRef<number>(0);
  const secondsRemainingRef = useRef<number>(initialMinutes * 60);
  const completeRef = useRef<() => void>(() => {});
  const appliedRequestIdRef = useRef<number | undefined>(undefined);
  const logDialogRef = useDialog<HTMLDivElement>(isLogModalOpen, () => {
    setIsLogModalOpen(false);
    setSecondsRemaining(targetDurationMinutes * 60);
  });

  useEffect(() => {
    if (initialRequestId !== undefined && appliedRequestIdRef.current === initialRequestId) return;
    appliedRequestIdRef.current = initialRequestId;
    if (initialCategory) setCategory(initialCategory);
    if (initialHabitId) setSelectedHabitId(initialHabitId);
    if (initialMinutes) {
      setTargetDurationMinutes(initialMinutes);
      setSecondsRemaining(initialMinutes * 60);
    }
  }, [initialCategory, initialHabitId, initialMinutes, initialRequestId]);

  const selectableHabits = habits.filter(
    (h) =>
      (!h.isPrivate || h.ownerId === currentUser.id) &&
      (h.ownerId === currentUser.id || h.isShared)
  );
  const selectedHabit = habits.find((h) => h.id === selectedHabitId);

  const handleHabitSelect = (id: string) => {
    setSelectedHabitId(id);
    const habit = habits.find((h) => h.id === id);
    if (!habit) return;
    setCategory(habit.category);
    if (habit.targetMinutes > 0) handlePresetSelect(habit.targetMinutes);
  };

  useEffect(() => {
    secondsRemainingRef.current = secondsRemaining;
  }, [secondsRemaining]);

  // The countdown follows the wall clock, so background tabs do not make it drift.
  useEffect(() => {
    if (!isActive) return;
    endAtRef.current = Date.now() + secondsRemainingRef.current * 1000;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecondsRemaining(left);
      secondsRemainingRef.current = left;
      if (left === 0) {
        window.clearInterval(id);
        completeRef.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => () => ambientAudio.stop(), []);

  // Handle ambient sound toggle
  const toggleAmbientSound = (mode: 'rain' | 'fire') => {
    if (ambientMode === mode) {
      ambientAudio.stop();
      setAmbientMode('off');
    } else {
      if (mode === 'rain') ambientAudio.playRain(0.25);
      else ambientAudio.playCampfire(0.3);
      setAmbientMode(mode);
    }
  };

  const handleStart = () => {
    setIsActive(true);
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsRemaining(targetDurationMinutes * 60);
  };

  const handlePresetSelect = (minutes: number) => {
    setIsActive(false);
    setTargetDurationMinutes(minutes);
    setSecondsRemaining(minutes * 60);
  };

  const handleCompleteSession = () => {
    const elapsed = targetDurationMinutes * 60 - secondsRemainingRef.current;
    const wasActive = isActive;
    setIsActive(false);
    // Sesi di bawah satu menit tidak dihitung, tapi audio latar harus tetap
    // berhenti dan pengguna harus tahu mengapa tidak ada yang terjadi.
    if (elapsed < 60) {
      ambientAudio.stop();
      setAmbientMode('off');
      setShortSessionHint(
        wasActive
          ? `Fokus ${Math.round(elapsed)} detik belum dihitung. Sesi minimal 1 menit agar masuk catatan kalian.`
          : 'Sesi belum dimulai, jadi tidak ada yang dicatat.'
      );
      return;
    }
    setShortSessionHint('');

    ambientAudio.stop();
    setAmbientMode('off');
    sound.playSessionChime();
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });

    setLoggedSeconds(elapsed);
    setSessionTitle(selectedHabit?.title || '');
    setIsLogModalOpen(true);
  };
  completeRef.current = handleCompleteSession;

  const handleSaveSessionLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSession) return;
    setIsSavingSession(true);
    try {
      await recordFocusSession({
        coupleId: couple.id,
        userId: '',
        habitId: selectedHabitId || undefined,
        category,
        durationSeconds: loggedSeconds,
        title: sessionTitle || (category === 'baca' ? 'Membaca Buku' : 'Sesi Belajar'),
        lastPage: sessionLastPage ? Number(sessionLastPage) : undefined,
        keyTakeaway: sessionTakeaway,
      });

      setIsLogModalOpen(false);
      setSessionTitle('');
      setSessionLastPage('');
      setSessionTakeaway('');
      setSecondsRemaining(targetDurationMinutes * 60);
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleSaveManualLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMinutes || manualMinutes <= 0) return;
    if (isSavingManual) return;
    setIsSavingManual(true);
    try {
      await recordFocusSession({
        coupleId: couple.id,
        userId: '',
        habitId: selectedHabitId || undefined,
        category,
        durationSeconds: manualMinutes * 60,
        title:
          manualTitle ||
          selectedHabit?.title ||
          (category === 'baca' ? 'Membaca Buku (Manual)' : 'Belajar (Manual)'),
        keyTakeaway: manualTakeaway,
      });

      setIsManualInput(false);
      setManualTitle('');
      setManualTakeaway('');
      sound.playHabitComplete();
    } finally {
      setIsSavingManual(false);
    }
  };

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  const totalSeconds = targetDurationMinutes * 60;
  const progressPercent = totalSeconds > 0 ? Math.round(((totalSeconds - secondsRemaining) / totalSeconds) * 100) : 0;

  return (
    <div className={`space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0E1118] text-white flex flex-col justify-center items-center p-6' : 'max-w-xl mx-auto'}`}>
      
      {isFullscreen && (
        <div className="absolute top-6 left-4 right-4 sm:left-6 sm:right-6 flex flex-wrap items-center justify-between gap-2 z-10">
          <span className="text-xs font-semibold text-stone-300">
            Mode fokus penuh: {selectedHabit?.title || CATEGORY_LABELS[category]}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleAmbientSound('rain')}
              aria-pressed={ambientMode === 'rain'}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                ambientMode === 'rain'
                  ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                  : 'border-stone-600 text-stone-300 hover:text-white'
              }`}
            >
              <CloudRain className="w-4 h-4" aria-hidden="true" />
              <span>Hujan</span>
            </button>

            <button
              type="button"
              onClick={() => toggleAmbientSound('fire')}
              aria-pressed={ambientMode === 'fire'}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                ambientMode === 'fire'
                  ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                  : 'border-stone-600 text-stone-300 hover:text-white'
              }`}
            >
              <FlameKindling className="w-4 h-4" aria-hidden="true" />
              <span>Api unggun</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              aria-label="Keluar dari layar penuh"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200"
            >
              <Minimize2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={() => {
                setCategory('baca');
                handlePresetSelect(10);
              }}
              aria-pressed={category === 'baca'}
              className={`min-h-[44px] flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors ${
                category === 'baca'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <BookOpen className="w-4 h-4 text-rose-600" aria-hidden="true" />
              <span>Baca (10m)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCategory('belajar');
                handlePresetSelect(15);
              }}
              aria-pressed={category === 'belajar'}
              className={`min-h-[44px] flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors ${
                category === 'belajar'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              <Brain className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              <span>Belajar (15m)</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleAmbientSound('rain')}
              aria-pressed={ambientMode === 'rain'}
              aria-label="Suara rintik hujan"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs border transition-colors ${
                ambientMode === 'rain'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-300'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400'
              }`}
            >
              <CloudRain className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => toggleAmbientSound('fire')}
              aria-pressed={ambientMode === 'fire'}
              aria-label="Suara api unggun"
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-xs border transition-colors ${
                ambientMode === 'fire'
                  ? 'bg-amber-500/10 border-amber-600 text-amber-800 dark:text-amber-300'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400'
              }`}
            >
              <FlameKindling className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              aria-label="Layar penuh"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!isFullscreen && !isManualInput && (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 space-y-2">
          <label
            htmlFor="timer-habit"
            className="block text-xs font-semibold text-stone-700 dark:text-stone-300"
          >
            Habit yang dikerjakan
          </label>
          <select
            id="timer-habit"
            value={selectedHabitId}
            onChange={(e) => handleHabitSelect(e.target.value)}
            className="w-full min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-base sm:text-sm"
          >
            <option value="">Tanpa habit (fokus bebas)</option>
            {selectableHabits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
                {h.targetMinutes > 0 ? ` · ${h.targetMinutes} mnt` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            {selectedHabit
              ? 'Sesi dicatat pada habit ini dan menuntaskannya saat target menit tercapai.'
              : 'Pilih habit agar sesi fokus langsung dihitung ke kebiasaanmu.'}
          </p>
        </div>
      )}

      {!isManualInput ? (
        <div
          className={`rounded-3xl border transition-all flex flex-col items-center relative overflow-hidden text-center ${
            isFullscreen
              ? 'border-transparent bg-transparent w-full'
              : 'p-6 sm:p-8 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800'
          }`}
        >
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="44"
                className={isFullscreen ? 'text-stone-800/80' : 'text-stone-100 dark:text-stone-800'}
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="44"
                className={`transition-all duration-1000 ease-linear ${
                  category === 'baca' ? 'text-rose-500' : 'text-emerald-500'
                }`}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="276.46"
                strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                stroke="currentColor"
                fill="none"
              />
            </svg>

            <div className="absolute flex flex-col items-center">
              <span
                role="timer"
                aria-label={`Sisa waktu ${mins} menit ${secs} detik`}
                className={`text-5xl sm:text-6xl font-extrabold tracking-tight font-mono tabular-nums ${isFullscreen ? 'text-white' : 'text-stone-900 dark:text-stone-100'}`}
              >
                {timeFormatted}
              </span>
              <span className={`text-xs mt-2 font-medium ${isFullscreen ? 'text-stone-300' : 'text-stone-600 dark:text-stone-400'}`}>
                {isActive ? 'Sedang fokus' : 'Siap untuk fokus'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[10, 15, 25, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handlePresetSelect(m)}
                disabled={isActive}
                aria-pressed={targetDurationMinutes === m}
                aria-label={`${m} menit`}
                className={`min-h-[44px] min-w-[52px] px-3 rounded-xl text-xs font-mono font-medium border transition-colors ${
                  targetDurationMinutes === m
                    ? 'bg-amber-500/10 border-amber-600 text-amber-800 dark:text-amber-300'
                    : isFullscreen
                    ? 'border-stone-600 text-stone-300 hover:text-white'
                    : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                } ${isActive ? 'opacity-50' : ''}`}
              >
                {m}m
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mt-8">
            <button
              type="button"
              onClick={handleReset}
              aria-label="Ulangi timer dari awal"
              className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl border transition-colors ${
                isFullscreen
                  ? 'border-stone-600 text-stone-300 hover:text-white'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
            </button>

            {!isActive ? (
              <button
                type="button"
                onClick={handleStart}
                className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-sm hover:opacity-90 active:scale-95 transition-opacity ${
                  isFullscreen ? 'bg-white text-stone-900' : 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                }`}
              >
                <Play className="w-5 h-5 fill-current" aria-hidden="true" />
                <span>Mulai fokus</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-700 text-white font-semibold text-sm hover:bg-amber-800 active:scale-95 transition-colors"
              >
                <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
                <span>Jeda</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCompleteSession}
              aria-label="Selesaikan dan simpan sesi (minimal 1 menit)"
              title="Selesaikan dan simpan sesi (minimal 1 menit)"
              className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl border transition-colors ${
                isFullscreen
                  ? 'border-stone-600 text-stone-300 hover:text-emerald-300'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-stone-800'
              }`}
            >
              <Square className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {shortSessionHint && (
            <p role="alert" className="mt-4 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              {shortSessionHint}
            </p>
          )}

          {!isFullscreen && (
            <button
              type="button"
              onClick={() => setIsManualInput(true)}
              className="mt-6 min-h-[44px] text-xs text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 underline underline-offset-4 transition-colors"
            >
              Lupa menyalakan timer? Catat durasi manual
            </button>
          )}
        </div>
      ) : (
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Catat sesi manual
            </h3>
            <button
              type="button"
              onClick={() => setIsManualInput(false)}
              className="min-h-[44px] text-xs text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Kembali ke timer
            </button>
          </div>

          <form onSubmit={handleSaveManualLog} className="mt-4 space-y-4">
            <div>
              <label htmlFor="manual-minutes" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Berapa menit kamu sudah fokus? <span className="text-rose-500" aria-hidden="true">*</span>
                <span className="sr-only">wajib diisi</span>
              </label>
              <input
                id="manual-minutes"
                type="number"
                inputMode="numeric"
                min="1"
                max="300"
                required
                aria-required="true"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="manual-title" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Judul buku / topik yang dipelajari
              </label>
              <input
                id="manual-title"
                type="text"
                placeholder="Misal: Atomic Habits - Bab 3"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="manual-takeaway" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                1 hal penting yang kamu pelajari
              </label>
              <textarea
                id="manual-takeaway"
                rows={3}
                placeholder="Tuliskan 1 intisari singkat"
                value={manualTakeaway}
                onChange={(e) => setManualTakeaway(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsManualInput(false)}
                className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSavingManual || !manualMinutes || manualMinutes < 1}
                className="min-h-[44px] px-5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium disabled:opacity-50"
              >
                {isSavingManual ? 'Menyimpan...' : 'Simpan catatan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            ref={logDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-session-title"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100"
          >
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
              <h3 id="log-session-title" className="text-base font-bold text-stone-900 dark:text-stone-100">
                Sesi selesai
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
              Kamu fokus selama {Math.round(loggedSeconds / 60)} menit. Catat sekilas agar bisa dibaca pasanganmu.
            </p>

            <form onSubmit={handleSaveSessionLog} className="mt-4 space-y-4">
              <div>
                <label htmlFor="session-title" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Judul buku / materi pelajaran <span className="text-rose-500" aria-hidden="true">*</span>
                  <span className="sr-only">wajib diisi</span>
                </label>
                <input
                  id="session-title"
                  type="text"
                  required
                  aria-required="true"
                  placeholder="Misal: Atomic Habits atau Dasar Perpajakan"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm"
                />
              </div>

              {category === 'baca' && (
                <div>
                  <label htmlFor="session-page" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Halaman terakhir dibaca
                  </label>
                  <input
                    id="session-page"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="Misal: 74"
                    value={sessionLastPage}
                    onChange={(e) => setSessionLastPage(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm font-mono"
                  />
                </div>
              )}

              <div>
                <label htmlFor="session-takeaway" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  1 hal yang dipelajari hari ini <span className="text-rose-500" aria-hidden="true">*</span>
                  <span className="sr-only">wajib diisi</span>
                </label>
                <textarea
                  id="session-takeaway"
                  rows={3}
                  required
                  aria-required="true"
                  placeholder="Tuliskan 1 hal yang menarik"
                  value={sessionTakeaway}
                  onChange={(e) => setSessionTakeaway(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-base sm:text-sm"
                />
              </div>

              <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
                Kolom bertanda <span className="text-rose-500">*</span> wajib diisi. "Buang sesi ini"
                tidak menyimpan apa pun.
              </p>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogModalOpen(false);
                    setSecondsRemaining(targetDurationMinutes * 60);
                  }}
                  className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Buang sesi ini
                </button>
                <button
                  type="submit"
                  disabled={isSavingSession || !sessionTitle.trim() || !sessionTakeaway.trim()}
                  className="min-h-[44px] px-5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium disabled:opacity-50"
                >
                  {isSavingSession ? 'Menyimpan...' : 'Simpan catatan dan tuntaskan habit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
