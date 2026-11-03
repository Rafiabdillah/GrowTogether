import React, { Suspense, lazy, useState } from 'react';
import {
  Sparkles,
  Brain,
  Dna,
  Info,
  BookOpen,
  Clock,
  Heart,
  ExternalLink,
  Layers,
  Trees,
  Sun,
  Moon,
  CloudRain,
  Rainbow,
} from 'lucide-react';
import { Garden2DFallback } from '../components/Garden2DFallback';
import { DecorationShopModal } from '../components/DecorationShopModal';
import { useApp } from '../context/AppContext';
import { NEUROSCIENCE_INSIGHTS, getTodayDateString } from '../data/mockData';
import { TimeOfDay, WeatherType } from '../types/index';

const ThreeGarden = lazy(() =>
  import('../components/ThreeGarden').then((m) => ({ default: m.ThreeGarden }))
);

export const GardenView: React.FC = () => {
  const {
    couple,
    logs,
    currentUser,
    partnerUid,
    partnerUser,
    setTimeOfDay,
    setWeather,
  } = useApp();
  const [activeTopic, setActiveTopic] = useState<'all' | 'dopamine' | 'habit-loop' | 'circadian' | 'co-regulation'>('all');
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);

  // Count only today's completions; older logs should not light up the garden forever.
  const today = getTodayDateString();
  const completedTodayUser = logs.filter(
    (l) => l.userId === currentUser.id && l.date === today && l.completed
  ).length;
  const completedTodayPartner = logs.filter(
    (l) => l.userId === partnerUid && l.date === today && l.completed
  ).length;

  const filteredInsights = activeTopic === 'all'
    ? NEUROSCIENCE_INSIGHTS
    : NEUROSCIENCE_INSIGHTS.filter((n) => n.topic === activeTopic);

  return (
    <div className="space-y-6">
      {/* Garden Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Taman Pertumbuhan Pasangan
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Pohon & pulau melayang bertumbuh seiring konsistensi kebiasaan kalian
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 3D vs 2D Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs">
            <button type="button"
              onClick={() => setIs3DMode(true)}
              className={`min-h-[44px] px-2.5 py-1 rounded-lg font-semibold transition-all ${
                is3DMode
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              3D WebGL
            </button>
            <button type="button"
              onClick={() => setIs3DMode(false)}
              className={`min-h-[44px] px-2.5 py-1 rounded-lg font-semibold transition-all ${
                !is3DMode
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              2D Aksesibel
            </button>
          </div>

          {/* Toko Dekorasi Trigger */}
          <button type="button"
            onClick={() => setIsShopModalOpen(true)}
            className="flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Trees className="w-3.5 h-3.5 text-amber-500" />
            <span>Toko Dekorasi ({couple.levelXp} XP)</span>
          </button>
        </div>
      </div>

      {/* Atmosphere Quick Selector */}
      <div className="p-3 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Waktu Langit */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-stone-500 dark:text-stone-400">Suasana Langit:</span>
          {(['auto', 'dawn', 'day', 'sunset', 'night'] as TimeOfDay[]).map((t) => (
            <button type="button"
              key={t}
              onClick={() => setTimeOfDay(t)}
              className={`min-h-[44px] px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                couple.selectedTimeOfDay === t
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {t === 'auto' ? 'Auto (Jam)' : t === 'dawn' ? 'Fajar' : t === 'day' ? 'Siang' : t === 'sunset' ? 'Senja' : 'Malam'}
            </button>
          ))}
        </div>

        {/* Cuaca */}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-stone-500 dark:text-stone-400">Cuaca:</span>
          {(['clear', 'rain', 'rainbow'] as WeatherType[]).map((w) => (
            <button type="button"
              key={w}
              onClick={() => setWeather(w)}
              className={`min-h-[44px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                couple.selectedWeather === w
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {w === 'clear' ? '☀️ Cerah' : w === 'rain' ? '🌧️ Gerimis' : '🌈 Pelangi'}
            </button>
          ))}
        </div>
      </div>

      {is3DMode ? (
        <Suspense
          fallback={
            <div role="status" className="h-[400px] flex items-center justify-center text-xs text-stone-600 dark:text-stone-400">
              Memuat taman 3D...
            </div>
          }
        >
          <ThreeGarden
            streakCount={couple.combinedStreak}
            completedTodayCount={completedTodayUser}
            partnerCompletedTodayCount={completedTodayPartner}
            unlockedDecorations={couple.unlockedDecorations}
            timeOfDay={couple.selectedTimeOfDay}
            weather={couple.selectedWeather}
          />
        </Suspense>
      ) : (
        <Garden2DFallback
          streakCount={couple.combinedStreak}
          completedTodayUser={completedTodayUser > 0}
          completedTodayPartner={completedTodayPartner > 0}
          timeOfDay={couple.selectedTimeOfDay === 'auto' ? 'day' : couple.selectedTimeOfDay}
          weather={couple.selectedWeather}
          unlockedDecorations={couple.unlockedDecorations}
          userLabel={currentUser.displayName}
          partnerLabel={partnerUser?.displayName || 'Pasangan'}
        />
      )}

      {/* Biosains & Habit Neuroscience Hub */}
      <div className="space-y-4 pt-4 border-t border-stone-200/80 dark:border-stone-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Dna className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                Neurosains Habit & Biosains Pertumbuhan
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Prinsip ilmiah neurobiologi tentang sirkuit dopamin, pembentukan kebiasaan, dan koneksi pasangan.
              </p>
            </div>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl overflow-x-auto">
            <button type="button"
              onClick={() => setActiveTopic('all')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTopic === 'all'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Semua Topik
            </button>
            <button type="button"
              onClick={() => setActiveTopic('dopamine')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTopic === 'dopamine'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Dopamin
            </button>
            <button type="button"
              onClick={() => setActiveTopic('habit-loop')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTopic === 'habit-loop'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Habit Stacking
            </button>
            <button type="button"
              onClick={() => setActiveTopic('circadian')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTopic === 'circadian'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Sirkadian
            </button>
            <button type="button"
              onClick={() => setActiveTopic('co-regulation')}
              className={`min-h-[44px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTopic === 'co-regulation'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Co-Regulation
            </button>
          </div>
        </div>

        {/* Neuroscience Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInsights.map((insight) => (
            <div
              key={insight.id}
              className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-4"
            >
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {insight.topic === 'dopamine'
                    ? 'Sirkuit Neurokimia'
                    : insight.topic === 'habit-loop'
                    ? 'Struktur Otak Basal Ganglia'
                    : insight.topic === 'circadian'
                    ? 'Kronobiologi & Fokus'
                    : 'Psikofisiologi Relasi'}
                </span>
                <h4 className="text-base font-bold text-stone-900 dark:text-stone-100 mt-1">
                  {insight.title}
                </h4>
              </div>

              {/* Biological Mechanism */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide">
                  Mekanisme Biologis
                </span>
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-stone-800/40 p-3 rounded-2xl border border-stone-100 dark:border-stone-800">
                  {insight.mechanism}
                </p>
              </div>

              {/* Actionable Practical Tip */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                  Tips Praktis Bersama Pasangan
                </span>
                <p className="text-xs text-stone-700 dark:text-stone-200 font-medium leading-relaxed bg-amber-500/10 dark:bg-amber-950/20 p-3 rounded-2xl border border-amber-200/40 dark:border-amber-900/40">
                  {insight.practicalTip}
                </p>
              </div>

              {/* Scholarly Citation */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 italic">
                <span className="truncate pr-2">{insight.citation}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toko Dekorasi Pulau Modal */}
      {isShopModalOpen && (
        <DecorationShopModal onClose={() => setIsShopModalOpen(false)} />
      )}
    </div>
  );
};
