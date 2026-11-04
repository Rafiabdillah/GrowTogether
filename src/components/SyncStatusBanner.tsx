import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { explainSyncEvent } from '../lib/syncBus';

/**
 * A change that never reaches Firebase used to look exactly like a change that
 * the partner simply did not make, so the failure itself is now on screen.
 */
export const SyncStatusBanner: React.FC<{ onOpenDiagnostics?: () => void }> = ({
  onOpenDiagnostics,
}) => {
  const { syncAlert, dismissSyncAlert, lastSentReaction, isOnline } = useApp();
  const [showSent, setShowSent] = useState(false);

  useEffect(() => {
    if (!lastSentReaction) {
      setShowSent(false);
      return;
    }
    setShowSent(true);
    const timer = setTimeout(() => setShowSent(false), 4500);
    return () => clearTimeout(timer);
  }, [lastSentReaction]);

  if (syncAlert) {
    return (
      <div
        role="alert"
        className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-md"
      >
        <div className="p-3.5 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400 dark:text-amber-600" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Sinkronisasi bermasalah</p>
            <p className="text-[11px] mt-0.5 leading-relaxed break-words">
              {explainSyncEvent(syncAlert)}
              {!isOnline && ' Perangkat sedang luring.'}
            </p>
            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="mt-1.5 text-[11px] font-bold underline underline-offset-2"
              >
                Buka diagnostik
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={dismissSyncAlert}
            aria-label="Tutup peringatan sinkronisasi"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 dark:hover:bg-stone-900/10"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  if (showSent && lastSentReaction) {
    return (
      <div
        role="status"
        className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 w-max max-w-[92vw]"
      >
        <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-700 text-white shadow-lg flex items-center gap-2 text-xs font-semibold">
          <span aria-hidden="true" className="text-base">
            {lastSentReaction.emoji}
          </span>
          <span>Terkirim ke pasangan</span>
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
      </div>
    );
  }

  return null;
};
