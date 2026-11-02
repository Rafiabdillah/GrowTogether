import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { consumeRedirectResult } from '../lib/firebase';
import { Users, Sparkles } from 'lucide-react';

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Jendela masuk ditutup. Coba lagi ya.';
    case 'auth/popup-blocked':
      return 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Browser ini tidak mendukung login popup. Coba browser lain atau gunakan mode demo.';
    case 'auth/web-storage-unsupported':
      return 'Penyimpanan browser diblokir. Izinkan cookie/situs ini lalu coba lagi.';
    case 'auth/unauthorized-domain':
      return 'Domain ini belum diizinkan di Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In belum diaktifkan di Firebase Authentication.';
    case 'auth/network-request-failed':
      return 'Koneksi ke Firebase gagal. Periksa jaringanmu.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.';
    default:
      return 'Gagal masuk. Silakan coba lagi atau gunakan mode demo.';
  }
}

export const AuthView: React.FC = () => {
  const { loginWithGoogle, enterDemoMode } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Surface an error when returning from a redirect sign-in that failed.
  useEffect(() => {
    consumeRedirectResult().catch((err) => setError(friendlyAuthError(err)));
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setError('');
      await loginWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            aria-hidden="true"
            className="inline-block w-20 h-20 rounded-[1.6rem] shadow-lg shadow-rose-500/10 mb-4"
          />
          <h1 className="text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            GrowTogether
          </h1>
          <p className="text-stone-600 dark:text-stone-400">
            Bangun kebiasaan bersama, tumbuh bersama
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 dark:border-stone-800 space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100">Kebiasaan Berdua</h3>
                <p className="text-sm text-stone-600 dark:text-stone-400">Pantau dan dukung satu sama lain</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 dark:text-stone-100">Gamifikasi Menyenangkan</h3>
                <p className="text-sm text-stone-600 dark:text-stone-400">Streak, XP, dan taman 3D bersama</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full min-h-[48px] px-6 rounded-xl bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 hover:border-amber-400 dark:hover:border-amber-600 text-stone-900 dark:text-stone-100 font-semibold flex items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600"></div>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Masuk dengan Google
              </>
            )}
          </button>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">atau</span>
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>

          <button
            type="button"
            onClick={enterDemoMode}
            className="w-full min-h-[48px] px-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            Jelajahi Mode Demo
          </button>

          <p className="text-xs text-center text-stone-500 dark:text-stone-400">
            Mode demo menyimpan data hanya di perangkat ini. Masuk dengan Google untuk sinkronisasi berdua.
          </p>
        </div>
      </div>
    </div>
  );
};
