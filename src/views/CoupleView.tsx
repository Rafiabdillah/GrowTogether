import React, { useState } from 'react';
import {
  Users2,
  BookMarked,
  Heart,
  Sparkles,
  Plus,
  Star,
  Quote,
  MessageSquareHeart,
  Copy,
  Check,
  Target,
  Send,
  Calendar,
  Moon,
  Dices,
  Trees,
  Smile,
  Coins,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Book } from '../types/index';
import { NightlyCheckInModal } from '../components/NightlyCheckInModal';
import { WheelOfFortune } from '../components/WheelOfFortune';
import { DecorationShopModal } from '../components/DecorationShopModal';
import { useDialog } from '../hooks/useDialog';

export const CoupleView: React.FC = () => {
  const {
    currentUser,
    partnerUser,
    couple,
    books,
    journals,
    checkins,
    agreements,
    addBook,
    addJournal,
    sendReaction,
    pairWithCode,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'rituals' | 'books' | 'journal' | 'challenge' | 'pairing'>('rituals');
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [pairSuccess, setPairSuccess] = useState(false);

  // Ritual Modals
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [isWheelModalOpen, setIsWheelModalOpen] = useState(false);
  const [isDecorationModalOpen, setIsDecorationModalOpen] = useState(false);

  // New Book Modal
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookStatus, setBookStatus] = useState<'reading' | 'completed' | 'wishlist'>('reading');
  const [bookRating, setBookRating] = useState(5);
  const [bookQuote, setBookQuote] = useState('');

  // New Journal Modal (3 questions)
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const bookDialogRef = useDialog<HTMLDivElement>(isBookModalOpen, () => setIsBookModalOpen(false));
  const journalDialogRef = useDialog<HTMLDivElement>(isJournalModalOpen, () => setIsJournalModalOpen(false));
  const [whatWorked, setWhatWorked] = useState('');
  const [whatWasHard, setWhatWasHard] = useState('');
  const [nextWeekGoal, setNextWeekGoal] = useState('');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentUser.inviteCode || 'GROW88');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const ok = await pairWithCode(inputCode.trim());
    if (ok) {
      setPairSuccess(true);
      setInputCode('');
      setTimeout(() => setPairSuccess(false), 3000);
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookTitle.trim()) return;

    await addBook({
      coupleId: couple.id,
      title: bookTitle.trim(),
      author: bookAuthor.trim() || 'Penulis',
      status: bookStatus,
      rating: bookRating,
      favoriteQuote: bookQuote.trim() || undefined,
      addedBy: currentUser.displayName,
    });

    setBookTitle('');
    setBookAuthor('');
    setBookQuote('');
    setIsBookModalOpen(false);
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatWorked.trim()) return;

    await addJournal({
      coupleId: couple.id,
      authorId: currentUser.id,
      authorName: currentUser.displayName,
      weekNumber: 44,
      year: 2026,
      whatWorked: whatWorked.trim(),
      whatWasHard: whatWasHard.trim(),
      nextWeekGoal: nextWeekGoal.trim(),
      isShared: true,
    });

    setWhatWorked('');
    setWhatWasHard('');
    setNextWeekGoal('');
    setIsJournalModalOpen(false);
  };

  // Weekly Challenge calculation (target 300m reading)
  const challengeTarget = 300;
  const challengeCurrent = 245;
  const challengePercent = Math.min(100, Math.round((challengeCurrent / challengeTarget) * 100));

  return (
    <div className="space-y-6">
      {/* Couple Header Card */}
      <div className="p-6 rounded-3xl bg-amber-50 dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            <div className="w-12 h-12 rounded-full border-2 border-white dark:border-stone-900 overflow-hidden bg-rose-100 flex items-center justify-center shadow-xs">
              <span className="font-bold text-rose-700 text-sm">
                {currentUser.displayName.charAt(0)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full border-2 border-white dark:border-stone-900 overflow-hidden bg-emerald-100 flex items-center justify-center shadow-xs">
              <span className="font-bold text-emerald-700 text-sm">
                {partnerUser?.displayName.charAt(0) || 'P'}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                {currentUser.displayName.split(' ')[0]} & {partnerUser?.displayName.split(' ')[0] || 'Pasangan'}
              </h2>
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Terhubung aktif · Kode Undangan: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{currentUser.inviteCode}</span>
            </p>
          </div>
        </div>

        {/* Quick Send Love */}
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => sendReaction('❤️', 'Cinta & Dukungan', 'Selalu bangga sama kamu!')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <Heart className="w-3.5 h-3.5 fill-white" />
            <span>Kirim Pelukan</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2 overflow-x-auto">
        <button type="button"
          onClick={() => setActiveSubTab('rituals')}
          className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeSubTab === 'rituals'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-amber-500" />
          <span>Ritual Berdua</span>
        </button>

        <button type="button"
          onClick={() => setActiveSubTab('books')}
          className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeSubTab === 'books'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <BookMarked className="w-3.5 h-3.5" />
          <span>Buku Kita</span>
        </button>

        <button type="button"
          onClick={() => setActiveSubTab('journal')}
          className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeSubTab === 'journal'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <MessageSquareHeart className="w-3.5 h-3.5" />
          <span>Jurnal Refleksi</span>
        </button>

        <button type="button"
          onClick={() => setActiveSubTab('challenge')}
          className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeSubTab === 'challenge'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Tantangan Mingguan</span>
        </button>

        <button type="button"
          onClick={() => setActiveSubTab('pairing')}
          className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeSubTab === 'pairing'
              ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Users2 className="w-3.5 h-3.5" />
          <span>Kode Pasangan</span>
        </button>
      </div>

      {/* SubTab 0: Ritual Berdua */}
      {activeSubTab === 'rituals' && (
        <div className="space-y-6">
          {/* Quick Action Interactive Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1: Check-in Malam */}
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-stone-900 border border-indigo-200/60 dark:border-indigo-800/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Moon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                    +25 XP
                  </span>
                </div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-3">
                  Check-in Malam Hari
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                  Lacak mood 1-5 dan tuliskan satu hal yang kamu syukuri hari ini sebelum tidur berdua.
                </p>
              </div>
              <button type="button"
                onClick={() => setIsCheckInModalOpen(true)}
                className="mt-4 w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Tulis Check-in Hari Ini
              </button>
            </div>

            {/* Card 2: Roda Kesepakatan & Hadiah */}
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-stone-900 border border-amber-200/60 dark:border-amber-800/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Dices className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Fun Roulette
                  </span>
                </div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-3">
                  Roda Hadiah & Kesepakatan
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                  Putar roda keberuntungan untuk memilih sanksi santai atau hadiah kencan yang sudah disetujui.
                </p>
              </div>
              <button type="button"
                onClick={() => setIsWheelModalOpen(true)}
                className="mt-4 w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Putar Roda Keberuntungan
              </button>
            </div>

            {/* Card 3: Toko Dekorasi Taman Kita */}
            <div className="p-4 rounded-3xl bg-amber-50 dark:bg-stone-900 border border-emerald-200/60 dark:border-emerald-800/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Trees className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    {couple.levelXp} XP
                  </span>
                </div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-3">
                  Toko Dekorasi Pulau 3D
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                  Pasang ayunan, kolam teratai, rumah peri, dan kucing oren di pulau melayang 3D kita.
                </p>
              </div>
              <button type="button"
                onClick={() => setIsDecorationModalOpen(true)}
                className="mt-4 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Buka Toko Dekorasi
              </button>
            </div>
          </div>

          {/* Riwayat Check-in Berdua */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smile className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Dinding Syukur & Mood Terakhir
                </h4>
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {checkins.length} check-in tercatat
              </span>
            </div>

            {checkins.length === 0 ? (
              <div className="p-8 text-center rounded-3xl border border-dashed border-stone-300 dark:border-stone-700">
                <p className="text-xs text-stone-500">Belum ada check-in malam. Jadilah yang pertama mengisi hari ini!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {checkins.slice(0, 8).map((chk) => {
                  const isUser = chk.userId === currentUser.id;
                  const moodMap: Record<number, { emoji: string; label: string }> = {
                    1: { emoji: '🌧️', label: 'Melelahkan' },
                    2: { emoji: '⛅', label: 'Agak Berat' },
                    3: { emoji: '🌤️', label: 'Cukup Baik' },
                    4: { emoji: '🌸', label: 'Menyenangkan' },
                    5: { emoji: '✨', label: 'Luar Biasa' },
                  };
                  const m = moodMap[chk.mood] || { emoji: '✨', label: 'Baik' };

                  return (
                    <div
                      key={chk.id}
                      className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex items-start gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-stone-800 flex items-center justify-center text-xl shrink-0 shadow-xs border border-amber-200/40 dark:border-stone-700">
                        {m.emoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                              {chk.userName || (isUser ? currentUser.displayName : partnerUser?.displayName)}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-medium">
                              {m.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-stone-500 font-mono">
                            {chk.date}
                          </span>
                        </div>

                        <p className="text-xs text-stone-700 dark:text-stone-300 mt-1.5 italic bg-stone-50 dark:bg-stone-850 p-2.5 rounded-xl border border-stone-100 dark:border-stone-800">
                          "{chk.gratitude}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SubTab 1: Buku Kita */}
      {activeSubTab === 'books' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Papan "Buku Kita"
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Daftar buku yang sedang dan sudah dibaca bersama beserta kutipan berkesan.
              </p>
            </div>
            <button type="button"
              onClick={() => setIsBookModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Buku</span>
            </button>
          </div>

          {books.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white/70 dark:bg-stone-900/70 border border-dashed border-stone-200 dark:border-stone-800 text-center space-y-3">
              <BookMarked className="w-8 h-8 text-amber-500 mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                Belum Ada Buku yang Dicatat
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                Tambahkan buku yang sedang dibaca, buku yang sudah selesai, atau wishlist bacaan kalian berdua.
              </p>
              <div className="pt-1">
                <button type="button"
                  onClick={() => setIsBookModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
                >
                  + Tambah Buku Pertama
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {books.map((book) => (
                <div
                  key={book.id}
                  className="p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          {book.status === 'reading'
                            ? 'Sedang Dibaca'
                            : book.status === 'completed'
                            ? 'Sudah Tamat'
                            : 'Wishlist'}
                        </span>
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mt-1">
                          {book.title}
                        </h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                          oleh {book.author}
                        </p>
                      </div>

                      <div className="flex items-center text-amber-400">
                        {Array.from({ length: book.rating || 5 }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-current" />
                        ))}
                      </div>
                    </div>

                    {book.favoriteQuote && (
                      <div className="mt-4 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/50 dark:border-stone-700/50 text-xs text-stone-700 dark:text-stone-300 italic flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                        <span>"{book.favoriteQuote}"</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500">
                    <span>Ditambahkan oleh {book.addedBy}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SubTab 2: Jurnal Refleksi Mingguan */}
      {activeSubTab === 'journal' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Jurnal Refleksi Mingguan
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                3 pertanyaan reflektif akhir pekan yang bisa dibaca dan didiskusikan berdua.
              </p>
            </div>
            <button type="button"
              onClick={() => setIsJournalModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium hover:opacity-90 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Isi Refleksi Pekan Ini</span>
            </button>
          </div>

          {journals.length === 0 ? (
            <div className="p-8 rounded-3xl bg-white/70 dark:bg-stone-900/70 border border-dashed border-stone-200 dark:border-stone-800 text-center space-y-3">
              <MessageSquareHeart className="w-8 h-8 text-rose-500 mx-auto opacity-70" />
              <h4 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                Belum Ada Jurnal Refleksi
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                Refleksi mingguan membantu melihat kembali apa yang berjalan baik, tantangan yang dihadapi, dan saling mengapresiasi.
              </p>
              <div className="pt-1">
                <button type="button"
                  onClick={() => setIsJournalModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
                >
                  + Tulis Refleksi Pekan Ini
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {journals.map((j) => (
                <div
                  key={j.id}
                  className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                        Pekan #{j.weekNumber} · {j.year}
                      </span>
                    </div>
                    <span className="text-xs text-stone-500 dark:text-stone-400">
                      Ditulis oleh {j.authorName || 'Pasangan'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h5 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        1. Apa yang berjalan dengan sangat baik minggu ini?
                      </h5>
                      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed bg-stone-50/80 dark:bg-stone-800/40 p-3 rounded-xl">
                        {j.whatWorked}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        2. Apa tantangan atau hal sulit yang dihadapi?
                      </h5>
                      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed bg-stone-50/80 dark:bg-stone-800/40 p-3 rounded-xl">
                        {j.whatWasHard}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        3. Apa target atau perbaikan bersama untuk minggu depan?
                      </h5>
                      <p className="text-xs text-stone-600 dark:text-stone-300 mt-1 leading-relaxed bg-stone-50/80 dark:bg-stone-800/40 p-3 rounded-xl">
                        {j.nextWeekGoal}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Tantangan Bersama */}
      {activeSubTab === 'challenge' && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Tantangan Pekan Ini
                </span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-0.5">
                  Total 300 Menit Membaca Berdua
                </h3>
              </div>
              <span className="text-2xl font-extrabold text-stone-900 dark:text-stone-100 font-mono">
                {challengePercent}%
              </span>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Kumpulkan menit membaca bersama dari sesi fokusmu dan pasanganmu. Capai garis akhir bersama sebelum hari Minggu malam!
            </p>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
              <div
                className="h-full bg-amber-600 transition-all duration-500"
                style={{ width: `${challengePercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 font-mono">
              <span>{challengeCurrent} menit tercatat</span>
              <span>Target: {challengeTarget} menit</span>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 4: Kode Undangan & Pairing */}
      {activeSubTab === 'pairing' && (
        <div className="max-w-lg mx-auto p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Hubungkan dengan Pasangan
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
              Bagikan kode unik 6-karakter milikmu ke pasangan, atau masukkan kode undangan dari pasanganmu di bawah ini.
            </p>
          </div>

          {/* Share My Code */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold text-stone-500 uppercase">
                Kode Undangan Milikmu
              </span>
              <p className="text-2xl font-extrabold tracking-widest text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {currentUser.inviteCode || 'GROW88'}
              </p>
            </div>
            <button type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-xs font-semibold hover:bg-stone-100 transition-colors"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copiedCode ? 'Tersalin!' : 'Salin Kode'}</span>
            </button>
          </div>

          {/* Input Partner Code */}
          <form onSubmit={handlePairSubmit} className="space-y-3">
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
              Masukkan Kode dari Pasangan
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={6}
                placeholder="Misal: GROW88"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm font-mono uppercase tracking-widest focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold hover:opacity-90"
              >
                Hubungkan
              </button>
            </div>
            {pairSuccess && (
              <p className="text-xs text-emerald-600 font-medium">
                ✓ Berhasil terhubung dengan pasangan! Data tersinkron otomatis.
              </p>
            )}
          </form>
        </div>
      )}

      {/* Modal Tambah Buku */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={bookDialogRef} role="dialog" aria-modal="true" aria-label="Tambah buku" className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Tambah Buku Baru ke Rak
            </h3>

            <form onSubmit={handleCreateBook} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Judul Buku
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Atomic Habits"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Penulis
                </label>
                <input
                  type="text"
                  placeholder="Misal: James Clear"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Status
                  </label>
                  <select
                    value={bookStatus}
                    onChange={(e) => setBookStatus(e.target.value as 'reading' | 'completed' | 'wishlist')}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="reading">Sedang Dibaca</option>
                    <option value="completed">Sudah Selesai</option>
                    <option value="wishlist">Ingin Dibaca</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Rating Bintang
                  </label>
                  <select
                    value={bookRating}
                    onChange={(e) => setBookRating(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-xs focus:ring-2 focus:ring-amber-500"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                    <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                    <option value={3}>⭐⭐⭐ (3/5)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Kutipan / Kalimat Favorit
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan kutipan yang paling membekas..."
                  value={bookQuote}
                  onChange={(e) => setBookQuote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBookModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium"
                >
                  Simpan Buku
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Jurnal Refleksi */}
      {isJournalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={journalDialogRef} role="dialog" aria-modal="true" aria-label="Refleksi mingguan" className="w-full max-w-lg rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 shadow-2xl text-stone-800 dark:text-stone-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              Refleksi Mingguan Pasangan
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Jawab 3 pertanyaan sederhana ini untuk saling memahami perkembangan pekan ini.
            </p>

            <form onSubmit={handleCreateJournal} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  1. Apa hal positif atau kebiasaan yang berhasil kita jalani minggu ini?
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Misal: Sukses baca buku bareng tiap malam..."
                  value={whatWorked}
                  onChange={(e) => setWhatWorked(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  2. Apa tantangan atau hal sulit yang sempat menghambat?
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Misal: Lembur di kantor sehingga kurang tidur..."
                  value={whatWasHard}
                  onChange={(e) => setWhatWasHard(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  3. Apa target atau komitmen kecil kita untuk minggu depan?
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Misal: Selesaikan 1 bab baru dan jalan pagi bareng..."
                  value={nextWeekGoal}
                  onChange={(e) => setNextWeekGoal(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJournalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-medium"
                >
                  Publikasikan Refleksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Nightly Check-in Modal */}
      {isCheckInModalOpen && (
        <NightlyCheckInModal onClose={() => setIsCheckInModalOpen(false)} />
      )}

      {/* Wheel of Fortune Modal */}
      {isWheelModalOpen && (
        <WheelOfFortune
          agreements={agreements}
          onClose={() => setIsWheelModalOpen(false)}
        />
      )}

      {/* Island XP Decoration Shop Modal */}
      {isDecorationModalOpen && (
        <DecorationShopModal onClose={() => setIsDecorationModalOpen(false)} />
      )}
    </div>
  );
};
