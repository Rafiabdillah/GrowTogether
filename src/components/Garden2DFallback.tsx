import React from 'react';
import { Sparkles, Sun, Moon, Cloud, Heart } from 'lucide-react';
import { TimeOfDay, WeatherType, IslandDecorationId } from '../types';
import { nextPart, openParts, partLabel, TREE_PARTS, type TreePartId } from '../lib/treeCraft';

interface Garden2DFallbackProps {
  streakCount: number;
  completedTodayUser: boolean;
  completedTodayPartner: boolean;
  /** Misi tuntas seumur ruangan; tiap ambang menambah satu bagian pada pohon. */
  missionsDone: number;
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
  missionsDone,
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

  const craft = openParts(missionsDone);
  const open = new Set<TreePartId>(craft.map((p) => p.id));
  const punuk = nextPart(missionsDone);

  // Accessibility text for screen readers
  const a11ySummary = `Pohon pertumbuhan kalian berada di ${growthStage}, dengan streak ${streakCount} hari bersama. ` +
    `Dari ${TREE_PARTS.length} pelengkap pohon, ${craft.length} sudah terbuka karena ${missionsDone} misi kalian selesaikan` +
    (craft.length > 0 ? `: ${craft.map((p) => p.label).join(', ')}` : '') + '. ' +
    (punuk
      ? `Bagian berikutnya, ${punuk.part.label}, terbuka setelah ${punuk.remaining} misi lagi. `
      : 'Pohon kalian sudah lengkap. ') +
    `Lentera ${userLabel} ${
    completedTodayUser ? 'menyala terang' : 'belum menyala'
  }, dan lentera ${partnerLabel} ${
    completedTodayPartner ? 'menyala terang' : 'belum menyala'
  }. Cuaca saat ini ${weather === 'rain' ? 'gerimis lembut' : weather === 'rainbow' ? 'pelangi indah' : 'langit cerah'}.`;

