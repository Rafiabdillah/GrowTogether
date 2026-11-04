import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { friendlyAccountError } from '../lib/authErrors';
import { Users, Copy, Check, UserPlus, KeyRound, AlertTriangle, Trash2 } from 'lucide-react';

export const PairingView: React.FC = () => {
  const {
    currentUser,
    roomCode,
    createCouple,
    joinCouple,
    authUser,
    switchAccount,
    deleteAccount,
  } = useApp();
  const [name, setName] = useState(() =>
    currentUser.displayName === 'Pengguna' ? '' : currentUser.displayName
  );
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  const handleCreateCouple = async () => {
    if (!name.trim()) {
      setError('Isi nama kamu dulu supaya pasangan tahu siapa yang diajak tumbuh bareng.');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      await createCouple(name.trim());
    } catch (err: any) {
      setError(err.message || 'Gagal membuat pasangan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Isi nama kamu dulu supaya pasangan mengenali kamu di ruang ini.');
      return;
    }
    if (!inviteCode.trim()) {
      setError('Masukkan kode ruang pasanganmu dulu.');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      const result = await joinCouple(inviteCode.trim().toUpperCase(), name.trim());
      if (!result.ok) {
        setError(result.reason || 'Gagal bergabung. Periksa ulang kodenya dengan pasangan.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal bergabung dengan pasangan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    setAccountBusy(true);
    setAccountError('');
    try {
      await switchAccount();
    } catch (err) {
      setAccountError(friendlyAccountError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== 'HAPUS') return;
    setAccountBusy(true);
    setAccountError('');
    try {
      await deleteAccount();
    } catch (err) {
      setAccountError(friendlyAccountError(err));
    } finally {
      setAccountBusy(false);
    }
  };

  const copyInviteCode = () => {
    if (!roomCode) return;
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(roomCode).then(markCopied).catch(() => {
        setError('Gagal menyalin. Catat kodenya secara manual.');
      });
    } else {
      try {
        const area = document.createElement('textarea');
        area.value = roomCode;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        markCopied();
      } catch {
        setError('Gagal menyalin. Catat kodenya secara manual.');
      }
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-stone-900 dark:via-stone-900 dark:to-stone-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500 to-rose-500 mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Masuk dengan Kode Ruang
          </h1>
          <p className="text-stone-600 dark:text-stone-400">
            Tanpa akun Google — cukup nama kamu dan kode ruang bersama
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-200 dark:border-stone-800 space-y-5">
          <label htmlFor="room-display-name" className="block">
            <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Nama kamu <span className="text-rose-500" aria-hidden="true">*</span>
              <span className="sr-only">wajib diisi</span>
            </span>
            <input
              id="room-display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              autoComplete="given-name"
              required
              aria-required="true"
              aria-invalid={error && !name.trim() ? 'true' : undefined}
              placeholder="misal: Rafi"
              className="mt-1 w-full min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Kode ruang kamu
              </h3>
            </div>

            <div className="flex items-center gap-2 p-4 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
              <code className="flex-1 text-center text-lg font-mono font-bold text-stone-900 dark:text-stone-100 tracking-wider">
                {roomCode || 'MEMBUAT...'}
              </code>
              <button
                type="button"
                onClick={copyInviteCode}
                disabled={!roomCode}
                aria-label="Salin kode ruang"
                className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors disabled:opacity-40"
              >
                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-stone-600 dark:text-stone-400" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateCouple}
              disabled={isLoading}
              className="w-full min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold hover:from-amber-600 hover:to-rose-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Memproses...' : 'Buat Ruang Baru'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              sudah punya kode?
            </span>
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>

          <form onSubmit={handleJoinCouple} className="space-y-3">
            <label htmlFor="partner-room-code" className="block">
              <span className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                <UserPlus className="w-4 h-4 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                Kode ruang pasangan <span className="text-rose-500" aria-hidden="true">*</span>
                <span className="sr-only">wajib diisi</span>
              </span>
              <input
                id="partner-room-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="MASUKKAN KODE"
                maxLength={12}
                autoComplete="off"
                required
                aria-required="true"
                className="mt-1 w-full min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-center text-lg font-mono font-bold tracking-widest text-stone-900 dark:text-stone-100"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading || !inviteCode.trim()}
              className="w-full min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold hover:from-rose-600 hover:to-pink-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Bergabung...' : 'Gabung Sekarang'}
            </button>
          </form>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900">
            <KeyRound className="w-4 h-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              Simpan kode ruangmu. Tanpa akun, kode ini satu-satunya jalan kembali ke ruang ini
              di perangkat baru.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
        </div>

        <div className="mt-5 text-center space-y-2">
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            ID perangkat: <span className="font-mono font-semibold">{authUser?.uid.slice(0, 8) || '—'}</span>
          </p>
          {authUser && !authUser.isAnonymous && (
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Perangkat ini masih memakai akun lama. Ruang yang sudah terisi dua orang tidak bisa
              dimasuki lagi dengan akun lama setelah kamu pindah ruang.
            </p>
          )}
          {!showDelete ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={accountBusy}
                className="min-h-[44px] px-2 hover:underline disabled:opacity-60"
              >
                Masuk ke ruang lain
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => {
                  setAccountError('');
                  setDeleteText('');
                  setShowDelete(true);
                }}
                disabled={accountBusy}
                className="min-h-[44px] px-2 text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-60"
              >
                Hapus data perangkat ini
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 text-left space-y-2">
              <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed">
                  Profil dan data di perangkat ini dihapus permanen. Ketik <strong>HAPUS</strong> untuk
                  melanjutkan.
                </p>
              </div>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                disabled={accountBusy}
                aria-label="Ketik HAPUS untuk konfirmasi"
                className="w-full min-h-[44px] px-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-sm uppercase font-mono"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={accountBusy || deleteText.trim().toUpperCase() !== 'HAPUS'}
                  className="flex-1 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {accountBusy ? 'Menghapus...' : 'Hapus permanen'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(false);
                    setDeleteText('');
                  }}
                  disabled={accountBusy}
                  className="min-h-[44px] px-3 rounded-xl bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-medium disabled:opacity-60"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
          {accountError && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {accountError}
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-stone-500 dark:text-stone-400 mt-5">
          GrowTogether v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
};
