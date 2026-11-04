import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

// A worker that already took over cannot reach back into a page that was loaded
// before it existed, so remember the controller this document started with.
const controlledOnLoad = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;

/**
 * Both phones must run the same build for their numbers to mean the same thing.
 * Instead of silently keeping an open tab on an old bundle, name both versions
 * and let the person decide when to reload.
 */
export const BuildUpdateBanner: React.FC = () => {
  const [pendingVersion, setPendingVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const container = navigator.serviceWorker;
    if (!container || !controlledOnLoad) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; version?: string } | null;
      if (!data || data.type !== 'gt:build') return;
      if (data.version && data.version !== __APP_VERSION__) setPendingVersion(data.version);
    };
    container.addEventListener('message', onMessage);
    return () => container.removeEventListener('message', onMessage);
  }, []);

  if (!pendingVersion || dismissed) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 bg-amber-500/95 dark:bg-amber-600/90 text-stone-900 dark:text-stone-950 px-4 py-2"
    >
      <div className="max-w-6xl w-full mx-auto flex items-center gap-3 text-xs font-semibold">
        <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
        <p className="flex-1 min-w-0">
          Versi baru v{pendingVersion} sudah terpasang — halaman ini masih berjalan pada
          v{__APP_VERSION__}. Muat ulang supaya kedua HP memakai angka yang sama.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-stone-900 text-white dark:bg-white dark:text-stone-900 font-bold shrink-0"
        >
          Muat ulang
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Tunda muat ulang"
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl hover:bg-black/10 shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
