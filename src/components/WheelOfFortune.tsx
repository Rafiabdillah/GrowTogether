import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, RotateCw, Trophy } from 'lucide-react';
import { Agreement } from '../types';
import confetti from 'canvas-confetti';
import { sound } from '../lib/audio';
import { useDialog } from '../hooks/useDialog';

interface WheelOfFortuneProps {
  agreements: Agreement[];
  onClose: () => void;
}

export const WheelOfFortune: React.FC<WheelOfFortuneProps> = ({ agreements, onClose }) => {
  const [filterType, setFilterType] = useState<'all' | 'hadiah' | 'sanksi'>('hadiah');
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Agreement | null>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (spinTimerRef.current !== null) window.clearTimeout(spinTimerRef.current);
  }, []);

  // Eligible active agreements
  const activeItems = agreements.filter(
    (a) => a.status === 'active' && (filterType === 'all' || a.type === filterType)
  );

  const sliceAngle = activeItems.length > 0 ? 360 / activeItems.length : 360;
  const colors = ['#FF7A64', '#4E8B73', '#EBB042', '#8B5CF6', '#3B82F6', '#EC4899'];
  const wheelBackground =
    activeItems.length > 0
      ? `conic-gradient(${activeItems
          .map(
            (_, idx) =>
              `${colors[idx % colors.length]} ${idx * sliceAngle}deg ${(idx + 1) * sliceAngle}deg`
          )
          .join(', ')})`
      : undefined;

  const handleFilterChange = (type: 'all' | 'hadiah' | 'sanksi') => {
    if (isSpinning) return;
    setFilterType(type);
    setSelectedResult(null);
  };

  const handleSpin = () => {
    if (activeItems.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setSelectedResult(null);

    const randomIndex = Math.floor(Math.random() * activeItems.length);
    const chosen = activeItems[randomIndex];

    // The pointer sits at the top (0°). A slice centre must land there, so the
    // wheel turns to the slice centre offset plus a few full rotations.
    const chosenCentre =
      activeItems.length === 1 ? 0 : randomIndex * sliceAngle + sliceAngle / 2;
    const desiredMod = (360 - chosenCentre + 360) % 360;
    const currentMod = ((rotationAngle % 360) + 360) % 360;
    const alignmentDelta = (desiredMod - currentMod + 360) % 360;
    const extraRotations = (5 + Math.floor(Math.random() * 4)) * 360;
    const targetAngle = rotationAngle + extraRotations + alignmentDelta;

    setRotationAngle(targetAngle);

    if (spinTimerRef.current !== null) window.clearTimeout(spinTimerRef.current);
    spinTimerRef.current = window.setTimeout(() => {
      setIsSpinning(false);
      setSelectedResult(chosen);
      sound.playHabitComplete();
      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
      });
    }, 3200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Roda kesepakatan" className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100 flex flex-col items-center">
        
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Roda Keberuntungan Pasangan
            </h3>
          </div>
          <button type="button"
            onClick={onClose}
            aria-label="Tutup roda keberuntungan"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Filter Toggle */}
        <div role="group" aria-label="Jenis kesepakatan di roda" className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl my-4 text-xs font-semibold">
          <button type="button"
            onClick={() => handleFilterChange('hadiah')}
            aria-pressed={filterType === 'hadiah'}
            className={`px-3 py-1.5 min-h-[44px] rounded-lg transition-colors ${
              filterType === 'hadiah'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-500'
            }`}
          >
            Pilih Hadiah
          </button>
          <button type="button"
            onClick={() => handleFilterChange('sanksi')}
            aria-pressed={filterType === 'sanksi'}
            className={`px-3 py-1.5 min-h-[44px] rounded-lg transition-colors ${
              filterType === 'sanksi'
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                : 'text-stone-500'
            }`}
          >
            Pilih Sanksi
          </button>
        </div>

        {/* The Animated Wheel */}
        <div className="relative w-64 h-64 my-2 flex items-center justify-center">
          {/* Wheel Pointer Pin at Top */}
          <div className="absolute -top-3 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-500 drop-shadow-md" />

          {/* Rotating Wheel Disc */}
          <div
            className="w-full h-full rounded-full border-4 border-amber-300 dark:border-amber-700 overflow-hidden relative shadow-lg"
            style={{
              transform: `rotate(${rotationAngle}deg)`,
              transition: isSpinning ? 'transform 3.2s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none',
              background: wheelBackground,
            }}
          >
            {activeItems.length > 0 ? (
              activeItems.map((item, idx) => {
                const midAngle = activeItems.length === 1 ? 0 : idx * sliceAngle + sliceAngle / 2;
                const rad = (midAngle * Math.PI) / 180;
                const x = 50 + Math.sin(rad) * 31;
                const y = 50 - Math.cos(rad) * 31;
                return (
                  <div
                    key={item.id}
                    className="absolute w-16 sm:w-20 text-center pointer-events-none"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                    }}
                  >
                    <span className="block text-[10px] font-bold text-white leading-tight line-clamp-2 drop-shadow-sm">
                      {item.title}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-100 dark:bg-stone-800 text-xs text-stone-500 p-4 text-center">
                Belum ada kesepakatan aktif
              </div>
            )}
          </div>

          {/* Center Hub */}
          <div className="absolute w-12 h-12 rounded-full bg-white dark:bg-stone-900 border-2 border-amber-400 flex items-center justify-center shadow-md z-10 pointer-events-none">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        {/* Selected Result Banner */}
        {selectedResult && (
          <div role="status" className="w-full my-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-300 dark:border-amber-700/60 text-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Hasil Pilihan Keberuntungan:
            </span>
            <p className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1">
              "{selectedResult.title}"
            </p>
          </div>
        )}

        {/* Spin Button */}
        <button type="button"
          onClick={handleSpin}
          disabled={isSpinning || activeItems.length === 0}
          className={`w-full mt-2 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
            isSpinning || activeItems.length === 0
              ? 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-700 text-white active:scale-98'
          }`}
        >
          <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>{isSpinning ? 'Memutar Roda...' : 'Putar Roda Sekarang!'}</span>
        </button>

        {activeItems.length === 0 && (
          <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400 text-center">
            Belum ada {filterType === 'hadiah' ? 'hadiah' : 'sanksi'} aktif. Buat dan setujui
            kesepakatan dulu di tab Kesepakatan agar roda punya pilihan.
          </p>
        )}
      </div>
    </div>
  );
};
