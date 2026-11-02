import React from 'react';

interface AppleWatchRingsProps {
  userPercent: number;
  partnerPercent: number;
  focusMinutesPercent: number;
  userLabel: string;
  partnerLabel: string;
  size?: number;
}

export const AppleWatchRings: React.FC<AppleWatchRingsProps> = ({
  userPercent,
  partnerPercent,
  focusMinutesPercent,
  userLabel,
  partnerLabel,
  size = 180,
}) => {
  // Clamp percentages between 0 and 100 for SVG stroke calculations
  const p1 = Math.min(100, Math.max(0, userPercent));
  const p2 = Math.min(100, Math.max(0, partnerPercent));
  const p3 = Math.min(100, Math.max(0, focusMinutesPercent));

  // Radii for concentric rings
  const r1 = 40; // Outer (User)
  const r2 = 30; // Middle (Partner)
  const r3 = 20; // Inner (Focus)

  const strokeWidth = 7;
  const center = 50;

  const circ1 = 2 * Math.PI * r1;
  const circ2 = 2 * Math.PI * r2;
  const circ3 = 2 * Math.PI * r3;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full -rotate-90 transform drop-shadow-sm"
        >
          {/* Ring 1: Background Track */}
          <circle
            cx={center}
            cy={center}
            r={r1}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-rose-500/15 dark:text-rose-950/40"
          />
          {/* Ring 1: Progress (User Coral) */}
          <circle
            cx={center}
            cy={center}
            r={r1}
            stroke="#FF5A5F"
            strokeWidth={strokeWidth}
            strokeDasharray={circ1}
            strokeDashoffset={circ1 - (circ1 * p1) / 100}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-700 ease-out"
          />

          {/* Ring 2: Background Track */}
          <circle
            cx={center}
            cy={center}
            r={r2}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-emerald-500/15 dark:text-emerald-950/40"
          />
          {/* Ring 2: Progress (Partner Sage) */}
          <circle
            cx={center}
            cy={center}
            r={r2}
            stroke="#34D399"
            strokeWidth={strokeWidth}
            strokeDasharray={circ2}
            strokeDashoffset={circ2 - (circ2 * p2) / 100}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-700 ease-out"
          />

          {/* Ring 3: Background Track */}
          <circle
            cx={center}
            cy={center}
            r={r3}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-amber-500/15 dark:text-amber-950/40"
          />
          {/* Ring 3: Progress (Focus Amber) */}
          <circle
            cx={center}
            cy={center}
            r={r3}
            stroke="#FBBF24"
            strokeWidth={strokeWidth}
            strokeDasharray={circ3}
            strokeDashoffset={circ3 - (circ3 * p3) / 100}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Sparkle Icon */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
            {Math.round((p1 + p2) / 2)}%
          </span>
        </div>
      </div>

      {/* Ring Legend & Metrics */}
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Ring 1 Legend */}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FF5A5F] shrink-0" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-stone-900 dark:text-stone-100">{userLabel}:</span>
            <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{p1}% selesai</span>
          </div>
        </div>

        {/* Ring 2 Legend */}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#34D399] shrink-0" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-stone-900 dark:text-stone-100">{partnerLabel}:</span>
            <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{p2}% selesai</span>
          </div>
        </div>

        {/* Ring 3 Legend */}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#FBBF24] shrink-0" />
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-stone-900 dark:text-stone-100">Fokus Bersama:</span>
            <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{p3}% target</span>
          </div>
        </div>
      </div>
    </div>
  );
};
