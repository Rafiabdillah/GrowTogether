import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';

const HEARTS = ['❤️', '💛', '💜', '🩷', '✨', '💚'];
const RAIN_COUNT = 14;
const AUTO_DISMISS_MS = 9000;

function rainStyle(index: number) {
  return {
    left: `${(index * 7.3 + 4) % 96}%`,
    animationDelay: `${(index % 7) * 180}ms`,
    fontSize: `${18 + (index % 4) * 7}px`,
    ['--gt-delay' as string]: `${(index % 7) * 180}ms`,
    ['--gt-fall' as string]: `${1900 + (index % 5) * 260}ms`,
    ['--gt-drift' as string]: `${((index % 3) - 1) * 34}px`,
  } as React.CSSProperties;
}

/** Kabar pasangan tidak boleh tampil sebagai notifikasi kecil yang mudah dilewat:
 *  inilah satu-satunya hal yang membuat seseorang membuka aplikasi lagi. */
export const HugCelebration: React.FC = () => {
  const { activeNotification, dismissNotification, newsQueue, sendReaction, hugStats } = useApp();
  const [replied, setReplied] = useState(false);
  const shownId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeNotification) return;
    if (shownId.current === activeNotification.id) return;
    shownId.current = activeNotification.id;
    setReplied(false);
    try {
      navigator.vibrate?.([70, 40, 70, 40, 140]);
    } catch {
      // Vibration hanya bonus; kabar tetap tampil tanpa itu.
    }
    const timer = window.setTimeout(dismissNotification, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [activeNotification, dismissNotification]);

  const extraNews = useMemo(() => Math.max(0, newsQueue.length - 1), [newsQueue.length]);

  if (!activeNotification) return null;

  const reply = () => {
    setReplied(true);
    void sendReaction('❤️', 'Balas pelukan', 'Balik peluk!');
    window.setTimeout(dismissNotification, 900);
  };

  return (
    <div
      data-hug-celebration="true"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-stone-900/55 backdrop-blur-[2px]"
      role="status"
      aria-live="assertive"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: RAIN_COUNT }, (_, index) => (
          <span
            key={index}
            className="gt-heart-rain absolute top-0 select-none"
            style={rainStyle(index)}
          >
            {HEARTS[index % HEARTS.length]}
          </span>
        ))}
      </div>

      <div className="gt-pop-in relative w-full max-w-sm rounded-3xl bg-white dark:bg-stone-900 border border-rose-200 dark:border-rose-900/60 shadow-2xl p-5 text-center">
        <button
          type="button"
          onClick={dismissNotification}
          aria-label="Tutup pesan semangat"
          className="absolute top-2 right-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="text-5xl leading-none" aria-hidden="true">
          {activeNotification.emoji}
        </div>

        <h3 className="mt-3 text-base font-bold text-stone-900 dark:text-stone-100">
          {activeNotification.senderName} mengirim pelukan
        </h3>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300 font-medium">
          {activeNotification.message}
        </p>

        {extraNews > 0 && (
          <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-300 font-semibold">
            +{extraNews} kabar lainnya menunggu kamu
          </p>
        )}

        {hugStats.chainDays > 0 && (
          <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
            Rantai semangat kalian: {hugStats.chainDays} hari dua arah
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={reply}
            disabled={replied}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-bold transition-all active:scale-95"
          >
            {replied ? 'Balasan terbang ✈️' : 'Balas sekarang'}
          </button>
          <button
            type="button"
            onClick={dismissNotification}
            className="min-h-[44px] px-4 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-sm font-semibold"
          >
            Nanti
          </button>
        </div>
        <p className="mt-2 text-[11px] text-stone-400">
          Dibalas dalam hitungan detik adalah hadiah terbaik untuk pasanganmu.
        </p>
      </div>
    </div>
  );
};
