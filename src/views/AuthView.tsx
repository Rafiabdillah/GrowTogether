import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, AlertTriangle, RefreshCw, KeyRound } from 'lucide-react';

// No account is needed any more, so there is no sign-in form here: the device
// opens its own session silently and the room-code screen takes over. This view
// only covers what a user can actually see — the session is starting, or
// Firebase refused to start it.
export const AuthView: React.FC = () => {
  const { authError, retryAuth, enterDemoMode, isAuthLoading } = useApp();

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
          {authError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-semibold text-stone-900 dark:text-stone-100">
                    Sesi perangkat gagal dibuka
                  </h2>
                  <p role="alert" className="text-sm text-stone-600 dark:text-stone-400 mt-1">
                    {authError}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void retryAuth()}
                disabled={isAuthLoading}
                className="w-full min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-amber-600 hover:to-rose-600 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Coba lagi
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                {isAuthLoading ? (
                  <div
                    className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"
                    role="status"
                    aria-label="Membuka sesi perangkat"
                  />
                ) : (
                  <KeyRound className="w-6 h-6 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                )}
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {isAuthLoading ? 'Membuka sesi perangkat...' : 'Menyambungkan ke server...'}
              </p>
            </div>
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
            Mode demo menyimpan data hanya di perangkat ini. Ruang bersama dibuka dengan kode khusus dari pasangan.
          </p>
        </div>
      </div>
    </div>
  );
};
