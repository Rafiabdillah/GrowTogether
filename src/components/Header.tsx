import { Moon, Sun, Users, WifiOff, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSettings: () => void;
}

const NAV_LINKS = [
  { id: 'today', label: 'Hari Ini' },
  { id: 'timer', label: 'Timer Fokus' },
  { id: 'progress', label: 'Progres' },
  { id: 'couple', label: 'Pasangan' },
  { id: 'agreements', label: 'Kesepakatan' },
  { id: 'garden', label: 'Taman' },
];

const ICON_BUTTON =
  'min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors';

const THEME_DOT: Record<string, string> = {
  coral: 'bg-rose-500',
  teal: 'bg-emerald-500',
  amber: 'bg-amber-500',
  indigo: 'bg-indigo-500',
};

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onOpenSettings }) => {
  const { currentUser, isDemoMode, isDarkMode, toggleDarkMode, isOnline, switchSimulatedUser } =
    useApp();
  const currentName = currentUser.displayName.split(' ')[0];

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            aria-hidden="true"
            className="w-9 h-9 rounded-xl shadow-sm"
          />
          <div className="hidden sm:flex flex-col">
            <span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans leading-none">
              GrowTogether
            </span>
            <span className="text-[11px] text-stone-600 dark:text-stone-400 font-medium mt-0.5">
              Habit Pasangan · v{__APP_VERSION__}
            </span>
          </div>
        </div>

        <nav
          aria-label="Navigasi utama"
          className="hidden lg:flex items-center gap-5 text-sm font-medium text-stone-600 dark:text-stone-400"
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveTab(link.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-h-[44px] whitespace-nowrap transition-colors hover:text-stone-900 dark:hover:text-stone-100 ${
                  isActive ? 'text-amber-700 dark:text-amber-300 font-semibold' : ''
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton />

          {isDemoMode ? (
            <button
              type="button"
              onClick={switchSimulatedUser}
              aria-label={`Ganti perspektif pasangan, sekarang ${currentName}`}
              title="Ganti perspektif pasangan untuk uji coba (Rama dan Shinta)"
              className="min-h-[44px] flex items-center gap-2 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors text-xs font-medium"
            >
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${
                  THEME_DOT[currentUser.colorTheme] ?? 'bg-amber-500'
                }`}
              />
              <span className="max-w-[70px] sm:max-w-none truncate font-semibold">{currentName}</span>
              <Users className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
            </button>
          ) : (
            <span className="min-h-[44px] flex items-center gap-2 px-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium">
              <span
                aria-hidden="true"
                className={`w-2 h-2 rounded-full ${
                  THEME_DOT[currentUser.colorTheme] ?? 'bg-amber-500'
                }`}
              />
              <span className="max-w-[70px] sm:max-w-none truncate font-semibold">{currentName}</span>
            </span>
          )}

          {!isOnline && (
            <span
              role="status"
              className="p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-1"
              title="Mode offline: data tersimpan di perangkat dan disinkronkan saat online"
            >
              <WifiOff className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">Mode offline</span>
            </span>
          )}

          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'}
            className={ICON_BUTTON}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Buka pengaturan pasangan dan profil"
            className={ICON_BUTTON}
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};
