import React, { useState } from 'react';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { permissionHelp } from '../lib/notifications';

/** Tanpa izin, kabar apa pun hanya sampai saat pasangan kebetulan membuka aplikasi.
 *  Dialog izin tidak boleh diminta diam-diam: browser menjawab 'denied' kalau yang
 *  meminta bukan sentuhan nyata, jadi pintu masuknya harus sebuah tombol. */
export const NotificationGate: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { notifications, partnerUid } = useApp();
  const [answer, setAnswer] = useState('');

  if (!partnerUid) return null;
  if (notifications.permission === 'granted') return null;

  const unsupported = notifications.permission === 'unsupported' || !notifications.supported;
  const blocked = notifications.permission === 'denied';

  const ask = async () => {
    const state = await notifications.requestPermission();
    setAnswer(
      state === 'granted'
        ? 'Aktif. Kabar pasangan sekarang bisa membangunkan ponselmu.'
        : state === 'denied'
          ? 'Browser menolak izin ini. Buka setelan situs untuk mengubahnya.'
          : 'Dialog izin tidak muncul di browser ini — biasanya harus dipasang dulu sebagai aplikasi.'
    );
  };

  return (
    <div
      data-notif-gate="true"
      className={`rounded-2xl border p-3.5 ${
        unsupported || blocked
          ? 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700'
          : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {unsupported || blocked ? (
          <BellOff className="w-4 h-4 mt-0.5 text-stone-500 shrink-0" aria-hidden="true" />
        ) : (
          <Bell className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
            {unsupported
              ? 'Browser ini tidak bisa menampilkan notifikasi'
              : blocked
                ? 'Izin notifikasi sedang dimatikan'
                : 'Biar pelukannya benar-benar terdengar'}
          </h4>
          {!compact && (
            <p className="text-[11px] text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
              {unsupported || blocked
                ? permissionHelp()
                : 'Kamu dan pasangan belum menyalakan izin notifikasi, jadi kabar hanya muncul saat aplikasinya kebetulan terbuka.'}
            </p>
          )}

          {!unsupported && !blocked && (
            <button
              type="button"
              onClick={() => void ask()}
              className="mt-2.5 min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
            >
              Aktifkan notifikasi
            </button>
          )}

          {answer && (
            <p role="status" className="mt-2 text-[11px] text-stone-600 dark:text-stone-400">
              {answer}
            </p>
          )}

          {unsupported && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-stone-500">
              <Smartphone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {notifications.channel.standalone
                ? 'Aplikasi sudah terpasang, tapi sistemnya belum menyediakan notifikasi web di perangkat ini.'
                : 'Pasang dulu: Safari → Bagikan → Tambahkan ke Layar Utama (iPhone), atau Chrome → menu ⋮ → Pasang aplikasi.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
