import React, { useCallback, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/**
 * Pengganti window.confirm. Native confirm tidak bisa ditema, tidak berbahasa
 * Indonesia, dan menutup fokus dialog aplikasi yang sedang terbuka.
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const answer = useCallback((ok: boolean) => {
    setRequest(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(ok);
  }, []);

  const dialogRef = useDialog<HTMLDivElement>(!!request, () => answer(false));

  const confirm = useCallback(
    (req: ConfirmRequest) =>
      new Promise<boolean>((resolve) => {
        // Keputusan lama dibatalkan supaya pemanggil tidak menggantung.
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setRequest(req);
      }),
    []
  );

  const confirmDialog = request ? (
    <div
      ref={dialogRef}
      data-confirm-open="true"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-stone-900">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              request.danger === false
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
            }`}
          >
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3
              id="confirm-dialog-title"
              className="text-base font-bold text-stone-900 dark:text-stone-100"
            >
              {request.title}
            </h3>
            <p
              id="confirm-dialog-message"
              className="text-sm leading-relaxed text-stone-600 dark:text-stone-300"
            >
              {request.message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => answer(true)}
            className={`flex-1 min-h-[44px] rounded-xl text-sm font-semibold text-white transition-colors ${
              request.danger === false
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {request.confirmLabel || 'Ya, lanjutkan'}
          </button>
          <button
            type="button"
            onClick={() => answer(false)}
            className="flex-1 min-h-[44px] rounded-xl bg-stone-200 text-sm font-semibold text-stone-800 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600"
          >
            {request.cancelLabel || 'Batal'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, confirmDialog };
}
