/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ReactionToast } from './components/ReactionToast';
import { TodayView } from './views/TodayView';
import { TimerView } from './views/TimerView';
import { CoupleSimulatorToolbar } from './components/CoupleSimulatorToolbar';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthView } from './views/AuthView';
import { PairingView } from './views/PairingView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HabitCategory } from './types/index';

const ProgressView = lazy(() =>
  import('./views/ProgressView').then((m) => ({ default: m.ProgressView }))
);
const CoupleView = lazy(() =>
  import('./views/CoupleView').then((m) => ({ default: m.CoupleView }))
);
const GardenView = lazy(() =>
  import('./views/GardenView').then((m) => ({ default: m.GardenView }))
);
const AgreementsView = lazy(() =>
  import('./views/AgreementsView').then((m) => ({ default: m.AgreementsView }))
);

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      <span className="sr-only">Memuat tampilan</span>
    </div>
  );
}

function MainAppContent() {
  const {
    isOnboardingOpen,
    setIsOnboardingOpen,
    authUser,
    isAuthLoading,
    isDemoMode,
    currentUser,
    couple,
  } = useApp();
  const [activeTab, setActiveTab] = useState<string>('today');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [timerConfig, setTimerConfig] = useState<{
    habitId?: string;
    category?: HabitCategory;
    minutes?: number;
  }>({});

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeTab]);

  const isLoadingCouple =
    !isDemoMode && !!authUser && !!currentUser.coupleId && couple.id !== currentUser.coupleId;

  if (isAuthLoading || isLoadingCouple) {
    return (
      <div className="min-h-dvh bg-[#FBFBF9] dark:bg-[#121417] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
          <p className="text-sm text-stone-600 dark:text-stone-400">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!authUser && !isDemoMode) {
    return <AuthView />;
  }

  if (authUser && !isDemoMode && !currentUser.coupleId) {
    return <PairingView />;
  }

  const handleStartTimerFromHabit = (
    habitId: string,
    category: HabitCategory,
    minutes: number
  ) => {
    setTimerConfig({ habitId, category, minutes });
    setActiveTab('timer');
  };

  return (
    <div className="min-h-dvh bg-[#FBFBF9] dark:bg-[#121417] text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <ReactionToast />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-12">
        <Suspense fallback={<TabFallback />}>
          {activeTab === 'today' && (
            <TodayView
              onStartTimer={handleStartTimerFromHabit}
              onNavigateToAgreements={() => setActiveTab('agreements')}
            />
          )}
          {activeTab === 'timer' && (
            <TimerView
              initialHabitId={timerConfig.habitId}
              initialCategory={timerConfig.category}
              initialMinutes={timerConfig.minutes}
            />
          )}
          {activeTab === 'progress' && <ProgressView />}
          {activeTab === 'couple' && <CoupleView />}
          {activeTab === 'agreements' && <AgreementsView />}
          {activeTab === 'garden' && <GardenView />}
        </Suspense>
      </main>

      <CoupleSimulatorToolbar />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenOnboarding={() => {
          setIsSettingsOpen(false);
          setIsOnboardingOpen(true);
        }}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainAppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
