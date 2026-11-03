import React, { useEffect, useState } from 'react';
import {
  X,
  Heart,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Shield,
  Eye,
  EyeOff,
  LogOut,
  Download,
  Smartphone,
  Monitor,
  ArrowRightLeft,
  Trash2,
  AlertTriangle,
  RefreshCw,
  UserMinus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ColorTheme } from '../types';
import { useDialog } from '../hooks/useDialog';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { friendlyAccountError } from '../lib/authErrors';
import { explainSyncEvent } from '../lib/syncBus';

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy clipboard path below.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOnboarding: () => void;
  /** Bumped by the sync banner to jump straight to the diagnostics tab. */
  syncTabSignal?: number;
}

const COLOR_THEMES: { id: ColorTheme; label: string; colorClass: string; bgClass: string }[] = [
  { id: 'coral', label: 'Coral Mawar', colorClass: 'text-rose-500', bgClass: 'bg-rose-500' },
  { id: 'teal', label: 'Teal Samudra', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500' },
  { id: 'amber', label: 'Amber Surya', colorClass: 'text-amber-500', bgClass: 'bg-amber-500' },
  { id: 'indigo', label: 'Indigo Senja', colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenOnboarding,
  syncTabSignal = 0,
}) => {
  const {
    currentUser,
    partnerUser,
    couple,
    authUser,
    isDemoMode,
    exitDemoMode,
    switchAccount,
    deleteAccount,
    leaveCouple,
    updateUserProfile,
    pairWithCode,
    showSimulatorToolbar,
    toggleSimulatorToolbar,
    resetToEmptyState,
    loadDemoData,
    syncEvents,
    partnerUid,
    cloudIdentity,
    runSyncTest,
    rebuildLocalCache,
    habits,
    reactions,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'pair' | 'install' | 'preferences' | 'data' | 'sync'
  >('profile');
  const [syncTest, setSyncTest] = useState<{ ok: boolean; detail: string } | null>(null);
  const [syncTesting, setSyncTesting] = useState(false);
  const [syncReportCopied, setSyncReportCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const { isInstallable, isInstalled, isIOS, isInAppBrowser, install } = usePWAInstall();
  const [partnerInputCode, setPartnerInputCode] = useState('');
  const [pairError, setPairError] = useState('');
  const [pairSuccess, setPairSuccess] = useState(false);

  const [editName, setEditName] = useState(currentUser.displayName);
  const [editTheme, setEditTheme] = useState<ColorTheme>(currentUser.colorTheme);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const isConnected = !!partnerUid;
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    if (syncTabSignal > 0) setActiveTab('sync');
  }, [syncTabSignal]);

  useEffect(() => {
    if (isOpen) {
      setEditName(currentUser.displayName);
      setEditTheme(currentUser.colorTheme);
      setShowResetConfirm(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setShowLeaveConfirm(false);
      setLeaveError('');
      setAccountBusy(false);
      setAccountError('');
      setPairError('');
      setPairSuccess(false);
    }
  }, [isOpen, currentUser.id, currentUser.displayName, currentUser.colorTheme]);

  // The pair needs to see, without opening a developer console, whether their
  // account and room actually line up — that is what "sinkron tapi kosong" means.
  const myHabitCount = habits.filter((h) => h.ownerId === cloudIdentity.userId).length;
  const partnerHabitCount = habits.filter((h) => h.ownerId === partnerUid).length;
  const isMemberOfRoom =
    !!cloudIdentity.coupleId &&
    (couple.user1Id === cloudIdentity.userId || couple.user2Id === cloudIdentity.userId);
  const syncRows: { label: string; value: string; bad?: boolean }[] = [
    { label: 'Sesi perangkat', value: authUser?.uid.slice(0, 8) || 'belum ada sesi' },
    {
      label: 'Ruang bersama',
      value: cloudIdentity.coupleId || '(kosong)',
      bad: !cloudIdentity.coupleId,
    },
    {
      label: 'Posisi di ruang',
      value: isMemberOfRoom
        ? couple.user1Id === cloudIdentity.userId
          ? 'anggota (pemilik ruang)'
          : 'anggota (slot kedua)'
        : 'tidak terdaftar di ruang ini',
      bad: !isMemberOfRoom,
    },
    {
      label: 'Pasangan',
      value: partnerUser?.displayName || (partnerUid ? 'sedang dimuat…' : 'belum terhubung'),
      bad: !partnerUid,
    },
    { label: 'Habit kamu', value: `${myHabitCount}`, bad: myHabitCount === 0 },
    {
      label: 'Habit pasangan yang terlihat',
      value: `${partnerHabitCount}`,
      bad: partnerHabitCount === 0,
    },
    { label: 'Reaksi tersinkron', value: `${reactions.length}` },
  ];

  const handleCopySyncReport = async () => {
    const report = [
      `Akun: ${authUser?.email ?? '-'} (${cloudIdentity.userId || '-'})`,
      ...syncRows.map((row) => `${row.label}: ${row.value}`),
      ...syncEvents
        .slice(0, 20)
        .map(
          (event) =>
            `${new Date(event.at).toISOString()} ${event.kind} ${event.target} ${
              event.ok ? 'ok' : event.message ?? 'gagal'
            }`
        ),
    ].join('\n');
    const copied = await copyText(report);
    setSyncReportCopied(copied);
    if (copied) setTimeout(() => setSyncReportCopied(false), 2000);
  };

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await updateUserProfile(currentUser.id, {
      displayName: editName.trim(),
      colorTheme: editTheme,
    });
    onClose();
  };

  const handleCopyCode = () => {
    const code = currentUser.inviteCode;
    if (!code) return;
    void copyText(code).then((ok) => {
      if (ok) {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
      } else {
        setPairError('Gagal menyalin. Salin kode secara manual.');
      }
    });
  };

  const handleCopyLink = () => {
    void copyText(window.location.href).then((ok) => {
      if (ok) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    });
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairError('');
    setPairSuccess(false);
    if (!partnerInputCode.trim()) return;

    try {
      const success = await pairWithCode(partnerInputCode.trim().toUpperCase());
      if (success) {
        setPairSuccess(true);
        setPartnerInputCode('');
        setTimeout(() => {
          setPairSuccess(false);
          onClose();
        }, 1500);
      } else {
        setPairError(
          'Kode tidak ditemukan. Pastikan pasangan sudah menekan "Buat Ruang Baru" dan bagikan kode terbaru.'
        );
      }
    } catch {
      setPairError('Gagal menghubungkan. Periksa koneksi lalu coba lagi.');
    }
  };

  const handleExitDemo = () => {
    onClose();
    exitDemoMode();
  };

  const handleSwitchAccount = async () => {
    setAccountError('');
    setAccountBusy(true);
    try {
      await switchAccount();
      onClose();
    } catch (err) {
      setAccountError(friendlyAccountError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'HAPUS') return;
    setAccountError('');
    setAccountBusy(true);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      onClose();
    } catch (err) {
      setAccountError(friendlyAccountError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleLeaveCouple = async () => {
    setLeaveError('');
    setAccountBusy(true);
    try {
      await leaveCouple();
      setShowLeaveConfirm(false);
      onClose();
    } catch (err) {
      setLeaveError(
        err instanceof Error ? err.message : 'Gagal keluar dari pasangan. Coba lagi.'
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const handleConfirmReset = () => {
    resetToEmptyState();
    setShowResetConfirm(false);
    onClose();
  };

  const handleLoadDemo = () => {
    loadDemoData();
    setShowResetConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-white dark:bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
      >
        <div className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 id="settings-title" className="text-base font-bold text-stone-900 dark:text-stone-100 leading-none">
                Pengaturan pasangan
              </h3>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1">
                Kelola profil, kode pasangan, dan preferensi aplikasi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label="Bagian pengaturan" className="flex border-b border-stone-100 dark:border-stone-800 px-6 pt-2 gap-4 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
            className={`min-h-[44px] transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Profil Kamu
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pair'}
            onClick={() => setActiveTab('pair')}
            className={`min-h-[44px] transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'pair'
                ? 'border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Hubungkan Pasangan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sync'}
            onClick={() => setActiveTab('sync')}
            className={`min-h-[44px] transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <span className="flex items-center gap-1.5">
              Sinkronisasi
              {syncEvents.some((event) => !event.ok) && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden="true" />
              )}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'preferences'}
            onClick={() => setActiveTab('preferences')}
            className={`min-h-[44px] transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'preferences'
                ? 'border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Tampilan & Uji Coba
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'install'}
            onClick={() => setActiveTab('install')}
            className={`min-h-[44px] transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'install'
                ? 'border-amber-700 text-amber-800 dark:text-amber-300'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Instal Aplikasi
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
            className={`min-h-[44px] transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'data'
                ? 'border-rose-700 text-rose-800 dark:text-rose-300'
                : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Kelola Data
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label htmlFor="edit-name" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                  Nama panggilan kamu
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Misal: Rama, Rian, atau Dinda"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-base sm:text-sm"
                />
              </div>

              <div>
                <span id="theme-label" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                  Warna aksen karakter
                </span>
                <div role="group" aria-labelledby="theme-label" className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
                  {COLOR_THEMES.map((theme) => {
                    const isSelected = editTheme === theme.id;
                    return (
                      <button
                        type="button"
                        key={theme.id}
                        onClick={() => setEditTheme(theme.id)}
                        aria-pressed={isSelected}
                        className={`min-h-[44px] p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 text-stone-900 dark:text-stone-100 font-semibold'
                            : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${theme.bgClass}`} />
                        <span className="text-xs">{theme.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Pasangan */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <div>
                    <span className="text-xs font-bold block text-stone-800 dark:text-stone-200">
                      Pasangan Terhubung:
                    </span>
                    <span className="text-xs text-stone-500">
                      {partnerUser?.displayName || 'Belum terhubung'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('pair')}
                  className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
                >
                  Ubah / Sambung
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold text-xs hover:opacity-90 active:scale-98 transition-all shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          )}

          {activeTab === 'pair' && (
            <div className="space-y-5">
              {isConnected && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <Heart className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold">Sudah terhubung</h4>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                    Kalian berdua berbagi taman yang sama dengan{' '}
                    <strong>{partnerUser?.displayName || 'pasanganmu'}</strong>. Tidak perlu
                    memasukkan kode lagi.
                  </p>
                </div>
              )}

              {/* Box Kode Sendiri */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Kode ruangmu
                </span>
                <p className="text-xs text-stone-700 dark:text-stone-300 mb-3">
                  {isConnected
                    ? 'Kode ini sudah dipakai untuk menghubungkan kalian.'
                    : 'Bagikan kode ini ke pasanganmu agar bisa terhubung ke taman yang sama.'}
                </p>

                <div className="flex items-center gap-2">
                  <div className="flex-1 py-2.5 px-3.5 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-center font-mono text-lg font-extrabold tracking-widest text-amber-700 dark:text-amber-300">
                    {currentUser.inviteCode || '-'}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="min-h-[44px] flex items-center gap-1.5 px-3.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs transition-colors"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              {/* Form Masukkan Kode Pasangan */}
              {!isConnected && (
                <form onSubmit={handlePairSubmit} className="space-y-3 pt-2">
                  <label htmlFor="partner-code" className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    Masukkan kode dari pasangan
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="partner-code"
                      type="text"
                      value={partnerInputCode}
                      onChange={(e) => setPartnerInputCode(e.target.value.toUpperCase())}
                      placeholder="Misal: GROW52"
                      maxLength={10}
                      autoCapitalize="characters"
                      autoComplete="off"
                      className="flex-1 min-w-0 min-h-[44px] px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-base sm:text-sm uppercase"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold hover:opacity-90 active:scale-98 transition-all"
                    >
                      Hubungkan
                    </button>
                  </div>

                  {pairError && (
                    <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{pairError}</p>
                  )}
                  {pairSuccess && (
                    <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      Berhasil terhubung dengan pasangan.
                    </p>
                  )}
                </form>
              )}

              {isConnected && pairError && (
                <p role="alert" className="text-xs text-rose-700 dark:text-rose-400">{pairError}</p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="w-full py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Buka Panduan Sambutan Pasangan
                </button>
              </div>

              {!isDemoMode && currentUser.coupleId && (
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                  <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                    <UserMinus className="w-4 h-4 text-stone-500 shrink-0" aria-hidden="true" />
                    <h4 className="text-xs font-bold">
                      {isConnected ? 'Keluar dari Pasangan' : 'Batalkan Ruang Bersama'}
                    </h4>
                  </div>
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                    {isConnected
                      ? 'Putuskan ruang bersama tanpa menghapus akunmu. Habit bersama, buku, dan kesepakatan tetap tersimpan untuk pasangan.'
                      : 'Ruang ini belum diisi pasangan. Membatalkannya hanya menghapus ruang kosong, bukan akunmu.'}
                  </p>

                  {!showLeaveConfirm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLeaveError('');
                        setShowLeaveConfirm(true);
                      }}
                      disabled={accountBusy}
                      className="mt-3 w-full min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <UserMinus className="w-4 h-4" aria-hidden="true" />
                      {isConnected ? 'Keluar dari Pasangan' : 'Batalkan Ruang Bersama'}
                    </button>
                  ) : (
                    <div className="mt-3 p-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 space-y-2">
                      <p className="text-[11px] leading-relaxed text-stone-600 dark:text-stone-300">
                        {isConnected
                          ? 'Kamu akan kembali ke layar ajakan pasangan. Kamu bisa membuat atau bergabung ke ruang baru kapan saja.'
                          : 'Ruang kosong akan dihapus dan kamu kembali ke layar ajakan pasangan.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleLeaveCouple}
                          disabled={accountBusy}
                          className="flex-1 min-h-[44px] rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {accountBusy
                            ? 'Memproses...'
                            : isConnected
                              ? 'Ya, Keluar dari Pasangan'
                              : 'Ya, Batalkan Ruang'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLeaveConfirm(false)}
                          disabled={accountBusy}
                          className="min-h-[44px] px-3 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-medium disabled:opacity-60"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}

                  {leaveError && (
                    <p role="alert" className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                      {leaveError}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold">Status sinkronisasi</h4>
                </div>
                {isDemoMode ? (
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-2 leading-relaxed">
                    Kalian berada di mode demo. Semua perubahan hanya tersimpan di perangkat ini dan
                    tidak akan pernah terlihat oleh pasangan. Keluar dari mode demo lalu gunakan
                    kode ruang untuk sinkronisasi sungguhan.
                  </p>
                ) : (
                  <dl className="mt-2 space-y-1.5">
                    {syncRows.map((row) => (
                      <div key={row.label} className="flex items-start justify-between gap-3 text-[11px]">
                        <dt className="text-stone-500 dark:text-stone-400 shrink-0">{row.label}</dt>
                        <dd
                          className={`font-semibold text-right break-all ${
                            row.bad
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-stone-800 dark:text-stone-100'
                          }`}
                        >
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
                  Kalau habit pasangan tidak muncul, bandingkan baris “Ruang bersama” dengan pasanganmu.
                  Dua kode ruang yang berbeda berarti kalian belum benar-benar berpasangan.
                </p>
              </div>

              {!isDemoMode && (
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    Tes koneksi ke server
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    Aplikasi menulis satu dokumen kecil lalu membacanya kembali dari Firebase, lalu
                    menghapusnya lagi. Ini membuktikan apakah perubahanmu benar-benar keluar dari
                    perangkat.
                  </p>
                  <button
                    type="button"
                    disabled={syncTesting}
                    onClick={async () => {
                      setSyncTesting(true);
                      setSyncTest(null);
                      const result = await runSyncTest();
                      setSyncTest(result);
                      setSyncTesting(false);
                    }}
                    className="mt-3 w-full min-h-[44px] rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${syncTesting ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {syncTesting ? 'Menguji…' : 'Jalankan Tes'}
                  </button>
                  {syncTest && (
                    <p
                      role="status"
                      className={`mt-2 text-[11px] font-semibold leading-relaxed break-words ${
                        syncTest.ok
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {syncTest.detail}
                    </p>
                  )}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    Log aktivitas sinkron
                  </h4>
                  <button
                    type="button"
                    onClick={() => void handleCopySyncReport()}
                    className="min-h-[36px] px-2.5 rounded-lg text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 flex items-center gap-1.5"
                  >
                    {syncReportCopied ? (
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    Salin laporan
                  </button>
                </div>
                {syncEvents.length === 0 ? (
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-2">
                    Belum ada aktivitas tercatat di sesi ini. Buat satu perubahan lalu lihat apakah
                    muncul di daftar ini.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                    {syncEvents.slice(0, 20).map((event, index) => (
                      <li key={`${event.at}-${index}`} className="text-[11px] flex gap-2">
                        <span className="tabular-nums text-stone-400 dark:text-stone-500 shrink-0">
                          {new Date(event.at).toLocaleTimeString('id-ID')}
                        </span>
                        <span
                          className={`shrink-0 font-bold ${
                            event.ok
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                          aria-hidden="true"
                        >
                          {event.ok ? '✓' : '!'}
                        </span>
                        <span className="text-stone-600 dark:text-stone-300 break-all">
                          {event.kind === 'listen' ? `muat ${event.target}` : event.target}
                          {event.ok
                            ? ''
                            : ` — ${explainSyncEvent(event)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold">Data pasangan tetap tidak muncul?</h4>
                </div>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                  Kadang salinan data di ponsel menyangkut pada ruang yang lama. Tombol ini menghapus
                  salinan lokal (data di server aman) lalu memuat ulang aplikasi.
                </p>
                <button
                  type="button"
                  onClick={() => void rebuildLocalCache()}
                  className="mt-3 w-full min-h-[44px] rounded-xl border border-amber-300 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors"
                >
                  Bersihkan salinan lokal &amp; muat ulang
                </button>
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="space-y-4">
              {isDemoMode && (
                <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Simulator Pasangan Cepat
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Tampilkan tombol uji coba melayang di sudut layar (ganti akun Rama dan Shinta, tambah XP)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleSimulatorToolbar}
                    aria-pressed={showSimulatorToolbar}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      showSimulatorToolbar
                        ? 'bg-amber-500 text-white'
                        : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {showSimulatorToolbar ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Aktif</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Nonaktif</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Prinsip desain
                </h4>
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  Grace day mingguan melindungi streak kalian saat butuh istirahat, dan tidak ada hukuman otomatis yang membuat salah satu merasa bersalah.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'install' && (
            <div className="space-y-4">
              {isInAppBrowser && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <h4 className="text-xs font-bold">Kamu membuka ini dari dalam aplikasi lain</h4>
                  </div>
                  <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1.5 leading-relaxed">
                    Browser bawaan chat/sosmed (WhatsApp, Instagram, TikTok, dan sejenisnya) tidak
                    bisa memasang aplikasi. Salin tautannya lewat tombol di bawah, lalu buka di
                    Chrome (Android) atau Safari (iPhone) dan pasang dari sana.
                  </p>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold">Pasang di perangkat ini</h4>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-300 mt-1.5 leading-relaxed">
                  GrowTogether bisa dipasang seperti aplikasi biasa — tanpa Play Store atau App Store.
                </p>

                {isInstalled ? (
                  <p
                    role="status"
                    className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                  >
                    Aplikasi sudah terpasang di perangkat ini.
                  </p>
                ) : isInstallable ? (
                  <button
                    type="button"
                    onClick={() => void install()}
                    className="mt-3 w-full min-h-[44px] rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Pasang Sekarang
                  </button>
                ) : (
                  <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                    Jika tombol pasang belum muncul, ikuti langkah manual sesuai perangkatmu di
                    bawah ini.
                  </p>
                )}
              </div>

              {!isIOS && (
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                  <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                    <h4 className="text-xs font-bold">Muncul "Tidak dapat membuka aplikasi"?</h4>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                    Itu gangguan pemasangan di Chrome/Play Services, bukan di aplikasinya. Coba
                    berurutan:
                  </p>
                  <ol className="mt-2 text-xs text-stone-600 dark:text-stone-300 space-y-1.5 list-decimal list-inside">
                    <li>
                      Cari ikon <strong>GrowTogether</strong> di layar utama atau daftar aplikasi.
                      Bila ada, buka dari sana.
                    </li>
                    <li>
                      Bila ada tapi tidak mau dibuka: tahan ikonnya → <strong>Hapus</strong>, lalu
                      ulangi pemasangan dan buka lewat ikonnya.
                    </li>
                    <li>
                      Perbarui <strong>Chrome</strong> dan <strong>Google Play Services</strong> di
                      Play Store, mulai ulang HP, lalu ulangi pemasangan.
                    </li>
                    <li>
                      Bila tetap gagal: menu ⋮ →{' '}
                      <strong>Tambahkan ke layar utama</strong>. Pintasan ini bisa memakai
                      aplikasi secara penuh dan tetap diperbarui otomatis.
                    </li>
                  </ol>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold">Android (Chrome/Edge)</h4>
                </div>
                <ol className="mt-2 text-xs text-stone-600 dark:text-stone-300 space-y-1 list-decimal list-inside">
                  <li>Buka aplikasi ini di Chrome.</li>
                  <li>
                    Ketuk menu ⋮ lalu pilih <strong>Instal aplikasi</strong> atau{' '}
                    <strong>Tambahkan ke layar utama</strong>.
                  </li>
                  <li>Konfirmasi <strong>Instal</strong>.</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <Smartphone className="w-4 h-4 text-rose-500 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold">iPhone/iPad (Safari)</h4>
                </div>
                <ol className="mt-2 text-xs text-stone-600 dark:text-stone-300 space-y-1 list-decimal list-inside">
                  <li>Buka aplikasi ini di Safari.</li>
                  <li>Ketuk tombol <strong>Bagikan</strong>.</li>
                  <li>
                    Pilih <strong>Tambah ke Layar Utama</strong>, lalu <strong>Tambah</strong>.
                  </li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <Monitor className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold">PC/Laptop (Chrome/Edge/Brave)</h4>
                </div>
                <ol className="mt-2 text-xs text-stone-600 dark:text-stone-300 space-y-1 list-decimal list-inside">
                  <li>Buka aplikasi ini di browser tersebut.</li>
                  <li>
                    Klik ikon <strong>instal</strong> di address bar, atau menu ⋮ →{' '}
                    <strong>Aplikasi</strong> → <strong>Instal situs ini</strong>.
                  </li>
                  <li>Aplikasi terbuka di jendela sendiri dan masuk ke Start Menu / Applications.</li>
                </ol>
                <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
                  Firefox dan Safari desktop belum mendukung pemasangan PWA; aplikasi tetap bisa
                  dipakai lewat tab biasa.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 flex items-center justify-center gap-2 transition-colors"
              >
                {copiedLink ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                {copiedLink ? 'Tautan tersalin' : 'Salin tautan aplikasi'}
              </button>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              {isDemoMode ? (
                <>
              <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <Shield className="w-4 h-4 shrink-0" />
                  <h4 className="text-xs font-bold">Mulai Baru dari Nol</h4>
                </div>
                <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1.5 leading-relaxed">
                  Kosongkan data contoh/demo untuk mulai mencatat kebiasaan nyata kalian berdua dari awal.
                </p>

                {showResetConfirm ? (
                  <div className="mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-900/60 flex items-center gap-2">
                    <button type="button"
                      onClick={handleConfirmReset}
                      className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                    >
                      Ya, Kosongkan Data
                    </button>
                    <button type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-medium"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="mt-3 py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 font-semibold text-xs hover:bg-rose-100 transition-colors"
                  >
                    Kosongkan Semua Data Contoh
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                  <h4 className="text-xs font-bold">Muat Ulang Data Contoh Demo</h4>
                </div>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  Kembalikan skenario contoh Rama & Shinta (level bareng tk. 3, pohon berbunga, roulette kesepakatan) untuk demonstrasi.
                </p>
                <button type="button"
                  onClick={handleLoadDemo}
                  className="mt-3 py-2 px-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-semibold text-xs hover:opacity-90 transition-opacity"
                >
                  Muat Data Demo
                </button>
              </div>
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                    <Shield className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold">Data akun tersinkron</h4>
                  </div>
                  <p className="text-xs text-sky-900/80 dark:text-sky-200/80 mt-1.5 leading-relaxed">
                    Habit, catatan, dan kesepakatan tersimpan di akunmu dan tersinkron ke
                    perangkat pasangan. Kontrol demo/reset hanya tersedia di mode demo lokal.
                  </p>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <LogOut className="w-4 h-4 text-stone-500 shrink-0" />
                  <h4 className="text-xs font-bold">Akun</h4>
                </div>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  {isDemoMode
                    ? 'Kamu sedang memakai mode demo lokal. Data tidak tersinkron ke perangkat lain.'
                    : `Masuk tanpa akun. Sesi perangkat: ${authUser?.uid.slice(0, 8) || '—'}`}
                </p>

                {isDemoMode ? (
                  <button
                    type="button"
                    onClick={handleExitDemo}
                    className="mt-3 min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    Keluar dari Mode Demo
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      disabled={accountBusy}
                      className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
                      Masuk ke Ruang Lain
                    </button>

                    {!isDemoMode && currentUser.coupleId && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountError('');
                          setLeaveError('');
                          setShowLeaveConfirm(true);
                          setActiveTab('pair');
                        }}
                        disabled={accountBusy}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <UserMinus className="w-4 h-4" aria-hidden="true" />
                        {isConnected ? 'Keluar dari Pasangan' : 'Batalkan Ruang Bersama'}
                      </button>
                    )}

                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountError('');
                          setDeleteConfirmText('');
                          setShowDeleteConfirm(true);
                        }}
                        disabled={accountBusy}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-400 font-semibold text-xs hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        Hapus Akun
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 space-y-2">
                        <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                          <p className="text-[11px] leading-relaxed">
                            Semua habit, log, jurnal, check-in, dan profilmu dihapus permanen.
                            {couple.user2Id
                              ? ' Data kalian berdua tetap tinggal di ruang pasanganmu, dan ruang itu menjadi milik pasangan.'
                              : ' Ruang bersamamu ikut dihapus karena belum ada pasangan.'}
                          </p>
                        </div>
                        <label htmlFor="delete-confirm" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                          Ketik <strong>HAPUS</strong> untuk konfirmasi
                        </label>
                        <input
                          id="delete-confirm"
                          type="text"
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          autoCapitalize="characters"
                          autoComplete="off"
                          disabled={accountBusy}
                          className="w-full min-h-[44px] px-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm uppercase font-mono"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={accountBusy || deleteConfirmText.trim().toUpperCase() !== 'HAPUS'}
                            className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {accountBusy ? 'Menghapus...' : 'Hapus permanen'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              setDeleteConfirmText('');
                            }}
                            disabled={accountBusy}
                            className="min-h-[44px] px-3 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-medium disabled:opacity-60"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}

                    {accountBusy && (
                      <p role="status" className="text-[11px] text-stone-500 dark:text-stone-400">
                        Memproses akun... jangan tutup jendela ini.
                      </p>
                    )}
                    {accountError && (
                      <p role="alert" className="text-[11px] text-rose-700 dark:text-rose-400">
                        {accountError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
