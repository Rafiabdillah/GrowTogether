import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  ArrowRight,
  Check,
  Copy,
  Users,
  Shield,
  X,
  Compass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ColorTheme } from '../types';
import { useDialog } from '../hooks/useDialog';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { id: ColorTheme; label: string; bgClass: string }[] = [
  { id: 'coral', label: 'Coral Mawar', bgClass: 'bg-rose-500' },
  { id: 'teal', label: 'Teal Samudra', bgClass: 'bg-emerald-500' },
  { id: 'amber', label: 'Amber Surya', bgClass: 'bg-amber-500' },
  { id: 'indigo', label: 'Indigo Senja', bgClass: 'bg-indigo-500' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    partnerUser,
    isDemoMode,
    updateUserProfile,
    pairWithCode,
    resetToEmptyState,
    loadDemoData,
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(currentUser.displayName || '');
  const [selectedTheme, setSelectedTheme] = useState<ColorTheme>(currentUser.colorTheme || 'coral');
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [pairError, setPairError] = useState('');

  const dialogRef = useDialog<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    const code = currentUser.inviteCode || 'GROW-2026';
    const fallbackCopy = () => {
      try {
        const area = document.createElement('textarea');
        area.value = code;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch {
        setPairError('Gagal menyalin. Catat kodenya secara manual.');
      }
    };
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 2000);
        })
        .catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  const handleNextStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await updateUserProfile(currentUser.id, {
        displayName: name.trim(),
        colorTheme: selectedTheme,
      });
    }
    setStep(2);
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairError('');
    if (!partnerCodeInput.trim()) {
      setStep(3);
      return;
    }
    try {
      const success = await pairWithCode(partnerCodeInput.trim().toUpperCase());
      if (success) {
        setStep(3);
      } else {
        setPairError(
          'Kode tidak ditemukan. Minta pasangan menekan "Buat Ruang Bersama" lebih dulu, lalu masukkan kodenya.'
        );
      }
    } catch {
      setPairError('Gagal menghubungkan. Periksa koneksi lalu coba lagi.');
    }
  };

  const handleFinishClean = () => {
    if (isDemoMode) {
      resetToEmptyState();
    }
    onClose();
  };

  const handleFinishDemo = () => {
    loadDemoData();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Panduan sambutan" className="bg-white dark:bg-stone-900 w-full max-w-md rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Top bar with close affordance */}
        <div className="p-4 px-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              Langkah {step} dari 3
            </span>
          </div>
          <button type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* STEP 1: Profil & Warna */}
          {step === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-4">
              <div className="text-center space-y-1 pb-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-stone-900 p-0.5 mx-auto flex items-center justify-center shadow-sm">
                  <div className="w-full h-full bg-white dark:bg-stone-900 rounded-[14px] flex items-center justify-center">
                    <Heart className="w-6 h-6 text-rose-500 fill-rose-500/20" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 pt-2">
                  Selamat Datang di GrowTogether!
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                  Ruang intim kalian berdua untuk membangun kebiasaan positif dan merawat pohon kehidupan bersama.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">
                  Nama Panggilan Kamu
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Rama"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                  Pilih Warna Karakter Lentera Kamu
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = selectedTheme === theme.id;
                    return (
                      <button
                        type="button"
                        key={theme.id}
                        onClick={() => setSelectedTheme(theme.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 font-bold text-stone-900 dark:text-stone-100'
                            : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full ${theme.bgClass}`} />
                        <span className="text-xs">{theme.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold text-xs flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all shadow-xs"
                >
                  <span>Lanjutkan</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Hubungkan Pasangan */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 pt-1">
                  Hubungkan dengan Pasangan
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Aplikasi ini menyinkronkan kebiasaan dan taman 3D kalian berdua secara langsung.
                </p>
              </div>

              {partnerUser ? (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-center space-y-2">
                  <p className="text-xs text-stone-700 dark:text-stone-300">
                    Kalian sudah terhubung dengan <strong>{partnerUser.displayName}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                  >
                    Lanjut
                  </button>
                </div>
              ) : (
                <>
              {/* Share box */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                  Bagikan Kode Ini ke Pasangan:
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-stone-900 border border-amber-300 dark:border-amber-700 text-center font-mono font-bold text-base text-amber-700 dark:text-amber-300">
                    {currentUser.inviteCode || 'GROW-2026'}
                  </div>
                  <button type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              {/* Partner code input */}
              <form onSubmit={handlePairSubmit} className="space-y-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Atau Masukkan Kode dari Pasangan:
                </label>
                <input
                  type="text"
                  value={partnerCodeInput}
                  onChange={(e) => setPartnerCodeInput(e.target.value.toUpperCase())}
                  placeholder="Misal: GROW-5678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {pairError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">{pairError}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-400"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>{partnerCodeInput ? 'Hubungkan & Lanjut' : 'Lewati & Lanjut'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Pilih Mode Awal */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center space-y-1 pb-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 pt-1">
                  Pilih Cara Kalian Memulai
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  Kalian dapat langsung mulai dengan data bersih atau menjelajahi fitur dengan data contoh.
                </p>
              </div>

              {/* Option A: Bersih dari Awal */}
              <button type="button"
                onClick={handleFinishClean}
                className="w-full p-4 rounded-2xl border-2 border-stone-200 dark:border-stone-700 hover:border-amber-500 dark:hover:border-amber-500 text-left transition-all group flex items-start gap-3 bg-white dark:bg-stone-900"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Mulai Bersih dari Awal (Disarankan)
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                    Mulai dari bibit pohon tunas level 1 dan tambahkan kebiasaan nyata kalian berdua.
                  </p>
                </div>
              </button>

              {/* Option B: Coba Data Demo */}
              {isDemoMode && (
              <button type="button"
                onClick={handleFinishDemo}
                className="w-full p-4 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-stone-400 text-left transition-all flex items-start gap-3 bg-stone-50 dark:bg-stone-850"
              >
                <div className="p-2 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Jelajahi Contoh Demo (Rama & Shinta)
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
                    Lihat pohon level 3 yang sudah berbunga, contoh kesepakatan, dan putar roda sanksi.
                  </p>
                </div>
              </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
