import React, { useState } from 'react';
import { Moon, X, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTodayDateString } from '../data/mockData';
import { useDialog } from '../hooks/useDialog';

interface NightlyCheckInModalProps {
  onClose: () => void;
}

export const NightlyCheckInModal: React.FC<NightlyCheckInModalProps> = ({ onClose }) => {
  const { currentUser, partnerUid, partnerUser, couple, checkins, recordCheckIn } = useApp();
  const todayStr = getTodayDateString();

  // Check if current user already checked in today
  const existingTodayCheckIn = checkins.find(
    (c) => c.userId === currentUser.id && c.date === todayStr
  );
  // Partner's checkin today
  const partnerTodayCheckIn = checkins.find(
    (c) => c.userId === partnerUid && c.date === todayStr && c.isShared
  );

  const [mood, setMood] = useState<number>(existingTodayCheckIn?.mood ?? 5);
  const [gratitude, setGratitude] = useState<string>(existingTodayCheckIn?.gratitude ?? '');
  const [isShared, setIsShared] = useState<boolean>(existingTodayCheckIn?.isShared ?? true);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!gratitude.trim()) {
      setFormError('Tuliskan satu hal yang kamu syukuri hari ini — kolom ini wajib diisi.');
      return;
    }
    // Satu check-in per hari: dua ketukan harus jadi satu tulisan, bukan dua +25 XP.
    if (isSaving) return;

    setIsSaving(true);
    try {
      await recordCheckIn({
        coupleId: couple.id,
        userId: currentUser.id,
        userName: currentUser.displayName,
        date: todayStr,
        mood,
        gratitude: gratitude.trim(),
        isShared,
      });

      setIsSubmitted(true);
      setTimeout(() => onClose(), 1400);
    } finally {
      setIsSaving(false);
    }
  };

  const moodLabels = [
    { score: 1, emoji: '🌧️', label: 'Melelahkan' },
    { score: 2, emoji: '⛅', label: 'Agak Berat' },
    { score: 3, emoji: '🌤️', label: 'Cukup Baik' },
    { score: 4, emoji: '🌸', label: 'Menyenangkan' },
    { score: 5, emoji: '✨', label: 'Luar Biasa' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Check-in malam" className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100 max-h-[90dvh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {existingTodayCheckIn ? 'Ubah Check-in Malam' : 'Check-in Malam Pasangan'}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {existingTodayCheckIn
                  ? 'Kamu sudah check-in hari ini. Perbarui refleksimu kapan saja.'
                  : '1 menit kehangatan sebelum tidur'}
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            aria-label="Tutup check-in malam"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* If Partner Already Checked In: Preview */}
        {partnerTodayCheckIn && (
          <div className="my-4 p-4 rounded-2xl bg-amber-50 dark:bg-stone-900 border border-emerald-200/60 dark:border-emerald-800/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                Refleksi {partnerUser?.displayName.split(' ')[0]} Hari Ini:
              </span>
              <span className="text-xs font-mono font-bold">Mood: {partnerTodayCheckIn.mood}/5 ⭐</span>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-200 mt-1 italic leading-relaxed">
              "{partnerTodayCheckIn.gratitude}"
            </p>
          </div>
        )}

        {isSubmitted ? (
          <div role="status" className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {existingTodayCheckIn ? 'Check-in Malam Diperbarui!' : 'Check-in Malam Tersimpan!'}
            </h4>
            <p className="text-xs text-stone-500">
              Semoga tidurmu nyenyak dan besok bangun dengan semangat baru bersama pasangan.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-5">
            {/* 1. Mood Picker */}
            <div role="group" aria-labelledby="checkin-mood-label">
              <span id="checkin-mood-label" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2">
                1. Bagaimana perasaan hatimu secara umum hari ini?
              </span>
              <div className="grid grid-cols-5 gap-2">
                {moodLabels.map((m) => (
                  <button
                    key={m.score}
                    type="button"
                    aria-pressed={mood === m.score}
                    aria-label={`Mood ${m.score} dari 5: ${m.label}`}
                    onClick={() => setMood(m.score)}
                    className={`py-2 px-1 min-h-[44px] rounded-2xl border flex flex-col items-center justify-center transition-all ${
                      mood === m.score
                        ? 'bg-amber-500/15 border-amber-400 text-stone-900 dark:text-stone-100 shadow-xs scale-105'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-stone-500'
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">{m.emoji}</span>
                    <span className="text-[11px] font-medium mt-1 text-center truncate w-full">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Gratitude text */}
            <div>
              <label htmlFor="checkin-gratitude" className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                2. Satu hal berkesan yang kamu syukuri hari ini:{' '}
                <span className="text-rose-500" aria-hidden="true">*</span>
                <span className="sr-only">wajib diisi</span>
              </label>
              <textarea
                id="checkin-gratitude"
                rows={3}
                required
                aria-required="true"
                aria-invalid={formError ? 'true' : undefined}
                maxLength={200}
                placeholder="Misal: Ditemani teh hangat saat lelah bekerja, atau obrolan santai di meja makan..."
                value={gratitude}
                onChange={(e) => {
                  setGratitude(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-xs focus:ring-2 focus:ring-amber-500"
              />
              {formError && (
                <p role="alert" className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {formError}
                </p>
              )}
              <span className="text-[11px] text-stone-500 block text-right">
                {gratitude.length}/200 karakter
              </span>
            </div>

            {/* Share toggle */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Bagikan ke pasangan agar bisa dibaca</span>
              </label>
            </div>

            {/* Submit button */}
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-[44px] px-5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {isSaving
                  ? 'Menyimpan...'
                  : existingTodayCheckIn
                    ? 'Perbarui Refleksi'
                    : 'Simpan Refleksi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
