import React, { useState } from 'react';
import {
  Flame,
  Award,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { toLocalDateString } from '../data/mockData';

export const ProgressView: React.FC = () => {
  const {
    currentUser,
    partnerUid,
    couple,
    combinedStreak,
    sessions,
    logs,
    books,
    journals,
    toggleGraceDay,
  } = useApp();
  const [chartMetric, setChartMetric] = useState<'minutes' | 'habits'>('minutes');

  // Rolling seven-day window, ending today.
  const days = Array.from({ length: 7 }, (_, idx) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - idx));
    return {
      key: toLocalDateString(date),
      label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
    };
  });

  const minutesFor = (
    daySessions: typeof sessions,
    userId: string | undefined,
    category: 'baca' | 'belajar'
  ) =>
    userId
      ? daySessions
          .filter((s) => s.userId === userId && s.category === category)
          .reduce((sum, s) => sum + Math.round(s.durationSeconds / 60), 0)
      : 0;

  const completedHabitsFor = (dateKey: string, userId: string | undefined) =>
    userId ? logs.filter((l) => l.userId === userId && l.date === dateKey && l.completed).length : 0;

  const chartData = days.map(({ key, label }) => {
    const daySessions = sessions.filter(
      (s) => toLocalDateString(new Date(s.timestamp)) === key
    );
    return {
      day: label,
      'Baca (Kamu)': minutesFor(daySessions, currentUser.id, 'baca'),
      'Belajar (Kamu)': minutesFor(daySessions, currentUser.id, 'belajar'),
      'Baca (Pasangan)': minutesFor(daySessions, partnerUid, 'baca'),
      'Belajar (Pasangan)': minutesFor(daySessions, partnerUid, 'belajar'),
      'Habit (Kamu)': completedHabitsFor(key, currentUser.id),
      'Habit (Pasangan)': completedHabitsFor(key, partnerUid),
    };
  });

  const readingMinutes = chartData.reduce(
    (sum, day) => sum + day['Baca (Kamu)'] + day['Baca (Pasangan)'],
    0
  );
  const studyMinutes = chartData.reduce(
    (sum, day) => sum + day['Belajar (Kamu)'] + day['Belajar (Pasangan)'],
    0
  );

  const completedBooks = books.filter((b) => b.status === 'completed').length;
  const totalFocusMinutes = sessions.reduce(
    (sum, s) => sum + Math.round(s.durationSeconds / 60),
    0
  );

  const badges = [
    {
      id: 'streak_7',
      title: '7 Hari Bersama',
      desc: 'Konsisten membangun habit berdua selama 1 minggu penuh',
      unlocked: combinedStreak >= 7,
      icon: '🔥',
    },
    {
      id: 'streak_14',
      title: '2 Pekan Harmonis',
      desc: 'Melampaui 14 hari streak tanpa putus',
      unlocked: combinedStreak >= 14,
      icon: '✨',
    },
    {
      id: 'streak_30',
      title: '30 Hari Transformasi',
      desc: 'Menempa rutinitas sejati selama 1 bulan',
      unlocked: combinedStreak >= 30,
      icon: '👑',
    },
    {
      id: 'books_3',
      title: 'Kutu Buku Romantis',
      desc: 'Menyelesaikan 3 buku di rak bacaan kita',
      unlocked: completedBooks >= 3,
      icon: '📚',
    },
    {
      id: 'hours_10',
      title: '10 Jam Fokus',
      desc: 'Mencapai total 600 menit sesi fokus bersama',
      unlocked: totalFocusMinutes >= 600,
      icon: '⏳',
    },
    {
      id: 'reflection_pro',
      title: 'Refleksi Mendalam',
      desc: 'Mengisi minimal 2 jurnal refleksi mingguan',
      unlocked: journals.length >= 2,
      icon: '💌',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Combined & Personal Streaks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Streak Bersama */}
        <div className="p-6 rounded-3xl bg-amber-50 dark:bg-stone-900 border border-amber-200/80 dark:border-amber-900/40 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Flame className="w-5 h-5 fill-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Streak Bersama
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Keduanya menuntaskan habit
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-stone-900 dark:text-stone-100 font-mono tabular-nums">
              {combinedStreak}
            </span>
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">
              Hari Berturut-turut
            </span>
          </div>
        </div>

        {/* Grace Day Status */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Grace Day Mingguan
                </h3>
              </div>
              <span className="text-[11px] text-stone-500">1x / minggu</span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 leading-relaxed">
              Hari libur tanpa rasa bersalah. Jika salah satu lelah atau lembur, streak tetap aman terlindungi.
            </p>
          </div>
          <button type="button"
            onClick={toggleGraceDay}
            className={`mt-4 min-h-[44px] py-2 px-4 rounded-xl text-xs font-semibold border transition-all ${
              couple.graceDayUsedThisWeek
                ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
            }`}
          >
            {couple.graceDayUsedThisWeek ? '✓ Grace Day Sedang Aktif' : 'Aktifkan Grace Day Minggu Ini'}
          </button>
        </div>

        {/* Total Menit Belajar & Baca Minggu Ini */}
        <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Total Waktu 7 Hari Terakhir
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30">
              <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase">
                Membaca
              </span>
              <p className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                {readingMinutes} m
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase">
                Belajar
              </span>
              <p className="text-xl font-bold font-mono text-stone-900 dark:text-stone-100 mt-0.5">
                {studyMinutes} m
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Weekly Chart Section (Recharts) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Grafik Waktu Baca & Belajar (7 Hari Terakhir)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Dihitung otomatis dari sesi fokus yang kamu dan pasanganmu simpan.
            </p>
          </div>

          <div className="flex items-center p-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartMetric('minutes')}
              aria-pressed={chartMetric === 'minutes'}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg transition-colors ${
                chartMetric === 'minutes'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              Menit
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('habits')}
              aria-pressed={chartMetric === 'habits'}
              className={`min-h-[44px] px-3 py-1.5 rounded-lg transition-colors ${
                chartMetric === 'habits'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              Habit
            </button>
          </div>
        </div>

        {totalFocusMinutes === 0 && chartMetric === 'minutes' ? (
          <div className="h-48 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
              Belum ada sesi fokus tercatat
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
              Mulai timer fokus atau catat sesi manual, lalu grafik ini akan terisi otomatis.
            </p>
          </div>
        ) : (
          <div className="w-full h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} unit={chartMetric === 'minutes' ? 'm' : ''} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(25, 25, 25, 0.92)',
                    borderRadius: '16px',
                    border: 'none',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '10px 14px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  iconType="circle"
                />
                {chartMetric === 'minutes' ? (
                  <>
                    <Bar dataKey="Baca (Kamu)" fill="#E06D53" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Belajar (Kamu)" fill="#FF8A65" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Baca (Pasangan)" fill="#4A826B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Belajar (Pasangan)" fill="#6BB99D" radius={[4, 4, 0, 0]} />
                  </>
                ) : (
                  <>
                    <Bar dataKey="Habit (Kamu)" fill="#E06D53" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Habit (Pasangan)" fill="#4A826B" radius={[4, 4, 0, 0]} />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Badges / Pencapaian Bersama */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            Badge & Pencapaian Bersama
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`p-4 rounded-2xl border transition-all ${
                b.unlocked
                  ? 'bg-white dark:bg-stone-900 border-stone-200/80 dark:border-stone-800 shadow-xs'
                  : 'bg-stone-50/50 dark:bg-stone-900/40 border-stone-200/40 dark:border-stone-800/40 opacity-50 grayscale'
              }`}
            >
              <div className="text-2xl">{b.icon}</div>
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-2 truncate">
                {b.title}
              </h4>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-snug line-clamp-2">
                {b.desc}
              </p>
              <div className="mt-2.5">
                <span
                  className={`text-[11px] font-medium ${
                    b.unlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500'
                  }`}
                >
                  {b.unlocked ? '✓ Terbuka' : 'Terkunci'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
