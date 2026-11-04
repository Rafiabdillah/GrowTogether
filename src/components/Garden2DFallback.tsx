import React from 'react';
import { Sparkles, Sun, Moon, Cloud, Heart } from 'lucide-react';
import { TimeOfDay, WeatherType, IslandDecorationId } from '../types';

interface Garden2DFallbackProps {
  streakCount: number;
  completedTodayUser: boolean;
  completedTodayPartner: boolean;
  timeOfDay: TimeOfDay;
  weather: WeatherType;
  unlockedDecorations: IslandDecorationId[];
  userLabel: string;
  partnerLabel: string;
}

export const Garden2DFallback: React.FC<Garden2DFallbackProps> = ({
  streakCount,
  completedTodayUser,
  completedTodayPartner,
  timeOfDay,
  weather,
  unlockedDecorations,
  userLabel,
  partnerLabel,
}) => {
  // Determine growth stage
  const growthStage =
    streakCount < 4
      ? 'Bibit Tunas (Tahap 1)'
      : streakCount < 8
      ? 'Tunas Muda (Tahap 2)'
      : streakCount < 15
      ? 'Pohon Rimbun (Tahap 3)'
      : 'Pohon Pusaka Berbunga (Tahap 4)';

  // Accessibility text for screen readers
  const a11ySummary = `Pohon pertumbuhan kalian berada di ${growthStage}, dengan streak ${streakCount} hari bersama. Lentera ${userLabel} ${
    completedTodayUser ? 'menyala terang' : 'belum menyala'
  }, dan lentera ${partnerLabel} ${
    completedTodayPartner ? 'menyala terang' : 'belum menyala'
  }. Cuaca saat ini ${weather === 'rain' ? 'gerimis lembut' : weather === 'rainbow' ? 'pelangi indah' : 'langit cerah'}.`;

  // Background gradient per time of day
  const skyClasses =
    timeOfDay === 'night'
      ? 'from-indigo-950 via-stone-900 to-stone-950 text-white'
      : timeOfDay === 'sunset'
      ? 'from-orange-400 via-rose-400 to-purple-900 text-white'
      : timeOfDay === 'dawn'
      ? 'from-amber-200 via-rose-200 to-sky-300 text-stone-800'
      : 'from-sky-300 via-sky-100 to-amber-50 text-stone-800';

  return (
    <div
      role="region"
      aria-label="Taman Kita Versi Ringan dan Aksesibel"
      className={`relative w-full h-[380px] rounded-3xl overflow-hidden bg-gradient-to-b ${skyClasses} border border-stone-200/80 dark:border-stone-800 shadow-sm flex flex-col justify-between p-6 select-none`}
    >
      {/* Hidden screen-reader announcement */}
      <span className="sr-only">{a11ySummary}</span>

      {/* Top Atmosphere Bar */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-stone-900/70 text-xs font-semibold shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Taman Kita (Mode Aksesibel 2D)</span>
          <span className="text-stone-400">·</span>
          <span>{growthStage}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-white/70 dark:bg-stone-900/70">
          {timeOfDay === 'night' ? <Moon className="w-3.5 h-3.5 text-amber-300" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
          <span className="capitalize">{timeOfDay}</span>
        </div>
      </div>

      {/* Center Stylized Floating Island Illustration */}
      <div className="relative flex-1 flex items-center justify-center">
        {/* SVG Procedural Tree & Floating Island */}
        <svg viewBox="0 0 400 300" className="w-full max-w-sm h-auto drop-shadow-md">
          <defs>
            <radialGradient id="islandGrad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#4E8B73" />
              <stop offset="70%" stopColor="#2D5A46" />
              <stop offset="100%" stopColor="#1E382B" />
            </radialGradient>
            <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8A6548" />
              <stop offset="100%" stopColor="#533B27" />
            </linearGradient>
            <radialGradient id="lanternCoralGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFAA99" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#E06D53" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="lanternSageGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#A8E6CF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#4A826B" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Floating Island Rock Base */}
          <path
            d="M 60 210 Q 200 195 340 210 Q 300 270 200 290 Q 100 270 60 210 Z"
            fill="#3B322B"
          />
          {/* Mossy Grass Top Layer */}
          <ellipse cx="200" cy="210" rx="140" ry="25" fill="url(#islandGrad)" />

          {/* Tree Trunk */}
          <path
            d="M 190 212 C 185 170 170 140 180 110 C 185 95 200 80 205 75 C 210 85 215 130 210 212 Z"
            fill="url(#trunkGrad)"
          />

          {/* Foliage Canopy based on Streak */}
          {streakCount >= 8 ? (
            <>
              {/* Grand Tree Crown */}
              <circle cx="160" cy="90" r="45" fill="#E06D53" opacity="0.9" />
              <circle cx="240" cy="90" r="48" fill="#4A826B" opacity="0.9" />
              <circle cx="200" cy="65" r="52" fill="#E5A93C" opacity="0.92" />
              {/* Blooming Golden Flowers */}
              <circle cx="155" cy="80" r="7" fill="#FFEDB3" />
              <circle cx="230" cy="75" r="8" fill="#FFEDB3" />
              <circle cx="200" cy="50" r="9" fill="#FFF4D0" />
              <circle cx="185" cy="100" r="6" fill="#FFEDB3" />
            </>
          ) : streakCount >= 4 ? (
            <>
              {/* Young Sapling */}
              <circle cx="180" cy="105" r="32" fill="#E06D53" opacity="0.88" />
              <circle cx="220" cy="105" r="34" fill="#4A826B" opacity="0.88" />
              <circle cx="200" cy="90" r="36" fill="#E5A93C" opacity="0.9" />
            </>
          ) : (
            <>
              {/* Small Sprout */}
              <ellipse cx="190" cy="140" rx="16" ry="25" fill="#E06D53" transform="rotate(-25 190 140)" />
              <ellipse cx="210" cy="140" rx="16" ry="25" fill="#4A826B" transform="rotate(25 210 140)" />
            </>
          )}

          {/* Left Lantern (User A - Coral) */}
          <g transform="translate(110, 180)">
            {completedTodayUser && (
              <circle cx="12" cy="16" r="30" fill="url(#lanternCoralGlow)" />
            )}
            <line x1="12" y1="0" x2="12" y2="8" stroke="#777" strokeWidth="2" />
            <rect
              x="4"
              y="8"
              width="16"
              height="20"
              rx="4"
              fill={completedTodayUser ? '#FF7A64' : '#444'}
              stroke="#222"
              strokeWidth="1.5"
            />
            {completedTodayUser && <circle cx="12" cy="18" r="4" fill="#FFF" />}
          </g>

          {/* Right Lantern (Partner B - Sage) */}
          <g transform="translate(265, 180)">
            {completedTodayPartner && (
              <circle cx="12" cy="16" r="30" fill="url(#lanternSageGlow)" />
            )}
            <line x1="12" y1="0" x2="12" y2="8" stroke="#777" strokeWidth="2" />
            <rect
              x="4"
              y="8"
              width="16"
              height="20"
              rx="4"
              fill={completedTodayPartner ? '#4E8B73' : '#444'}
              stroke="#222"
              strokeWidth="1.5"
            />
            {completedTodayPartner && <circle cx="12" cy="18" r="4" fill="#FFF" />}
          </g>

          {/* Unlocked Decorations */}
          {unlockedDecorations.includes('swing') && (
            <g transform="translate(150, 120)">
              <title>Ayunan Kayu Berdua</title>
              <line x1="0" y1="0" x2="0" y2="50" stroke="#8A6548" strokeWidth="1.5" />
              <line x1="20" y1="0" x2="20" y2="50" stroke="#8A6548" strokeWidth="1.5" />
              <rect x="-4" y="50" width="28" height="5" rx="2" fill="#D4A373" />
            </g>
          )}
          {unlockedDecorations.includes('pond') && (
            <g transform="translate(76, 214)">
              <title>Kolam Teratai Berbatu</title>
              <ellipse cx="24" cy="6" rx="26" ry="9" fill="#6FB6D9" opacity="0.9" />
              <ellipse cx="24" cy="4" rx="20" ry="6" fill="#9FDBF0" opacity="0.7" />
              <ellipse cx="14" cy="6" rx="7" ry="3" fill="#4A826B" />
              <circle cx="33" cy="4" r="2.5" fill="#F4A9C1" />
            </g>
          )}
          {unlockedDecorations.includes('cottage') && (
            <g transform="translate(296, 186)">
              <title>Rumah Peri Mungil</title>
              <rect x="4" y="14" width="22" height="16" rx="2" fill="#D4A373" stroke="#8A6548" strokeWidth="1.2" />
              <polygon points="0,15 15,0 30,15" fill="#E06D53" stroke="#8A6548" strokeWidth="1.2" />
              <rect x="12" y="21" width="6" height="9" rx="1" fill="#6B4A2F" />
              <circle cx="22" cy="20" r="1.8" fill="#FFEDB3" />
            </g>
          )}
          {unlockedDecorations.includes('lanterns') && (
            <g transform="translate(140, 112)">
              <title>Lampion Bambu Bercahaya</title>
              <path d="M 0 0 Q 40 18 88 4" stroke="#8A6548" strokeWidth="1.2" fill="none" />
              <circle cx="14" cy="8" r="5" fill="#E5A93C" opacity="0.35" />
              <circle cx="14" cy="8" r="3" fill="#FFD166" />
              <circle cx="42" cy="15" r="5" fill="#E5A93C" opacity="0.35" />
              <circle cx="42" cy="15" r="3" fill="#FFD166" />
              <circle cx="72" cy="9" r="5" fill="#E5A93C" opacity="0.35" />
              <circle cx="72" cy="9" r="3" fill="#FFD166" />
            </g>
          )}
          {unlockedDecorations.includes('cat') && (
            <g transform="translate(225, 202)">
              <title>Kucing Oren Sahabat Baca</title>
              <circle cx="10" cy="8" r="7" fill="#F4A261" />
              <polygon points="5,3 8,0 10,4" fill="#F4A261" />
              <polygon points="12,4 14,0 17,3" fill="#F4A261" />
              <ellipse cx="14" cy="12" rx="10" ry="6" fill="#F4A261" />
            </g>
          )}
        </svg>

        {/* High-Five Central Union Effect */}
        {completedTodayUser && completedTodayPartner && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none animate-pulse">
            <div className="w-16 h-16 rounded-full bg-amber-400/30 blur-lg" />
            <Sparkles className="w-6 h-6 text-amber-300 absolute" />
          </div>
        )}
      </div>

      {/* Bottom Status & Screen Reader Text */}
      <div className="flex items-center justify-between text-xs font-medium z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                completedTodayUser ? 'bg-rose-500 shadow-sm shadow-rose-500' : 'bg-stone-400'
              }`}
            />
            <span>Lentera {userLabel}: {completedTodayUser ? 'Menyala' : 'Belum'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                completedTodayPartner ? 'bg-emerald-500 shadow-sm shadow-emerald-500' : 'bg-stone-400'
              }`}
            />
            <span>Lentera {partnerLabel}: {completedTodayPartner ? 'Menyala' : 'Belum'}</span>
          </div>
        </div>

        <span className="font-mono font-bold">{streakCount} Hari Streak</span>
      </div>
    </div>
  );
};
