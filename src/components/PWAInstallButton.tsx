import React, { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useDialog } from '../hooks/useDialog';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const dialogRef = useDialog<HTMLDivElement>(showIOSGuide, () => setShowIOSGuide(false));

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Pasang aplikasi GrowTogether ke layar utama"
        className="min-h-[44px] flex items-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white px-3 text-xs font-medium transition-colors active:scale-95 whitespace-nowrap shrink-0"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Pasang Aplikasi</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Cara memasang aplikasi di iOS"
          className="min-h-[44px] flex items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4 text-stone-500" aria-hidden="true" />
          <span className="hidden sm:inline">Pasang di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ios-guide-title"
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <h3 id="ios-guide-title" className="text-base font-semibold">
                  Pasang GrowTogether di iOS
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <p className="mt-4 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                Untuk pengalaman terbaik di iPhone atau iPad:
              </p>
              <ol className="mt-2 text-xs text-stone-600 dark:text-stone-300 space-y-2 list-decimal list-inside">
                <li>Buka di browser <strong>Safari</strong>.</li>
                <li>Ketuk tombol <strong>Bagikan</strong> (ikon kotak dengan panah ke atas).</li>
                <li>Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama</strong>.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-stone-900 dark:bg-stone-100 text-xs font-medium text-white dark:text-stone-900 hover:opacity-90 transition-opacity"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
