import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { friendlyAccountError } from '../lib/authErrors';
import { Users, Copy, Check, UserPlus, Heart, AlertTriangle, Trash2 } from 'lucide-react';

export const PairingView: React.FC = () => {
  const {
    currentUser,
    createCouple,
    joinCouple,
    authUser,
    switchAccount,
    deleteAccount,
    logoutUser,
  } = useApp();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  const handleCreateCouple = async () => {
    try {
      setIsLoading(true);
      setError('');
      await createCouple();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat pasangan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      setIsLoading(true);
      setError('');
      const success = await joinCouple(inviteCode.trim().toUpperCase());
      if (!success) {
        setError('Kode undangan tidak valid atau sudah digunakan');
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
    if (!currentUser.inviteCode) return;
    const markCopied = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(currentUser.inviteCode).then(markCopied).catch(() => {
        setError('Gagal menyalin. Catat kodenya secara manual.');
      });
    } else {
      try {
        const area = document.createElement('textarea');
        area.value = currentUser.inviteCode;
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
            <Heart className="w-8 h-8 text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Ajak Pasangan Kamu
          </h1>
          <p className="text-stone-600 dark:text-stone-400">
            Buat ruang bersama untuk tumbuh bareng
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-xl border border-stone-200 dark:border-stone-800">
          <div className="flex gap-2 mb-6 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl">
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'create'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Buat Pasangan
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                mode === 'join'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              Gabung Pasangan
            </button>
          </div>

          {mode === 'create' ? (
            <div className="space-y-4">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100">Kode Undangan Kamu</h3>
                  <p className="text-sm text-stone-600 dark:text-stone-400">Bagikan kode ini ke pasanganmu</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700">
                <code className="flex-1 text-center text-lg font-mono font-bold text-stone-900 dark:text-stone-100 tracking-wider">
                  {currentUser.inviteCode || 'LOADING'}
                </code>
                <button
                  onClick={copyInviteCode}
                  className="p-2 hover:bg-stone-200 dark:hover:bg-stone-700 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-stone-600 dark:text-stone-400" />}
                </button>
              </div>

              <button
                onClick={handleCreateCouple}
                disabled={isLoading}
                className="w-full min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold hover:from-amber-600 hover:to-rose-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Membuat...' : 'Buat Ruang Bersama'}
              </button>

              <p className="text-xs text-center text-stone-500 dark:text-stone-400">
                Pasangan kamu bisa gabung dengan kode di atas
              </p>
            </div>
          ) : (
            <form onSubmit={handleJoinCouple} className="space-y-4">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
                  <UserPlus className="w-6 h-6 text-rose-700 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100">Masukkan Kode Undangan</h3>
                  <p className="text-sm text-stone-600 dark:text-stone-400">Dapatkan kode dari pasanganmu</p>
                </div>
              </div>

              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="MASUKKAN KODE"
                maxLength={8}
                className="w-full min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-center text-lg font-mono font-bold tracking-widest text-stone-900 dark:text-stone-100"
              />

              <button
                type="submit"
                disabled={isLoading || !inviteCode.trim()}
                className="w-full min-h-[48px] px-6 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold hover:from-rose-600 hover:to-pink-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Bergabung...' : 'Gabung Sekarang'}
              </button>

              <p className="text-xs text-center text-stone-500 dark:text-stone-400">
                Minta pasangan membuka tab “Buat Pasangan” dan menekan “Buat Ruang Bersama” sebelum kode dipakai.
              </p>
            </form>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center mt-4">{error}</p>
          )}
        </div>

        <div className="mt-5 text-center space-y-2">
          <p className="text-[11px] text-stone-500 dark:text-stone-400 break-all">
            Masuk sebagai <span className="font-semibold">{authUser?.email || 'akun Google'}</span>
          </p>
          {!showDelete ? (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
              <button
                type="button"
                onClick={handleSwitchAccount}
                disabled={accountBusy}
                className="min-h-[44px] px-2 hover:underline disabled:opacity-60"
              >
                Ganti akun
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => void logoutUser()}
                disabled={accountBusy}
                className="min-h-[44px] px-2 hover:underline disabled:opacity-60"
              >
                Keluar
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
                Hapus akun
              </button>
            </div>
          ) : (
            <div className="p-3 rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/20 text-left space-y-2">
              <div className="flex items-start gap-2 text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed">
                  Profil dan data akun ini dihapus permanen. Ketik <strong>HAPUS</strong> untuk
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
      </div>
    </div>
  );
};
