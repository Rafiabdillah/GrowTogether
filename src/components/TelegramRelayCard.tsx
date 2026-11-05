import React, { useState } from 'react';
import { Eye, EyeOff, Send, Unlink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { RelayOutcome } from '../lib/telegramRelay';

const OUTCOME_LABEL: Record<RelayOutcome, string> = {
  sent: 'terkirim',
  merged: 'dilebur ke pesan lain',
  'no-token': 'token belum dipasang',
  'no-link': 'chat pasangan belum terhubung',
  rejected: 'ditolak Telegram',
  network: 'tidak ada jawaban',
};

function idleText(ms: number): string {
  if (ms < 60_000) return 'baru saja aktif';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} menit lalu aktif`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} jam lalu aktif`;
  return 'terakhir lihat kemarin';
}

/**
 * Jalur kedua untuk kabar: bot Telegram milik kalian sendiri. Token tidak pernah
 * disinkron ke server GrowTogether, dan yang dikirim hanya kalimat baku — judul
 * habit, isi jurnal dan catatan check-in tetap tinggal di ruang kalian.
 */
export const TelegramRelayCard: React.FC = () => {
  const { relay, isDemoMode, partnerUser } = useApp();
  const [tokenDraft, setTokenDraft] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ ok: boolean; message: string } | null>(null);

  const run = async (action: () => Promise<{ ok: boolean; message: string } | { ok: boolean; message?: string }>) => {
    setBusy(true);
    try {
      const result = await action();
      setAnswer({ ok: result.ok, message: result.message || 'selesai' });
    } catch (error) {
      setAnswer({ ok: false, message: `ada yang gagal: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  };

  if (isDemoMode) return null;

  const state = relay.local.hasToken
    ? relay.local.linked
      ? 'siap'
      : 'token-pas'
    : 'belum-ada';

  return (
    <div
      data-relay-state={state}
      className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-2.5"
    >
      <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
        Bangunkan HP pasangan lewat Telegram
      </h4>
      <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
        GrowTogether tidak punya server pengirim sendiri, jadi kabar untuk HP yang tertutup
        dititip ke bot Telegram buatan kalian. Yang keluar dari ponselmu hanya kalimat baku —
        misalnya "Nama mengirim pelukan untukmu" — bukan judul habit, isi jurnal, atau catatan
        check-in kalian.
      </p>

      <ol className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed list-decimal list-inside space-y-0.5">
        <li>
          Buka Telegram, cari <span className="font-semibold">@BotFather</span>, kirim{' '}
          <span className="font-semibold">/newbot</span>, lalu salin token yang muncul.
        </li>
        <li>
          Tempel token yang sama di <span className="font-semibold">kedua</span> HP pasangan.
        </li>
        <li>
          Di masing-masing HP, kirim <span className="font-semibold">/start</span> ke bot itu, lalu
          tekan "Deteksi chat saya" di bawah.
        </li>
      </ol>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="relay-token"
            type={showToken ? 'text' : 'password'}
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="tempel token bot, contoh 1234567:AAH..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Token bot Telegram"
            className="w-full min-h-[44px] px-3 pr-10 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-xs"
          />
          <button
            type="button"
            onClick={() => setShowToken((prev) => !prev)}
            aria-label={showToken ? 'Sembunyikan token' : 'Tampilkan token'}
            className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-lg text-stone-500 dark:text-stone-400"
          >
            {showToken ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const result = relay.saveToken(tokenDraft);
            setAnswer(result);
            if (result.ok) setTokenDraft('');
          }}
          className="min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-600 text-xs font-semibold text-stone-700 dark:text-stone-200 disabled:opacity-60"
        >
          Simpan token
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !relay.local.hasToken}
          onClick={() => void run(relay.detectAndBind)}
          className="min-h-[44px] px-4 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold disabled:opacity-50"
        >
          {busy ? 'Menunggu bot...' : 'Deteksi chat saya'}
        </button>
        <button
          type="button"
          disabled={busy || !relay.local.linked}
          onClick={() => void run(relay.sendTest)}
          className="min-h-[44px] px-3 rounded-xl border border-stone-300 dark:border-stone-600 text-xs font-semibold text-stone-700 dark:text-stone-200 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          Kirim pesan tes
        </button>
        {relay.local.linked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(relay.unbind)}
            className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
            Lepas ikatan
          </button>
        )}
      </div>

      <label className="flex items-start justify-between gap-3">
        <span className="text-[11px] text-stone-600 dark:text-stone-400">
          Bangunkan HP saya untuk kabar pasangan
        </span>
        <input
          type="checkbox"
          checked={relay.local.enabled}
          disabled={busy || !relay.local.linked}
          onChange={(event) => void run(() => relay.setEnabled(event.target.checked))}
          aria-label="Izinkan HP ini dibangunkan oleh kabar pasangan"
          className="mt-0.5 w-5 h-5 accent-stone-900 dark:accent-stone-100 disabled:opacity-50"
        />
      </label>

      <dl className="space-y-1.5 pt-1 border-t border-stone-200 dark:border-stone-700" data-relay-status="true">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-stone-500 dark:text-stone-400">Perangkat ini</dt>
          <dd
            className={`text-[11px] font-semibold text-right ${
              relay.local.linked ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
            }`}
          >
            {relay.local.linked
              ? `terhubung ke ${relay.local.chatName}${relay.local.enabled ? '' : ' (sedang dimatikan)'}`
              : relay.local.hasToken
                ? 'token siap, chat belum terdeteksi'
                : 'token bot belum dipasang'}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] text-stone-500 dark:text-stone-400">
            HP {partnerUser?.displayName || 'pasangan'}
          </dt>
          <dd
            data-relay-partner={relay.partner ? 'siap' : relay.partnerBlocker}
            className={`text-[11px] font-semibold text-right ${
              relay.partner?.enabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            {relay.partner?.enabled
              ? `bisa dibangunkan (${idleText(relay.partner.idleMs)})`
              : relay.partner
                ? 'sudah terhubung tapi memilih tidak dibangunkan'
                : relay.partnerBlocker}
          </dd>
        </div>
        {relay.trail.length > 0 && (
          <div>
            <dt className="text-[11px] text-stone-500 dark:text-stone-400">Jejak relay</dt>
            <ul className="mt-1 space-y-0.5" data-relay-trail="true">
              {relay.trail.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex items-start justify-between gap-3">
                  <span className="text-[11px] text-stone-600 dark:text-stone-400 truncate">
                    {new Date(entry.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}{' '}
                    — {entry.kind}
                  </span>
                  <span
                    className={`text-[11px] font-semibold shrink-0 ${
                      entry.outcome === 'sent'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {OUTCOME_LABEL[entry.outcome]}
                    {entry.detail ? ` · ${entry.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </dl>

      {answer && (
        <p
          role="status"
          className={`text-[11px] font-medium ${
            answer.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {answer.message}
        </p>
      )}

      <p className="text-[11px] text-stone-500 dark:text-stone-400">
        Catatan: kabar hanya dikirim kalau pasangan sedang tidak membuka aplikasinya, dan tiga kabar
        beruntun dilebur jadi satu pesan.
      </p>
    </div>
  );
};
