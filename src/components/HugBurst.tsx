import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

const RISE_COUNT = 9;

function riseStyle(index: number) {
  return {
    left: `${8 + index * 10}%`,
    animationDelay: `${index * 60}ms`,
    fontSize: `${16 + (index % 3) * 6}px`,
    ['--gt-drift' as string]: `${((index % 3) - 1) * 26}px`,
  } as React.CSSProperties;
}

/** Mengirim semangat harus terasa seperti melepas sesuatu yang benar-benar pergi,
 *  dan pasangan harus terlihat membukanya — itu yang membuat ingin kirim lagi. */
export const HugBurst: React.FC = () => {
  const { hugBurst, hugStats } = useApp();
  if (!hugBurst) return null;

  const openedByPartner = (hugStats.partnerOpenedAt ?? 0) >= hugBurst.at;

  return (
    <div
      key={hugBurst.at}
      data-hug-burst="true"
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex justify-center gt-burst-fade"
    >
      <div className="relative w-[min(92vw,26rem)]">
        {Array.from({ length: RISE_COUNT }, (_, index) => (
          <span
            key={index}
            className="gt-heart-rise absolute bottom-0"
            style={riseStyle(index)}
          >
            {hugBurst.emoji}
          </span>
        ))}
        <div
          className={`mx-auto mt-2 w-fit flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-lg ${
            openedByPartner
              ? 'bg-emerald-600 text-white'
              : 'bg-white/95 dark:bg-stone-900/95 text-stone-700 dark:text-stone-200'
          }`}
        >
          {openedByPartner ? (
            <>
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Dibuka pasanganmu</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Terkirim · menunggu pasangan membuka</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