  // Tajuk dipakai sebagai jangkar: pelengkap dari misi harus menempel di pohon
  // yang benar-benar tampil, bukan di koordinat tetap yang jatuh ke langit.
  const canopy =
    streakCount >= 8
      ? { x: 200, y: 78, r: 50 }
      : streakCount >= 4
      ? { x: 200, y: 98, r: 36 }
      : { x: 200, y: 138, r: 18 };
  const shell = (i: number, n: number, scale = 1) => {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 0.5);
    return {
      cx: canopy.x + canopy.r * scale * Math.sin(phi) * Math.cos(theta),
      cy: canopy.y + canopy.r * scale * Math.cos(phi) * 0.75,
    };
  };

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
      data-craft={`${missionsDone} misi tuntas · ${craft.length}/${TREE_PARTS.length} pelengkap`}
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
          <span className="text-stone-400">·</span>
          <span>{craft.length}/{TREE_PARTS.length} pelengkap</span>
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

          {/* Pelengkap pohon: satu bagian tiap ambang misi yang tuntas, jangkar
              sama dengan versi 3D supaya kedua mode bercerita hal yang sama. */}
          {open.has('roots') && (
            <g data-part="roots" fill="none" stroke="#8A6548" strokeWidth="3" strokeLinecap="round">
              <title>{partLabel('roots')}</title>
              <path d="M 193 213 Q 181 219 173 222" />
              <path d="M 207 213 Q 219 219 227 222" />
              <path d="M 197 214 Q 191 223 187 229" />
              <path d="M 203 214 Q 211 223 215 229" />
            </g>
          )}
          {open.has('moss') && (
            <g data-part="moss" fill="#5F8B63" opacity="0.85">
              <title>{partLabel('moss')}</title>
              <ellipse cx="191" cy="168" rx="6" ry="3" />
              <ellipse cx="206" cy="150" rx="5" ry="2.5" />
              <ellipse cx="194" cy="128" rx="4.5" ry="2.5" />
            </g>
          )}
          {open.has('sprigs') && (
            <g data-part="sprigs" stroke="#8A6548" strokeWidth="3" fill="none" strokeLinecap="round">
              <title>{partLabel('sprigs')}</title>
              <path d="M 196 156 Q 178 148 168 138" />
              <path d="M 204 150 Q 224 144 234 133" />
            </g>
          )}
          {open.has('leafTufts') && (
            <g data-part="leafTufts" fill="#6BB57E" opacity="0.9">
              <title>{partLabel('leafTufts')}</title>
              <circle cx="166" cy="135" r="9" />
              <circle cx="236" cy="130" r="9" />
              <circle cx={canopy.x} cy={canopy.y - canopy.r - 5} r="8" />
            </g>
          )}
          {open.has('blossoms') && (
            <g data-part="blossoms" fill="#FFF1D6">
              <title>{partLabel('blossoms')}</title>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const p = shell(i, 6, 1.05);
                return <circle key={i} cx={p.cx} cy={p.cy} r="4.5" />;
              })}
            </g>
          )}
          {open.has('fruits') && (
            <g data-part="fruits" fill="#D97706">
              <title>{partLabel('fruits')}</title>
              {[0, 1, 2, 3].map((i) => {
                const ang = (i / 4) * Math.PI * 2;
                return (
                  <circle
                    key={i}
                    cx={canopy.x + Math.cos(ang) * canopy.r * 0.55}
                    cy={canopy.y + canopy.r * 0.72 + Math.sin(ang) * 4}
                    r="4"
                  />
                );
              })}
            </g>
          )}
          {open.has('nest') && (
            <g data-part="nest">
              <title>{partLabel('nest')}</title>
              <ellipse cx={canopy.x + canopy.r * 0.78} cy={canopy.y + 4} rx="11" ry="6" fill="#8A5A36" />
              <circle cx={canopy.x + canopy.r * 0.78 - 4} cy={canopy.y + 1} r="2.6" fill="#F8FAFC" />
              <circle cx={canopy.x + canopy.r * 0.78 + 3} cy={canopy.y + 1} r="2.6" fill="#F8FAFC" />
            </g>
          )}
          {open.has('vines') && (
            <g data-part="vines" stroke="#3F7D58" strokeWidth="2" fill="none" strokeLinecap="round">
              <title>{partLabel('vines')}</title>
              {[0, 1, 2].map((i) => {
                const x = canopy.x + (i - 1) * canopy.r * 0.6;
                const y = canopy.y + canopy.r * 0.6;
                return <path key={i} d={`M ${x} ${y} q 6 14 -2 ${22 + i * 6}`} />;
              })}
            </g>
          )}
          {open.has('mushrooms') && (
            <g data-part="mushrooms">
              <title>{partLabel('mushrooms')}</title>
              {[
                { x: 128, y: 208 },
                { x: 268, y: 206 },
                { x: 156, y: 214 },
              ].map((m) => (
                <g key={m.x}>
                  <rect x={m.x - 1.5} y={m.y} width="3" height="8" fill="#F5F0E6" />
                  <ellipse cx={m.x} cy={m.y} rx="7" ry="4" fill="#E06D53" />
                </g>
              ))}
            </g>
          )}
          {open.has('fireflies') && (
            <g data-part="fireflies" fill="#FFE066">
              <title>{partLabel('fireflies')}</title>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const ang = (i / 6) * Math.PI * 2;
                return (
                  <circle
                    key={i}
                    cx={canopy.x + Math.cos(ang) * (canopy.r + 24)}
                    cy={canopy.y + Math.sin(ang) * (canopy.r + 14)}
                    r="2.6"
                    opacity="0.9"
                  />
                );
              })}
            </g>
          )}
          {open.has('birds') && (
            <g data-part="birds">
              <title>{partLabel('birds')}</title>
              <ellipse cx={canopy.x - 13} cy={canopy.y - canopy.r - 3} rx="6" ry="4.5" fill="#60A5FA" />
              <circle cx={canopy.x - 19} cy={canopy.y - canopy.r - 6} r="2.8" fill="#60A5FA" />
              <polygon
                points={`${canopy.x - 22},${canopy.y - canopy.r - 7} ${canopy.x - 25},${canopy.y - canopy.r - 5} ${canopy.x - 22},${canopy.y - canopy.r - 4}`}
                fill="#FDE047"
              />
              <ellipse cx={canopy.x + 13} cy={canopy.y - canopy.r - 3} rx="6" ry="4.5" fill="#F59E0B" />
              <circle cx={canopy.x + 19} cy={canopy.y - canopy.r - 6} r="2.8" fill="#F59E0B" />
              <polygon
                points={`${canopy.x + 22},${canopy.y - canopy.r - 7} ${canopy.x + 25},${canopy.y - canopy.r - 5} ${canopy.x + 22},${canopy.y - canopy.r - 4}`}
                fill="#FDE047"
              />
            </g>
          )}
          {open.has('crown') && (
            <g data-part="crown">
              <title>{partLabel('crown')}</title>
              <ellipse
                cx={canopy.x}
                cy={canopy.y - canopy.r - 14}
                rx={canopy.r * 0.8}
                ry="8"
                fill="none"
                stroke="#FFD166"
                strokeWidth="2.5"
              />
            </g>
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

      <p className="text-[11px] font-semibold text-center z-10">
        {punuk
          ? `Bagian berikutnya: ${punuk.part.label} — ${punuk.remaining} misi lagi`
          : 'Semua bagian pohon sudah tumbuh.'}
      </p>
    </div>
  );
};
