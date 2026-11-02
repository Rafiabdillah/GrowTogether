import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, HeartHandshake, Shuffle, Ticket, X, Sparkles } from 'lucide-react';
import { Agreement } from '../types';
import { useApp } from '../context/AppContext';
import { useDialog } from '../hooks/useDialog';

interface SanctionActionModalProps {
  agreement: Agreement;
  onClose: () => void;
}

export const SanctionActionModal: React.FC<SanctionActionModalProps> = ({
  agreement,
  onClose,
}) => {
  const { currentUser, partnerUser, couple, resolveSanction, useJokerCard } = useApp();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [replacementProposal, setReplacementProposal] = useState('');
  const [reliefReason, setReliefReason] = useState('');
  const [isDone, setIsDone] = useState(false);
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);

  // Joker card remaining for current user
  const userJokers =
    currentUser.id === couple.user1Id ? couple.jokerCardsUser1 : couple.jokerCardsUser2;

  const handleComplete = async () => {
    await resolveSanction(agreement.id, 'completed');
    setIsDone(true);
    setTimeout(() => onClose(), 1200);
  };

  const handleUseJoker = async () => {
    if (userJokers <= 0) return;
    await useJokerCard(agreement.id);
    setIsDone(true);
    setTimeout(() => onClose(), 1200);
  };

  const handleRequestRelief = async () => {
    await resolveSanction(agreement.id, 'relief_requested', reliefReason);
    setIsDone(true);
    setTimeout(() => onClose(), 1200);
  };

  const handleSwapChallenge = async () => {
    if (!replacementProposal.trim()) return;
    await resolveSanction(agreement.id, 'swapped', replacementProposal.trim());
    setIsDone(true);
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Tindakan sanksi" className="w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Sanksi Kesepakatan Terpicu
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Komitmen yang telah disepakati bersama
              </p>
            </div>
          </div>
          <button type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sanction Title Card */}
        <div className="my-5 p-4 rounded-2xl bg-amber-50 dark:bg-stone-900 border border-rose-200/60 dark:border-rose-900/40">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Tugas Sanksi:
          </span>
          <p className="text-base font-bold text-stone-900 dark:text-stone-100 mt-1 leading-snug">
            "{agreement.title}"
          </p>
          <div className="mt-2 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
            <span>Diusulkan oleh: {agreement.creatorName || 'Pasangan'}</span>
            <span>·</span>
            <span>Status: Terpicu</span>
          </div>
        </div>

        {isDone ? (
          <div className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Aksi Berhasil Diproses!
            </h4>
            <p className="text-xs text-stone-500">Pembaruan telah dikirimkan ke pasanganmu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Action 1: Tandai Selesai */}
            {!activeAction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button type="button"
                  onClick={handleComplete}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Tandai Sudah Dijalankan
                    </span>
                    <span className="text-[11px] text-stone-500">Kirim konfirmasi ke pasangan</span>
                  </div>
                </button>

                {/* Action 2: Pakai Kartu Maaf */}
                <button type="button"
                  onClick={handleUseJoker}
                  disabled={userJokers <= 0}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-colors text-left ${
                    userJokers > 0
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'border-stone-200 dark:border-stone-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Ticket className="w-5 h-5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Pakai Kartu Maaf ({userJokers} sisa)
                    </span>
                    <span className="text-[11px] text-stone-500">Batalkan sanksi ini</span>
                  </div>
                </button>

                {/* Action 3: Minta Keringanan */}
                <button type="button"
                  onClick={() => setActiveAction('relief')}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors"
                >
                  <HeartHandshake className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Minta Keringanan
                    </span>
                    <span className="text-[11px] text-stone-500">Ajukan alasan ke pasangan</span>
                  </div>
                </button>

                {/* Action 4: Tukar dengan Tantangan Pengganti */}
                <button type="button"
                  onClick={() => setActiveAction('swap')}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors"
                >
                  <Shuffle className="w-5 h-5 text-indigo-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Tukar Tantangan Baru
                    </span>
                    <span className="text-[11px] text-stone-500">Usulkan aktivitas lain</span>
                  </div>
                </button>
              </div>
            )}

            {/* Subform: Minta Keringanan */}
            {activeAction === 'relief' && (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Alasan Meminta Keringanan:
                </label>
                <textarea
                  rows={2}
                  value={reliefReason}
                  onChange={(e) => setReliefReason(e.target.value)}
                  placeholder="Misal: Sedang demam / lembur hingga malam..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button type="button"
                    onClick={() => setActiveAction(null)}
                    className="px-3 py-1.5 rounded-xl text-xs text-stone-500"
                  >
                    Batal
                  </button>
                  <button type="button"
                    onClick={handleRequestRelief}
                    className="px-4 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium"
                  >
                    Kirim Permohonan
                  </button>
                </div>
              </div>
            )}

            {/* Subform: Tukar Tantangan */}
            {activeAction === 'swap' && (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Usulkan Tantangan Pengganti:
                </label>
                <input
                  type="text"
                  value={replacementProposal}
                  onChange={(e) => setReplacementProposal(e.target.value)}
                  placeholder="Misal: Buatin sarapan besok pagi"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button type="button"
                    onClick={() => setActiveAction(null)}
                    className="px-3 py-1.5 rounded-xl text-xs text-stone-500"
                  >
                    Batal
                  </button>
                  <button type="button"
                    onClick={handleSwapChallenge}
                    className="px-4 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium"
                  >
                    Ajukan Perubahan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
