import React from 'react';
import { CheckCircle2, Timer, BarChart3, Users2, Scale, Sprout } from 'lucide-react';
import { useApp } from '../context/AppContext';

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

// A notification deep-links to one of these ids through ?tab=, so the list that
// answers a tap has to stay the same as the list that renders the bar.
export const NAV_TAB_IDS = NAV_ITEMS.map((item) => item.id);

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { unreadNews } = useApp();
  return (
    <nav
      aria-label="Navigasi utama"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 pb-safe"
    >
      <div className="grid grid-cols-6 items-center h-16 max-w-xl mx-auto px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const pending = item.id === 'couple' ? unreadNews : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center min-h-[48px] min-w-[44px] py-1"
            >
              <span
                className={`relative p-1 rounded-xl transition-colors ${
                  isActive
                    ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10'
                    : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                {pending > 0 && (
                  <span
                    data-nav-badge={String(pending)}
                    className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {pending > 9 ? '9+' : pending}
                  </span>
                )}
              </span>
              <span
                className={`text-[11px] tracking-tight mt-0.5 whitespace-nowrap ${
                  isActive
                    ? 'font-semibold text-stone-900 dark:text-stone-100'
                    : 'font-medium text-stone-600 dark:text-stone-400'
                }`}
              >
                {item.label}
                {pending > 0 ? ` · ${pending}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
