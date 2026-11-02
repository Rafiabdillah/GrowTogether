import React from 'react';
import { Sparkles, X, Check, Lock, Coins, Trees, Palmtree } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ISLAND_DECORATIONS } from '../data/mockData';
import { IslandDecorationId } from '../types';
import { useDialog } from '../hooks/useDialog';

interface DecorationShopModalProps {
  onClose: () => void;
}

export const DecorationShopModal: React.FC<DecorationShopModalProps> = ({ onClose }) => {
  const { couple, unlockDecoration } = useApp();
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);

  const handleUnlock = async (id: IslandDecorationId, cost: number) => {
    if (couple.levelXp < cost) return;
    await unlockDecoration(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Toko dekorasi taman" className="w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100 max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Trees className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Toko Dekorasi Pulau Kita
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Beli dekorasi 3D pulau impian berdua memakai XP akumulasi kebiasaan
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current XP Balance Banner */}
        <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-stone-900 border border-amber-200/60 dark:border-stone-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">XP Pasangan Saat Ini</p>
              <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                {couple.levelXp} XP <span className="text-xs font-normal text-stone-500">· Level {couple.levelNumber}</span>
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/80 dark:bg-stone-900/80 font-semibold text-stone-600 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700">
            {couple.unlockedDecorations.length} dari {ISLAND_DECORATIONS.length} Terpasang
          </span>
        </div>

        {/* Decorations Grid */}
        <div className="mt-4 space-y-3">
          {ISLAND_DECORATIONS.map((item) => {
            const isUnlocked = couple.unlockedDecorations.includes(item.id);
            const canAfford = couple.levelXp >= item.xpCost;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40'
                    : 'bg-stone-50/70 dark:bg-stone-850/60 border-stone-200/70 dark:border-stone-800'
                }`}
              >
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700 flex items-center justify-center text-2xl shadow-xs shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {item.name}
                      </h4>
                      {isUnlocked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                          <Check className="w-2.5 h-2.5" /> Terpasang di Pulau
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isUnlocked ? (
                    <button
                      disabled
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-100/60 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800 cursor-default"
                    >
                      Aktif
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => handleUnlock(item.id, item.xpCost)}
                      disabled={!canAfford}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        canAfford
                          ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:scale-102 shadow-xs cursor-pointer'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-600 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Buka {item.xpCost} XP</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>{item.xpCost} XP</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <p className="text-[11px] text-stone-500 dark:text-stone-400 text-center mt-5">
          Tiap habit yang diselesaikan berdua menyumbang +15 XP. Sesi fokus dan streak mingguan memberikan bonus ekstra!
        </p>
      </div>
    </div>
  );
};
