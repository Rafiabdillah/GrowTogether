import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, HeartHandshake, Shuffle, Ticket, X } from 'lucide-react';
import { Agreement } from '../types';
import { useApp } from '../context/AppContext';
import { useDialog } from '../hooks/useDialog';
import { useConfirm } from './ConfirmDialog';

interface SanctionActionModalProps {
  agreement: Agreement;
  onClose: () => void;
}

export const SanctionActionModal: React.FC<SanctionActionModalProps> = ({
  agreement,
  onClose,
}) => {
  const { cloudIdentity, couple, resolveSanction, useJokerCard } = useApp();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [replacementProposal, setReplacementProposal] = useState('');
  const [reliefReason, setReliefReason] = useState('');
  const [formError, setFormError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);
  const { confirm, confirmDialog } = useConfirm();

  // Harus memakai identitas yang sama dengan useJokerCard (uid cloud), bukan
  // id profil lokal — kalau tidak, sisa kartu yang tampil bukan yang dipakai.
  const userJokers =
    cloudIdentity.userId === couple.user1Id ? couple.jokerCardsUser1 : couple.jokerCardsUser2;

  const runAction = async (fn: () => Promise<unknown>, message: string, closeAfter = 1400) => {
    if (isBusy) return;
    setIsBusy(true);
    setFormError('');
    try {
      await fn();
      setDoneMessage(message);
      setIsDone(true);
      setTimeout(() => onClose(), closeAfter);
    } finally {
      setIsBusy(false);
    }
  };

  const handleComplete = () =>
    runAction(
      () => resolveSanction(agreement.id, 'completed'),
      'Sanksi ditandai sudah dijalankan. Pasanganmu menerima konfirmasinya.'
    );

  const handleUseJoker = async () => {
    if (userJokers <= 0 || isBusy) return;
    const ok = await confirm({
      title: 'Pakai satu kartu maaf?',
      message: `Kartu maaf hanya ${userJokers} sisa dan baru terisi ulang bulan depan. Sanksi "${agreement.title}" akan dibatalkan.`,
      confirmLabel: 'Ya, pakai kartu',
      cancelLabel: 'Batal',
    });
    if (!ok) return;
    await runAction(() => useJokerCard(agreement.id), 'Kartu maaf terpakai. Sanksi ini dibatalkan dengan baik.');
  };

  const handleRequestRelief = () => {
    if (!reliefReason.trim()) {
      setFormError('Tuliskan dulu alasanmu meminta keringanan supaya pasangan bisa menimbang.');
      return;
    }
    void runAction(
      () => resolveSanction(agreement.id, 'relief_requested', reliefReason.trim()),
      'Permintaan keringanan terkirim dan menunggu persetujuan pasangan.',
      1800
    );
  };

  const handleSwapChallenge = () => {
    if (!replacementProposal.trim()) {
      setFormError('Isi dulu usulan tantangan penggantinya — usulan kosong tidak bisa dikirim.');
      return;
    }
    void runAction(
      () => resolveSanction(agreement.id, 'swapped', replacementProposal.trim()),
      'Usulan tantangan pengganti terkirim dan menunggu persetujuan pasangan.',
      1800
    );
  };

  return (
    <>
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
            aria-label="Tutup tindakan sanksi"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded-lg text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" aria-hidden="true" />
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
          <div role="status" className="p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {doneMessage.includes('menunggu') ? 'Terkirim ke Pasangan' : 'Aksi Berhasil Diproses'}
            </h4>
            <p className="text-xs text-stone-500">{doneMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Action 1: Tandai Selesai */}
            {!activeAction && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button type="button"
                  onClick={handleComplete}
                  disabled={isBusy}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" aria-hidden="true" />
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
                  disabled={userJokers <= 0 || isBusy}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-colors text-left ${
                    userJokers > 0
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'border-stone-200 dark:border-stone-800 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Ticket className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Pakai Kartu Maaf ({userJokers} sisa)
                    </span>
                    <span className="text-[11px] text-stone-500">Batalkan sanksi ini</span>
                  </div>
                </button>

                {/* Action 3: Minta Keringanan */}
                <button type="button"
                  onClick={() => { setFormError(''); setActiveAction('relief'); }}
                  disabled={isBusy}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors disabled:opacity-50"
                >
                  <HeartHandshake className="w-5 h-5 text-rose-500 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Minta Keringanan
                    </span>
                    <span className="text-[11px] text-stone-500">Ajukan, pasangan yang memutuskan</span>
                  </div>
                </button>

                {/* Action 4: Tukar dengan Tantangan Pengganti */}
                <button type="button"
                  onClick={() => { setFormError(''); setActiveAction('swap'); }}
                  disabled={isBusy}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-left transition-colors disabled:opacity-50"
                >
                  <Shuffle className="w-5 h-5 text-indigo-500 shrink-0" aria-hidden="true" />
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100 block">
                      Tukar Tantangan Baru
                    </span>
                    <span className="text-[11px] text-stone-500">Usulan menunggu persetujuan</span>
                  </div>
                </button>
              </div>
            )}

            {isBusy && (
              <p role="status" className="text-[11px] text-stone-500 dark:text-stone-400">
                Memproses...
              </p>
            )}

            {/* Subform: Minta Keringanan */}
            {activeAction === 'relief' && (
              <div className="space-y-3 pt-2">
                <label htmlFor="relief-reason" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Alasan Meminta Keringanan: <span className="text-rose-500" aria-hidden="true">*</span>
                  <span className="sr-only">wajib diisi</span>
                </label>
                <textarea
                  id="relief-reason"
                  rows={2}
                  value={reliefReason}
                  onChange={(e) => { setReliefReason(e.target.value); setFormError(''); }}
                  aria-invalid={formError && !reliefReason.trim() ? 'true' : undefined}
                  placeholder="Misal: Sedang demam / lembur hingga malam..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-xs"
                />
                {formError && (
                  <p role="alert" className="text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">{formError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button"
                    onClick={() => { setActiveAction(null); setFormError(''); }}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs text-stone-500"
                  >
                    Batal
                  </button>
                  <button type="button"
                    onClick={handleRequestRelief}
                    disabled={isBusy || !reliefReason.trim()}
                    className="min-h-[44px] px-4 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium disabled:opacity-50"
                  >
                    Kirim Permohonan
                  </button>
                </div>
              </div>
            )}

            {/* Subform: Tukar Tantangan */}
            {activeAction === 'swap' && (
              <div className="space-y-3 pt-2">
                <label htmlFor="replacement-proposal" className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Usulkan Tantangan Pengganti: <span className="text-rose-500" aria-hidden="true">*</span>
                  <span className="sr-only">wajib diisi</span>
                </label>
                <input
                  id="replacement-proposal"
                  type="text"
                  value={replacementProposal}
                  onChange={(e) => { setReplacementProposal(e.target.value); setFormError(''); }}
                  aria-invalid={formError && !replacementProposal.trim() ? 'true' : undefined}
                  placeholder="Misal: Buatin sarapan besok pagi"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-xs"
                />
                {formError && (
                  <p role="alert" className="text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">{formError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button"
                    onClick={() => { setActiveAction(null); setFormError(''); }}
                    className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs text-stone-500"
                  >
                    Batal
                  </button>
                  <button type="button"
                    onClick={handleSwapChallenge}
                    disabled={isBusy || !replacementProposal.trim()}
                    className="min-h-[44px] px-4 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium disabled:opacity-50"
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

    {confirmDialog}
    </>
  );
};
