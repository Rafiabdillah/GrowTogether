import React from 'react';
import { CheckCircle2, Timer, BarChart3, Users2, Scale, Sprout } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const NAV_ITEMS = [
  { id: 'today', label: 'Hari Ini', icon: CheckCircle2 },
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'agreements', label: 'Sanksi', icon: Scale },
  { id: 'couple', label: 'Kita', icon: Users2 },
  { id: 'progress', label: 'Progres', icon: BarChart3 },
  { id: 'garden', label: 'Taman', icon: Sprout },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      aria-label="Navigasi utama"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 pb-safe"
    >
      <div className="grid grid-cols-6 items-center h-16 max-w-xl mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center min-h-[48px] min-w-[44px] py-1"
            >
              <span
                className={`p-1 rounded-xl transition-colors ${
                  isActive
                    ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10'
                    : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span
                className={`text-[11px] tracking-tight mt-0.5 whitespace-nowrap ${
                  isActive
                    ? 'font-semibold text-stone-900 dark:text-stone-100'
                    : 'font-medium text-stone-600 dark:text-stone-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
