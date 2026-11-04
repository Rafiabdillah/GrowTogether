import React, { useState } from 'react';
import {
  Sparkles,
  Users,
  Calendar,
  FastForward,
  PlusCircle,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Wand2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTodayDateString } from '../data/mockData';

export const CoupleSimulatorToolbar: React.FC = () => {
  const {
    currentUser,
    partnerUser,
    couple,
    selectedDate,
    setSelectedDate,
    switchSimulatedUser,
    triggerSimulatedHighFive,
    advanceSimulatedDay,
    addCoupleXP,
    showSimulatorToolbar,
    toggleSimulatorToolbar,
    isDemoMode,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const realToday = getTodayDateString();
  const isDateShifted = selectedDate !== realToday;

  if (!showSimulatorToolbar || !isDemoMode) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40 select-none">
      {isOpen ? (
        <div className="p-3.5 rounded-3xl bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-800 shadow-2xl w-72 text-stone-800 dark:text-stone-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Wand2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold">Simulator Pasangan</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button"
                onClick={toggleSimulatorToolbar}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[11px] text-stone-500 hover:text-stone-600 px-1.5 py-0.5 rounded hover:bg-stone-100 dark:hover:bg-stone-800"
                title="Sembunyikan toolbar ini (bisa diaktifkan lagi di Pengaturan)"
              >
                Tutup
              </button>
              <button type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Ciutkan toolbar simulator"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-700"
              >
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Quick Actions List */}
          <div className="mt-3 space-y-2 text-xs">
            {/* 1. Switch User */}
            <button type="button"
              onClick={switchSimulatedUser}
              className="w-full min-h-[44px] flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-stone-500" />
                <span>Ganti Akun:</span>
              </div>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {currentUser.displayName.split(' ')[0]} ⇄ {partnerUser?.displayName.split(' ')[0]}
              </span>
            </button>

            {/* 2. Advance Date / Shift Day */}
            <div className="flex items-center gap-1.5">
              <button type="button"
                onClick={advanceSimulatedDay}
                className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] py-2 px-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors"
                title="Maju 1 hari untuk mengetes streak dan reset checklist harian"
              >
                <FastForward className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-medium">+1 Hari</span>
              </button>

              {isDateShifted && (
                <button type="button"
                  onClick={() => setSelectedDate(realToday)}
                  className="flex items-center gap-1 min-h-[44px] py-2 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors"
                  title="Kembali ke hari nyata ini"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Tgl</span>
                </button>
              )}
            </div>

            {/* Current simulated date indicator */}
            <div className="px-2 py-1 text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
              <span>Tanggal Aktif:</span>
              <span className="font-mono font-bold text-stone-700 dark:text-stone-300">
                {selectedDate} {isDateShifted && '(Simulasi)'}
              </span>
            </div>

            {/* 3. High-Five Simulation */}
            <button type="button"
              onClick={triggerSimulatedHighFive}
              className="w-full flex items-center justify-center gap-1.5 min-h-[44px] py-2 px-3 rounded-xl bg-amber-50 dark:bg-stone-900 border border-amber-300/60 dark:border-amber-700/60 hover:opacity-90 font-semibold text-amber-800 dark:text-amber-200 transition-all shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Simulasi High-Five & Konfeti</span>
            </button>

            {/* 4. Add Couple XP */}
            <button type="button"
              onClick={() => addCoupleXP(100)}
              className="w-full flex items-center justify-center gap-1.5 min-h-[44px] py-2 px-3 rounded-xl bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 transition-colors font-medium text-stone-700 dark:text-stone-300"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>+100 XP Pasangan ({couple.levelXp} XP)</span>
            </button>
          </div>
        </div>
      ) : (
        <button type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 min-h-[44px] px-3.5 py-2 rounded-full bg-stone-900/90 dark:bg-stone-100/90 text-white dark:text-stone-900 text-xs font-semibold shadow-lg hover:scale-105 active:scale-95 transition-transform border border-white/20 dark:border-stone-800"
          title="Buka Simulator Pasangan untuk Pengujian Cepat"
        >
          <Wand2 className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
          <span>Simulasi Pasangan</span>
          <ChevronUp className="w-3 h-3 text-stone-500" />
        </button>
      )}
    </div>
  );
};
