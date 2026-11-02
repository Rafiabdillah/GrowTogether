import React, { useState } from 'react';
import {
  Shield,
  Gift,
  AlertTriangle,
  Plus,
  Ticket,
  PauseCircle,
  PlayCircle,
  Check,
  X,
  Clock,
  Sparkles,
  Info,
  HeartHandshake,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Agreement, AgreementType, AgreementForWhom, AgreementTriggerType } from '../types/index';
import { validateAgreementSafety } from '../lib/safetyFilter';
import { SanctionActionModal } from '../components/SanctionActionModal';
import { useDialog } from '../hooks/useDialog';

export const AgreementsView: React.FC = () => {
  const {
    currentUser,
    partnerUser,
    couple,
    agreements,
    createAgreement,
    approveAgreement,
    rejectAgreement,
    togglePauseAllSanctions,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'sanksi' | 'hadiah'>('sanksi');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const createDialogRef = useDialog<HTMLDivElement>(isCreateModalOpen, () => setIsCreateModalOpen(false));
  const [selectedSanctionForAction, setSelectedSanctionForAction] = useState<Agreement | null>(null);

  // Form State
  const [agreementType, setAgreementType] = useState<AgreementType>('sanksi');
  const [title, setTitle] = useState('');
  const [forWhom, setForWhom] = useState<AgreementForWhom>('both');
  const [triggerType, setTriggerType] = useState<AgreementTriggerType>('broken_streak');
  const [triggerThreshold, setTriggerThreshold] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter agreements by type
  const sanctionList = agreements.filter((a) => a.type === 'sanksi');
  const rewardList = agreements.filter((a) => a.type === 'hadiah');

  // Joker cards for current user
  const userJokers =
    currentUser.id === couple.user1Id ? couple.jokerCardsUser1 : couple.jokerCardsUser2;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const safetyCheck = validateAgreementSafety(title);
    if (!safetyCheck.isSafe) {
      setErrorMessage(safetyCheck.message || 'Teks tidak memenuhi batas aman.');
      return;
    }

    await createAgreement({
      coupleId: couple.id,
      type: agreementType,
      title: title.trim(),
      forWhom,
      creatorId: currentUser.id,
      creatorName: currentUser.displayName,
      status: 'pending_approval',
      partnerApproved: false,
      triggerType,
      triggerThreshold,
      timesTriggered: 0,
      timesCompleted: 0,
      timesPardoned: 0,
    });

    setTitle('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Safe Boundary & Panic Pause Button */}
      <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Brankas Kesepakatan & Sanksi Sehat
            </h2>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed max-w-xl">
            Kesepakatan bersama yang adil dan menyenangkan. Sanksi harus disetujui kedua pihak sebelum aktif. Rasio ideal: minimal 2 Hadiah untuk setiap 1 Sanksi.
          </p>
        </div>

        {/* Joker Cards & Pause Switch */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Kartu Maaf */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-300 dark:border-amber-800/60 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <Ticket className="w-4 h-4 text-amber-500" />
            <span>Kartu Maaf: {userJokers} / 2 bln</span>
          </div>

          {/* Panic Pause Button */}
          <button type="button"
            onClick={togglePauseAllSanctions}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-semibold border transition-all ${
              couple.allSanctionsPaused
                ? 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100'
            }`}
            title="Jeda semua sanksi sepihak kapan saja saat butuh waktu istirahat"
          >
            {couple.allSanctionsPaused ? (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>Lanjutkan Sanksi</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4" />
                <span>Jeda Semua Sanksi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {couple.allSanctionsPaused && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <Info className="w-4 h-4 shrink-0" />
          <span>Semua sanksi sedang dijeda sementara oleh kesepakatan bersama. Tidak ada konsekuensi yang akan terpicu.</span>
        </div>
      )}

      {/* Main Tabs (Sanksi vs Hadiah) */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => setActiveTab('sanksi')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'sanksi'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Sanksi Kesepakatan ({sanctionList.length})</span>
          </button>

          <button type="button"
            onClick={() => setActiveTab('hadiah')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'hadiah'
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Hadiah Bersama / Reward ({rewardList.length})</span>
          </button>
        </div>

        <button type="button"
          onClick={() => {
            setAgreementType(activeTab);
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Buat {activeTab === 'sanksi' ? 'Sanksi' : 'Hadiah'}</span>
        </button>
      </div>

      {/* List Content */}
      {(activeTab === 'sanksi' ? sanctionList : rewardList).length === 0 ? (
        <div className="p-8 rounded-3xl bg-white/70 dark:bg-stone-900/70 border border-dashed border-stone-200 dark:border-stone-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            {activeTab === 'sanksi' ? <Shield className="w-6 h-6" /> : <Gift className="w-6 h-6" />}
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Belum Ada {activeTab === 'sanksi' ? 'Sanksi Kesepakatan' : 'Hadiah Bersama'}
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              {activeTab === 'sanksi'
                ? 'Buat sanksi yang ringan, sehat, dan menyenangkan yang disetujui bersama (contoh: traktir es krim, cuci piring 3 hari).'
                : 'Rayakan pencapaian bersama dengan hadiah manis untuk kalian berdua (contoh: kencan makan malam akhir pekan).'}
            </p>
          </div>

          <div className="pt-2">
            <button type="button"
              onClick={() => {
                setAgreementType(activeTab);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:opacity-90 transition-opacity"
            >
              + Buat {activeTab === 'sanksi' ? 'Sanksi Pertama' : 'Hadiah Pertama'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(activeTab === 'sanksi' ? sanctionList : rewardList).map((item) => {
          const isPendingForPartner =
            item.status === 'pending_approval' && item.creatorId !== currentUser.id;
          const isWaitingMyApproval = isPendingForPartner;

          return (
            <div
              key={item.id}
              className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                item.status === 'triggered'
                  ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900 shadow-sm'
                  : 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 shadow-xs'
              }`}
            >
              <div>
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        : item.status === 'triggered'
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {item.status === 'active'
                      ? '✓ Aktif & Disetujui'
                      : item.status === 'triggered'
                      ? '⚠ Sedang Terpicu'
                      : 'Menunggu Persetujuan'}
                  </span>

                  <span className="text-[11px] text-stone-500">
                    Untuk: {item.forWhom === 'both' ? 'Berdua' : item.forWhom === 'self' ? 'Sendiri' : 'Pasangan'}
                  </span>
                </div>

                {/* Title */}
                <h4 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-2 leading-snug">
                  "{item.title}"
                </h4>

                {/* Trigger rule description */}
                <div className="mt-3 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>
                    Pemicu:{' '}
                    {item.triggerType === 'broken_streak'
                      ? 'Streak bersama putus'
                      : item.triggerType === 'miss_habit_count'
                      ? `Melewatkan habit ${item.triggerThreshold}x seminggu`
                      : 'Target mingguan tidak tercapai'}
                  </span>
                </div>
              </div>

              {/* Action Area */}
              <div className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <span className="text-[11px] text-stone-500">
                  Diusulkan oleh {item.creatorName || 'Pasangan'}
                </span>

                <div className="flex items-center gap-2">
                  {/* If triggered: action button */}
                  {item.status === 'triggered' && (
                    <button type="button"
                      onClick={() => setSelectedSanctionForAction(item)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs"
                    >
                      Buka Aksi Sanksi
                    </button>
                  )}

                  {/* If waiting for current user's approval */}
                  {isWaitingMyApproval && (
                    <>
                      <button type="button"
                        onClick={() => approveAgreement(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Setujui</span>
                      </button>
                      <button type="button"
                        onClick={() => rejectAgreement(item.id)}
                        className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-rose-500"
                        title="Tolak kesepakatan"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* Manual trigger for testing */}
                  {item.status === 'active' && item.type === 'sanksi' && (
                    <button type="button"
                      onClick={() => setSelectedSanctionForAction(item)}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Simulasi Terpicu
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Modal Buat Kesepakatan Baru */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={createDialogRef} role="dialog" aria-modal="true" aria-label="Buat kesepakatan" className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Buat {agreementType === 'sanksi' ? 'Sanksi Sehat' : 'Hadiah Bersama'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              {agreementType === 'sanksi'
                ? 'Sanksi harus ringan, menyenangkan, dan harus disetujui pasanganmu sebelum aktif.'
                : 'Hadiah untuk merayakan kerja keras dan konsistensi kalian berdua.'}
            </p>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Isi Kesepakatan (Teks Bebas)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder={
                    agreementType === 'sanksi'
                      ? 'Misal: Traktir es krim gelato sepulang kerja'
                      : 'Misal: Kencan kuliner akhir pekan'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Dikenakan Untuk
                  </label>
                  <select
                    value={forWhom}
                    onChange={(e) => setForWhom(e.target.value as AgreementForWhom)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs"
                  >
                    <option value="both">Keduanya (Siapa yang lalai)</option>
                    <option value="self">Diri Sendiri</option>
                    <option value="partner">Pasangan (Perlu Disetujui)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Aturan Pemicu
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value as AgreementTriggerType)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs"
                  >
                    <option value="broken_streak">Streak Bersama Putus</option>
                    <option value="miss_habit_count">Melewatkan Habit</option>
                    <option value="weekly_goal_miss">Target Mingguan Kurang</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90"
                >
                  Kirim ke Pasangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Dialog for Triggered Sanction */}
      {selectedSanctionForAction && (
        <SanctionActionModal
          agreement={selectedSanctionForAction}
          onClose={() => setSelectedSanctionForAction(null)}
        />
      )}
    </div>
  );
};
