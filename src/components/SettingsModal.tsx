import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Heart,
  Share2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  Sliders,
  Palette,
  Shield,
  Trash2,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ColorTheme } from '../types';
import { useDialog } from '../hooks/useDialog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOnboarding: () => void;
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
}) => {
  const {
    currentUser,
    partnerUser,
    couple,
    authUser,
    isDemoMode,
    logoutUser,
    updateUserProfile,
    pairWithCode,
    showSimulatorToolbar,
    toggleSimulatorToolbar,
    resetToEmptyState,
    loadDemoData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'pair' | 'preferences' | 'data'>('profile');
  const [copiedCode, setCopiedCode] = useState(false);
  const [partnerInputCode, setPartnerInputCode] = useState('');
  const [pairError, setPairError] = useState('');
  const [pairSuccess, setPairSuccess] = useState(false);

  const [editName, setEditName] = useState(currentUser.displayName);
  const [editTheme, setEditTheme] = useState<ColorTheme>(currentUser.colorTheme);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setEditName(currentUser.displayName);
      setEditTheme(currentUser.colorTheme);
      setShowResetConfirm(false);
    }
  }, [isOpen, currentUser.id, currentUser.displayName, currentUser.colorTheme]);

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
    navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2500);
      })
      .catch(() => setPairError('Gagal menyalin. Salin kode secara manual.'));
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
          'Kode tidak ditemukan. Pastikan pasangan sudah menekan "Buat Ruang Bersama" dan bagikan kode terbaru.'
        );
      }
    } catch {
      setPairError('Gagal menghubungkan. Periksa koneksi lalu coba lagi.');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    onClose();
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
              {/* Box Kode Sendiri */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Kode pasanganmu
                </span>
                <p className="text-xs text-stone-700 dark:text-stone-300 mb-3">
                  Bagikan kode ini ke pasanganmu agar bisa terhubung ke taman yang sama.
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="w-full py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Buka Panduan Sambutan Pasangan
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

          {activeTab === 'data' && (
            <div className="space-y-4">
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

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <div className="flex items-center gap-2 text-stone-800 dark:text-stone-200">
                  <LogOut className="w-4 h-4 text-stone-500 shrink-0" />
                  <h4 className="text-xs font-bold">Akun</h4>
                </div>
                <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                  {isDemoMode
                    ? 'Kamu sedang memakai mode demo lokal. Data tidak tersinkron ke perangkat lain.'
                    : authUser?.email || 'Masuk dengan Google untuk sinkronisasi.'}
                </p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  {isDemoMode ? 'Keluar dari Mode Demo' : 'Keluar dari Akun'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
